import { join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findMarkdownFiles, fileExists, DISPATCHER_WORKFLOW_NAME } from '../utils/files';
import { agentParser } from '../../parser';
import { workflowGenerator } from '../../generator';
import { dispatcherGenerator } from '../../generator/dispatcher';
import type { AgentDefinition, CompileResult, ValidationError } from '../../types';
import { workflowValidator } from '../utils/workflow-validator';

interface CompileOptions {
  dryRun?: boolean;
  outputDir?: string;
}

export async function compileCommand(options: CompileOptions): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.github', 'agents');
  const workflowsDir = options.outputDir || join(cwd, '.github', 'workflows');

  const spinner = ora('Finding agent files...').start();

  const agentsDirExists = await fileExists(agentsDir);
  if (!agentsDirExists) {
    spinner.fail('Agents directory not found');
    logger.error(`Directory not found: ${agentsDir}`);
    logger.info('Run: repo-agents init');
    process.exit(1);
  }

  const files = await findMarkdownFiles(agentsDir);

  if (files.length === 0) {
    spinner.warn('No agent files found');
    logger.info(`Create agent files in: ${agentsDir}`);
    return;
  }

  spinner.succeed(`Found ${files.length} agent file(s)`);

  // Phase 1: Parse and validate all agents
  const parsedAgents: { agent: AgentDefinition; filePath: string; errors: ValidationError[] }[] = [];
  let hasErrors = false;

  for (const filePath of files) {
    const fileName = filePath.split('/').pop() || filePath;
    const parseSpinner = ora(`Parsing ${chalk.cyan(fileName)}...`).start();

    const { agent, errors: parseErrors } = await agentParser.parseFile(filePath);

    if (!agent || parseErrors.some((e) => e.severity === 'error')) {
      parseSpinner.fail(`Failed to parse ${fileName}`);
      if (parseErrors.length > 0) {
        logger.newline();
        parseErrors.forEach((error) => {
          const icon = error.severity === 'error' ? '✗' : '⚠';
          const color = error.severity === 'error' ? chalk.red : chalk.yellow;
          logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
        });
      }
      hasErrors = true;
      continue;
    }

    const validationErrors = agentParser.validateAgent(agent);
    const allErrors = [...parseErrors, ...validationErrors];

    if (validationErrors.some((e) => e.severity === 'error')) {
      parseSpinner.fail(`Validation failed for ${fileName}`);
      logger.newline();
      validationErrors.forEach((error) => {
        const icon = error.severity === 'error' ? '✗' : '⚠';
        const color = error.severity === 'error' ? chalk.red : chalk.yellow;
        logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
      });
      hasErrors = true;
      continue;
    }

    parseSpinner.succeed(`Parsed ${fileName}`);
    parsedAgents.push({ agent, filePath, errors: allErrors });
  }

  if (hasErrors) {
    logger.newline();
    logger.error('Some agents failed to parse or validate. Fix the errors and try again.');
    process.exit(1);
  }

  if (parsedAgents.length === 0) {
    logger.error('No valid agents found');
    process.exit(1);
  }

  const agents = parsedAgents.map((p) => p.agent);

  // Phase 2: Generate dispatcher workflow
  logger.newline();
  const dispatcherSpinner = ora('Generating dispatcher workflow...').start();

  const dispatcherWorkflow = dispatcherGenerator.generate(agents);

  try {
    const schemaErrors = await workflowValidator.validateWorkflow(dispatcherWorkflow);
    if (schemaErrors.length > 0) {
      dispatcherSpinner.fail('Dispatcher workflow schema validation failed');
      logger.newline();
      schemaErrors.forEach((error) => {
        logger.log(chalk.red(`  ✗ ${error.path}: ${error.message}`));
      });
      process.exit(1);
    }
  } catch (error) {
    dispatcherSpinner.warn(`Could not validate dispatcher schema (${(error as Error).message})`);
  }

  dispatcherSpinner.succeed('Generated dispatcher workflow');

  // Phase 3: Generate agent workflows
  const results: CompileResult[] = [];

  for (const { agent, filePath, errors } of parsedAgents) {
    const fileName = filePath.split('/').pop() || filePath;
    const agentSpinner = ora(`Generating ${chalk.cyan(agent.name)} workflow...`).start();

    const agentWorkflow = workflowGenerator.generateForDispatcher(agent);

    try {
      const schemaErrors = await workflowValidator.validateWorkflow(agentWorkflow);
      if (schemaErrors.length > 0) {
        agentSpinner.fail(`Workflow schema validation failed for ${agent.name}`);
        logger.newline();
        schemaErrors.forEach((error) => {
          logger.log(chalk.red(`  ✗ ${error.path}: ${error.message}`));
        });
        results.push({
          success: false,
          inputPath: filePath,
          errors: [
            ...errors,
            ...schemaErrors.map((e) => ({
              field: e.path,
              message: e.message,
              severity: 'error' as const,
            })),
          ],
        });
        continue;
      }
    } catch (error) {
      agentSpinner.warn(`Could not validate schema for ${fileName} (${(error as Error).message})`);
    }

    agentSpinner.succeed(`Generated ${agent.name} workflow`);
    results.push({
      success: true,
      inputPath: filePath,
      errors,
      // outputPath will be set below if not dry-run
    });
  }

  // Phase 4: Write workflows
  if (options.dryRun) {
    logger.newline();
    logger.info('Dry run - not writing files');
    logger.newline();

    logger.log(chalk.gray('--- Dispatcher Workflow ---'));
    logger.log(dispatcherWorkflow);
    logger.log(chalk.gray('--- End Dispatcher Workflow ---'));

    for (const { agent } of parsedAgents) {
      logger.newline();
      logger.log(chalk.gray(`--- ${agent.name} Workflow ---`));
      logger.log(workflowGenerator.generateForDispatcher(agent));
      logger.log(chalk.gray(`--- End ${agent.name} Workflow ---`));
    }
  } else {
    await mkdir(workflowsDir, { recursive: true });

    // Write dispatcher workflow
    const dispatcherPath = join(workflowsDir, `${DISPATCHER_WORKFLOW_NAME}.yml`);
    await writeFile(dispatcherPath, dispatcherWorkflow, 'utf-8');
    logger.info(`Wrote dispatcher: ${chalk.cyan(`${DISPATCHER_WORKFLOW_NAME}.yml`)}`);

    // Write agent workflows
    for (let i = 0; i < parsedAgents.length; i++) {
      const { agent } = parsedAgents[i];
      const outputPath = await workflowGenerator.writeWorkflow(agent, workflowsDir, true);
      results[i].outputPath = outputPath;
    }
  }

  // Print summary
  logger.newline();
  printSummary(results, options.dryRun || false);
}

function printSummary(results: CompileResult[], dryRun: boolean): void {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const warnings = results.filter((r) => r.errors?.some((e) => e.severity === 'warning')).length;

  logger.info('Compilation Summary:');
  logger.log(`  ${chalk.green('✓')} Agents: ${successful}`);
  logger.log(`  ${chalk.green('✓')} Dispatcher: 1`);
  if (failed > 0) {
    logger.log(`  ${chalk.red('✗')} Failed: ${failed}`);
  }
  if (warnings > 0) {
    logger.log(`  ${chalk.yellow('⚠')} Warnings: ${warnings}`);
  }

  if (!dryRun) {
    logger.newline();
    logger.info('Workflows generated successfully!');
    logger.log('  The dispatcher handles all triggers and routes events to the appropriate agent.');
  }
}
