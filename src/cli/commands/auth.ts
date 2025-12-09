import { execSync, spawnSync } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import ora from 'ora';
import { logger } from '../utils/logger';
import * as readline from 'readline';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

interface AuthOptions {
  force?: boolean;
}

/**
 * Prompts the user for input
 */
function promptForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Checks if a token is valid by making a test API call
 */
async function validateToken(apiKey: string): Promise<boolean> {
  try {
    const client = new Anthropic({ apiKey });
    // Make a minimal API call to validate the token
    await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }],
    });
    return true;
  } catch (error: any) {
    if (error?.status === 401 || error?.message?.includes('authentication')) {
      return false;
    }
    // Other errors (rate limits, etc.) still indicate the token is valid
    return true;
  }
}

/**
 * Checks if Claude CLI is installed
 */
function isClaudeCLIInstalled(): boolean {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts the Claude token from macOS keychain
 */
function getTokenFromKeychain(): string | null {
  try {
    // Try to get credentials from keychain
    const output = execSync('security find-generic-password -s "Claude Code-credentials" -w', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Parse the JSON output
    const credentials = JSON.parse(output);
    const accessToken = credentials?.claudeAiOauth?.accessToken;

    if (accessToken && accessToken.startsWith('sk-ant-')) {
      return accessToken;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Runs the claude setup-token command interactively with silenced output
 */
async function runClaudeSetupToken(): Promise<boolean> {
  try {
    logger.info('Running claude setup-token...');
    logger.info('Please follow the prompts to authenticate with your Claude subscription.');
    logger.newline();

    // Create a temporary script to capture and silence output
    const scriptPath = join(tmpdir(), `claude-setup-${Date.now()}.sh`);
    writeFileSync(scriptPath, '#!/bin/bash\nclaude setup-token 2>&1');
    execSync(`chmod +x "${scriptPath}"`);

    // Run with piped output to silence it
    const result = spawnSync(scriptPath, [], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    // Clean up
    try {
      execSync(`rm -f "${scriptPath}"`);
    } catch {}

    return result.status === 0;
  } catch (error) {
    return false;
  }
}

/**
 * Sets the API key as a GitHub repository secret
 */
function setGitHubSecret(apiKey: string): void {
  try {
    // Use gh CLI to set the secret
    execSync('gh secret set ANTHROPIC_API_KEY', {
      input: apiKey,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch (error) {
    throw new Error('Failed to set GitHub secret. Make sure gh CLI is installed and authenticated.');
  }
}

/**
 * Checks if the GitHub secret is already set
 */
function hasGitHubSecret(): boolean {
  try {
    const output = execSync('gh secret list --json name', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output);
    return secrets.some((s: any) => s.name === 'ANTHROPIC_API_KEY');
  } catch (error) {
    return false;
  }
}

export async function authCommand(options: AuthOptions): Promise<void> {
  logger.info('Setting up Claude API token for GitHub Actions...');
  logger.newline();

  // Check if secret already exists
  if (!options.force && hasGitHubSecret()) {
    logger.warn('ANTHROPIC_API_KEY is already set as a repository secret.');
    const answer = await promptForInput('Do you want to overwrite it? (y/N): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      logger.info('Setup cancelled.');
      return;
    }
    logger.newline();
  }

  let apiKey: string | null = null;
  let useSubscription = false;

  // Step 1: Check if Claude CLI is available
  if (isClaudeCLIInstalled()) {
    const answer = await promptForInput(
      'Do you have a Claude subscription? (y/N): '
    );
    useSubscription = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  if (useSubscription) {
    // Step 2: Run claude setup-token first (authenticates Claude CLI)
    logger.newline();
    const success = await runClaudeSetupToken();

    if (!success) {
      logger.error('Claude setup-token failed or was cancelled.');
      logger.error('Please try again or contact support if the issue persists.');
      process.exit(1);
    }

    // Step 3: Extract token from keychain
    logger.newline();
    const spinner = ora('Extracting token from keychain...').start();
    apiKey = getTokenFromKeychain();

    if (!apiKey) {
      spinner.fail('Failed to extract token from keychain');
      logger.error('Could not find Claude token in keychain after setup.');
      logger.error('Please try running: claude setup-token');
      process.exit(1);
    }

    spinner.succeed('Successfully extracted token from keychain');

    // Step 4: Validate the token
    const validationSpinner = ora('Validating token...').start();
    const isValid = await validateToken(apiKey);

    if (isValid) {
      validationSpinner.succeed('Token is valid');
    } else {
      validationSpinner.warn('Token validation returned 401 - this is expected for OAuth tokens');
      logger.warn('The extracted token is an OAuth token (for Claude CLI).');
      logger.warn('GitHub Actions may require a separate API key.');
      logger.newline();
    }
  } else {
    // Step 2: Fall back to API token input for non-subscription users
    logger.newline();
    logger.info('You can get an API key from: https://console.anthropic.com/settings/keys');
    logger.newline();

    const inputKey = await promptForInput('Enter your Anthropic API key: ');

    if (!inputKey) {
      logger.error('No API key provided. Setup cancelled.');
      process.exit(1);
    }

    const validationSpinner = ora('Validating API key...').start();
    const isValid = await validateToken(inputKey);

    if (!isValid) {
      validationSpinner.fail('Invalid API key');
      logger.error('The provided API key is not valid. Please check and try again.');
      process.exit(1);
    }

    validationSpinner.succeed('API key is valid');
    apiKey = inputKey;
  }

  // Step 5: Set the GitHub secret
  logger.newline();
  const secretSpinner = ora('Setting GitHub repository secret...').start();

  try {
    setGitHubSecret(apiKey);
    secretSpinner.succeed('GitHub secret ANTHROPIC_API_KEY set successfully');
  } catch (error) {
    secretSpinner.fail('Failed to set GitHub secret');
    logger.error((error as Error).message);
    process.exit(1);
  }

  logger.newline();
  logger.success('Claude API token setup complete!');
  logger.newline();
  logger.info('Next steps:');
  logger.log('  1. Create agent files in .github/claude-agents/');
  logger.log('  2. Run: gh claude compile --all');
  logger.log('  3. Commit and push the generated workflows');
}
