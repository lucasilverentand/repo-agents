#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initCommand } from './cli/commands/init';
import { compileCommand } from './cli/commands/compile';
import { validateCommand } from './cli/commands/validate';
import { listCommand } from './cli/commands/list';
import { authCommand } from './cli/commands/auth';
import { setupAppCommand } from './cli/commands/setup-app';
import { setupCommand } from './cli/commands/setup';
import { addCommand } from './cli/commands/add';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('repo-agents')
  .description('GitHub CLI extension for creating AI-powered GitHub Actions workflows from markdown agent definitions')
  .version(packageJson.version);

program
  .command('init')
  .description('Initialize Repo Agents in the current repository')
  .option('--examples', 'Include example agent templates')
  .option('--force', 'Overwrite existing files')
  .action(initCommand);

program
  .command('compile')
  .description('Compile all agent markdown files to GitHub Actions workflows (generates dispatcher + agent workflows)')
  .option('-d, --dry-run', 'Show what would be generated without writing files')
  .option('-o, --output-dir <dir>', 'Output directory for workflows')
  .action(compileCommand);

program
  .command('validate [file]')
  .description('Validate agent markdown files')
  .option('-a, --all', 'Validate all agents')
  .option('-s, --strict', 'Enable strict validation')
  .action(validateCommand);

program
  .command('list')
  .description('List all Claude agents')
  .option('-f, --format <format>', 'Output format (table, json, yaml)', 'table')
  .option('-d, --details', 'Show detailed information')
  .action(listCommand);

program
  .command('setup-token')
  .description(
    'Set up Claude API token (checks subscription token first, then prompts for API key)'
  )
  .option('--force', 'Overwrite existing token')
  .action(authCommand);

program
  .command('setup-app')
  .description('Configure a GitHub App for branded Claude agent identity and CI triggering')
  .option('--force', 'Overwrite existing GitHub App secrets')
  .option(
    '--org <organization>',
    'Organization name (auto-detected from current repo if not specified)'
  )
  .action(setupAppCommand);

program
  .command('setup')
  .description('Interactive setup wizard for Repo Agents (configures authentication and GitHub App)')
  .option('--force', 'Overwrite existing configuration')
  .option('--skip-auth', 'Skip Claude authentication setup')
  .option('--skip-app', 'Skip GitHub App setup')
  .action(setupCommand);

program
  .command('add')
  .description('Add Claude agents from the library')
  .option('-a, --all', 'Add all agents from the library')
  .option('--force', 'Overwrite existing agents')
  .action(addCommand);

program.parse();
