import { join } from 'path';
import { mkdir } from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findMarkdownFiles, fileExists } from '../utils/files';
import { agentParser } from '../../parser';
import { workflowGenerator } from '../../generator';
import { CompileResult } from '../../types';
import { workflowValidator } from '../utils/workflow-validator';

interface CompileOptions {
  all?: boolean;
  dryRun?: boolean;
  outputDir?: string;
}

export async function compileCommand(
  file: string | undefined,
  options: CompileOptions
): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.github', 'claude-agents');
  const workflowsDir = options.outputDir || join(cwd, '.github', 'workflows');

  if (options.all) {
    await compileAll(agentsDir, workflowsDir, options.dryRun || false);
  } else if (file) {
    await compileSingle(file, workflowsDir, options.dryRun || false);
  } else {
    logger.error('Please specify a file or use --all to compile all agents');
    process.exit(1);
  }
}

async function compileAll(
  agentsDir: string,
  workflowsDir: string,
  dryRun: boolean
): Promise<void> {
  const spinner = ora('Finding agent files...').start();

  const agentsDirExists = await fileExists(agentsDir);
  if (!agentsDirExists) {
    spinner.fail('Agents directory not found');
    logger.error(`Directory not found: ${agentsDir}`);
    logger.info('Run: gh claude init');
    process.exit(1);
  }

  const files = await findMarkdownFiles(agentsDir);

  if (files.length === 0) {
    spinner.warn('No agent files found');
    logger.info(`Create agent files in: ${agentsDir}`);
    return;
  }

  spinner.succeed(`Found ${files.length} agent file(s)`);

  const results: CompileResult[] = [];

  for (const file of files) {
    const result = await compileSingle(file, workflowsDir, dryRun, false);
    results.push(result);
  }

  logger.newline();
  printSummary(results);
}

async function compileSingle(
  filePath: string,
  workflowsDir: string,
  dryRun: boolean,
  _showSummary = true
): Promise<CompileResult> {
  const fileName = filePath.split('/').pop() || filePath;
  const spinner = ora(`Compiling ${chalk.cyan(fileName)}...`).start();

  const exists = await fileExists(filePath);
  if (!exists) {
    spinner.fail(`File not found: ${filePath}`);
    return {
      success: false,
      inputPath: filePath,
      errors: [{ field: 'file', message: 'File not found', severity: 'error' }],
    };
  }

  const { agent, errors: parseErrors } = await agentParser.parseFile(filePath);

  if (!agent || parseErrors.some((e) => e.severity === 'error')) {
    spinner.fail(`Failed to parse ${fileName}`);
    if (parseErrors.length > 0) {
      logger.newline();
      parseErrors.forEach((error) => {
        const icon = error.severity === 'error' ? '✗' : '⚠';
        const color = error.severity === 'error' ? chalk.red : chalk.yellow;
        logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
      });
    }
    return {
      success: false,
      inputPath: filePath,
      errors: parseErrors,
    };
  }

  const validationErrors = agentParser.validateAgent(agent);
  const allErrors = [...parseErrors, ...validationErrors];

  if (validationErrors.some((e) => e.severity === 'error')) {
    spinner.fail(`Validation failed for ${fileName}`);
    logger.newline();
    validationErrors.forEach((error) => {
      const icon = error.severity === 'error' ? '✗' : '⚠';
      const color = error.severity === 'error' ? chalk.red : chalk.yellow;
      logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
    });
    return {
      success: false,
      inputPath: filePath,
      errors: allErrors,
    };
  }

  // Validate generated workflow against GitHub Actions schema
  spinner.text = `Validating workflow schema for ${fileName}...`;
  const generatedWorkflow = workflowGenerator.generate(agent);

  try {
    const schemaErrors = await workflowValidator.validateWorkflow(generatedWorkflow);

    if (schemaErrors.length > 0) {
      spinner.fail(`Workflow schema validation failed for ${fileName}`);
      logger.newline();
      schemaErrors.forEach((error) => {
        logger.log(chalk.red(`  ✗ ${error.path}: ${error.message}`));
      });
      return {
        success: false,
        inputPath: filePath,
        errors: [
          ...allErrors,
          ...schemaErrors.map(e => ({
            field: e.path,
            message: e.message,
            severity: 'error' as const,
          })),
        ],
      };
    }
    spinner.text = `Compiling ${chalk.cyan(fileName)}...`;
  } catch (error) {
    spinner.warn(`Could not validate workflow schema (${(error as Error).message})`);
    logger.newline();
    logger.warn('Continuing without schema validation...');
  }

  if (dryRun) {
    spinner.succeed(`Validated ${fileName}`);
    logger.newline();
    logger.log(chalk.gray('--- Generated Workflow (dry-run) ---'));
    logger.log(generatedWorkflow);
    logger.log(chalk.gray('--- End of Generated Workflow ---'));
    return {
      success: true,
      inputPath: filePath,
      errors: allErrors,
    };
  }

  try {
    await mkdir(workflowsDir, { recursive: true });
    const outputPath = await workflowGenerator.writeWorkflow(agent, workflowsDir);
    spinner.succeed(`Compiled ${fileName} → ${outputPath.split('/').pop()}`);

    if (allErrors.some((e) => e.severity === 'warning')) {
      logger.newline();
      allErrors
        .filter((e) => e.severity === 'warning')
        .forEach((error) => {
          logger.warn(`${error.field}: ${error.message}`);
        });
    }

    return {
      success: true,
      inputPath: filePath,
      outputPath,
      errors: allErrors,
    };
  } catch (error) {
    spinner.fail(`Failed to write workflow for ${fileName}`);
    logger.error((error as Error).message);
    return {
      success: false,
      inputPath: filePath,
      errors: [
        ...allErrors,
        { field: 'output', message: (error as Error).message, severity: 'error' },
      ],
    };
  }
}

function printSummary(results: CompileResult[]): void {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const warnings = results.filter((r) =>
    r.errors?.some((e) => e.severity === 'warning')
  ).length;

  logger.info('Compilation Summary:');
  logger.log(`  ${chalk.green('✓')} Successful: ${successful}`);
  if (failed > 0) {
    logger.log(`  ${chalk.red('✗')} Failed: ${failed}`);
  }
  if (warnings > 0) {
    logger.log(`  ${chalk.yellow('⚠')} Warnings: ${warnings}`);
  }
}
