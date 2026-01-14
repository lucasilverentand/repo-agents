import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';
import ora from 'ora';
import { logger } from '../utils/logger';
import { isGitRepository, hasGitHubRemote } from '../utils/git';

interface InitOptions {
  examples?: boolean;
  force?: boolean;
}

const EXAMPLE_ISSUE_TRIAGE = `---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Issue Triage Agent

You are an intelligent issue triage assistant for this GitHub repository.

## Your Task

When a new issue is opened, analyze it and:

1. **Categorize** the issue by adding appropriate labels:
   - \`bug\` - Something isn't working as expected
   - \`feature\` - New functionality request
   - \`documentation\` - Improvements or additions to documentation
   - \`question\` - Further information is requested

2. **Assess Priority** based on the description:
   - \`priority: high\` - Critical issues, security vulnerabilities, or major bugs
   - \`priority: medium\` - Important features or moderate bugs
   - \`priority: low\` - Nice-to-have features or minor issues

3. **Welcome** the contributor with a friendly comment that:
   - Thanks them for opening the issue
   - Confirms you've categorized it
   - Mentions what the next steps might be

## Guidelines

- Be friendly and welcoming
- If the issue is unclear, politely ask for more information
- If it's a duplicate, mention similar existing issues
- Keep responses concise and helpful
`;

const EXAMPLE_PR_REVIEW = `---
name: PR Initial Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Pull Request Review Agent

You are a helpful code review assistant.

## Your Task

When a pull request is opened or updated:

1. **Analyze Changes**: Review the diff and understand what's being changed

2. **Check for Issues**:
   - Missing tests for new functionality
   - Potentially breaking changes
   - Code style inconsistencies
   - Security concerns

3. **Provide Feedback**: Add a comment with:
   - A brief summary of the changes
   - Any concerns or suggestions
   - Praise for good practices
   - Request for tests if needed

4. **Add Labels**:
   - \`needs-tests\` if tests are missing
   - \`breaking-change\` if it's a breaking change
   - \`ready-for-review\` if it looks good

## Guidelines

- Be constructive and encouraging
- Focus on significant issues, not nitpicks
- Explain *why* something might be a concern
- Remember: you're here to help, not to block progress
`;

const DEFAULT_CONFIG = `# Repo Agents Configuration

# Default AI model for all agents
model:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7

# Repository settings
repository:
  # Directory containing agent markdown files
  agents_dir: .github/agents

  # Directory for generated workflows
  workflows_dir: .github/workflows

# Security settings
security:
  # Require all agents to have explicit outputs
  require_outputs: true

  # Require all agents to have explicit permissions
  require_permissions: true
`;

export async function initCommand(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  logger.info('Initializing Repo Agents...');
  logger.newline();

  const gitCheck = isGitRepository(cwd);
  if (!gitCheck) {
    logger.error('Not a git repository. Please run this command in a git repository.');
    process.exit(1);
  }

  const githubCheck = hasGitHubRemote(cwd);
  if (!githubCheck) {
    logger.warn('No GitHub remote found. Make sure this is a GitHub repository.');
  }

  const githubDir = join(cwd, '.github');
  const agentsDir = join(githubDir, 'agents');
  const workflowsDir = join(githubDir, 'workflows');
  const configFile = join(githubDir, 'agents.yml');

  const spinner = ora('Creating directory structure...').start();

  try {
    await mkdir(githubDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });
    await mkdir(workflowsDir, { recursive: true });
    spinner.succeed('Created directory structure');
  } catch (error) {
    spinner.fail('Failed to create directories');
    logger.error((error as Error).message);
    process.exit(1);
  }

  const configSpinner = ora('Creating configuration file...').start();
  try {
    const configExists = await access(configFile)
      .then(() => true)
      .catch(() => false);

    if (configExists && !options.force) {
      configSpinner.warn('Configuration file already exists (use --force to overwrite)');
    } else {
      await writeFile(configFile, DEFAULT_CONFIG);
      configSpinner.succeed('Created configuration file');
    }
  } catch (error) {
    configSpinner.fail('Failed to create configuration');
    logger.error((error as Error).message);
    process.exit(1);
  }

  if (options.examples) {
    const examplesSpinner = ora('Creating example agents...').start();
    try {
      await writeFile(join(agentsDir, 'issue-triage.md'), EXAMPLE_ISSUE_TRIAGE);
      await writeFile(join(agentsDir, 'pr-review.md'), EXAMPLE_PR_REVIEW);
      examplesSpinner.succeed('Created example agents');
    } catch (error) {
      examplesSpinner.fail('Failed to create examples');
      logger.error((error as Error).message);
    }
  }

  logger.newline();
  logger.success('Successfully initialized Repo Agents!');
  logger.newline();
  logger.info('Next steps:');
  logger.log('  1. Set up your API token: repo-agents setup-token');
  logger.log('  2. Create agent files in .github/agents/');
  logger.log('  3. Run: repo-agents compile');
  logger.log('  4. Commit and push the generated workflows');
  logger.newline();
  logger.info('Documentation: https://github.com/lucasilverentand/repo-agents');
}
