import { join } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { findMarkdownFiles, fileExists } from '../utils/files';
import { agentParser } from '../../parser';
import { ValidationError } from '../../types';

interface ValidateOptions {
  all?: boolean;
  strict?: boolean;
}

interface ValidationResult {
  filePath: string;
  success: boolean;
  errors: ValidationError[];
}

export async function validateCommand(
  file: string | undefined,
  options: ValidateOptions
): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = join(cwd, '.github', 'agents');

  if (options.all) {
    await validateAll(agentsDir, options.strict || false);
  } else if (file) {
    await validateSingle(file, options.strict || false);
  } else {
    logger.error('Please specify a file or use --all to validate all agents');
    process.exit(1);
  }
}

async function validateAll(agentsDir: string, strict: boolean): Promise<void> {
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

  const results: ValidationResult[] = [];

  for (const file of files) {
    const result = await validateSingle(file, strict, false);
    results.push(result);
  }

  logger.newline();
  printSummary(results, strict);

  const hasErrors = results.some((r) => !r.success);
  if (hasErrors) {
    process.exit(1);
  }
}

async function validateSingle(
  filePath: string,
  strict: boolean,
  _showSummary = true
): Promise<ValidationResult> {
  const fileName = filePath.split('/').pop() || filePath;
  const spinner = ora(`Validating ${chalk.cyan(fileName)}...`).start();

  const exists = await fileExists(filePath);
  if (!exists) {
    spinner.fail(`File not found: ${filePath}`);
    return {
      filePath,
      success: false,
      errors: [{ field: 'file', message: 'File not found', severity: 'error' }],
    };
  }

  const { agent, errors: parseErrors } = await agentParser.parseFile(filePath);

  if (!agent) {
    spinner.fail(`Failed to parse ${fileName}`);
    logger.newline();
    parseErrors.forEach((error) => {
      const icon = error.severity === 'error' ? '✗' : '⚠';
      const color = error.severity === 'error' ? chalk.red : chalk.yellow;
      logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
    });
    return {
      filePath,
      success: false,
      errors: parseErrors,
    };
  }

  const validationErrors = agentParser.validateAgent(agent);
  const allErrors = [...parseErrors, ...validationErrors];

  const hasErrors = allErrors.some((e) => e.severity === 'error');
  const hasWarnings = allErrors.some((e) => e.severity === 'warning');

  if (hasErrors) {
    spinner.fail(`Validation failed for ${fileName}`);
  } else if (hasWarnings && strict) {
    spinner.fail(`Validation failed for ${fileName} (strict mode)`);
  } else if (hasWarnings) {
    spinner.warn(`Validated ${fileName} (with warnings)`);
  } else {
    spinner.succeed(`Validated ${fileName}`);
  }

  if (allErrors.length > 0) {
    logger.newline();
    allErrors.forEach((error) => {
      const icon = error.severity === 'error' ? '✗' : '⚠';
      const color = error.severity === 'error' ? chalk.red : chalk.yellow;
      logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
    });
  }

  const success = strict ? !hasErrors && !hasWarnings : !hasErrors;

  return {
    filePath,
    success,
    errors: allErrors,
  };
}

function printSummary(results: ValidationResult[], strict: boolean): void {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const withWarnings = results.filter((r) => r.errors.some((e) => e.severity === 'warning')).length;

  logger.info('Validation Summary:');
  logger.log(`  ${chalk.green('✓')} Valid: ${successful}`);
  if (failed > 0) {
    logger.log(`  ${chalk.red('✗')} Invalid: ${failed}`);
  }
  if (withWarnings > 0 && !strict) {
    logger.log(`  ${chalk.yellow('⚠')} With warnings: ${withWarnings}`);
  }

  if (strict && withWarnings > 0) {
    logger.newline();
    logger.warn('Strict mode enabled: warnings treated as errors');
  }
}
