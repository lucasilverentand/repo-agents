import { execSync, spawnSync } from 'child_process';
import ora from 'ora';
import { logger } from '../utils/logger';
import { promptForInput } from '../utils/prompts';
import { getExistingSecrets, setGitHubSecret } from '../utils/secrets';

interface AuthOptions {
  force?: boolean;
}

/**
 * Validates an API key format (basic check)
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
}

/**
 * Checks if Claude CLI is installed.
 * Uses shell commands to check PATH and default installation location.
 */
function isClaudeCLIInstalled(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch {
    try {
      execSync('test -x "$HOME/.claude/local/claude"', { stdio: 'pipe', shell: '/bin/bash' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Extracts the Claude token from macOS keychain
 */
function getTokenFromKeychain(): string | null {
  try {
    const output = execSync('security find-generic-password -s "Claude Code-credentials" -w', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const credentials = JSON.parse(output);
    const accessToken = credentials?.claudeAiOauth?.accessToken;

    if (accessToken && accessToken.startsWith('sk-ant-')) {
      return accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Gets the path to the Claude CLI binary
 */
function getClaudePath(): string {
  try {
    execSync('which claude', { stdio: 'pipe' });
    return 'claude';
  } catch {
    return '$HOME/.claude/local/claude';
  }
}

/**
 * Runs the claude setup-token command interactively
 */
async function runClaudeSetupToken(): Promise<boolean> {
  try {
    logger.info('Running claude setup-token...');
    logger.info('Please follow the prompts to authenticate with your Claude subscription.');
    logger.newline();

    const claudePath = getClaudePath();

    const result = spawnSync(claudePath, ['setup-token'], {
      stdio: 'inherit',
      shell: '/bin/bash',
    });

    return result.status === 0;
  } catch {
    return false;
  }
}

export async function authCommand(options: AuthOptions): Promise<void> {
  logger.info('Setting up AI authentication for GitHub Actions...');
  logger.newline();

  // Check which secrets already exist
  const existingSecrets = getExistingSecrets();

  let useSubscription = false;

  // Step 1: Check if Claude CLI is available and ask about subscription
  if (isClaudeCLIInstalled()) {
    const answer = await promptForInput('Do you have a Claude subscription? (y/N): ');
    useSubscription = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  const secretName = useSubscription ? 'CLAUDE_CODE_OAUTH_TOKEN' : 'ANTHROPIC_API_KEY';
  const hasExistingSecret = useSubscription
    ? existingSecrets.hasAccessToken
    : existingSecrets.hasApiKey;

  // Check if the relevant secret already exists
  if (!options.force && hasExistingSecret) {
    logger.warn(`${secretName} is already set as a repository secret.`);
    const answer = await promptForInput('Do you want to overwrite it? (y/N): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      logger.info('Setup cancelled.');
      return;
    }
    logger.newline();
  }

  let token: string | null = null;

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
    token = getTokenFromKeychain();

    if (!token) {
      spinner.fail('Failed to extract token from keychain');
      logger.error('Could not find Claude token in keychain after setup.');
      logger.error('Please try running: claude setup-token');
      process.exit(1);
    }

    spinner.succeed('Successfully extracted token from keychain');
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

    if (!isValidApiKeyFormat(inputKey)) {
      logger.error('Invalid API key format. Key should start with "sk-ant-"');
      process.exit(1);
    }

    token = inputKey;
  }

  // Step 4: Set the GitHub secret
  logger.newline();
  const secretSpinner = ora(`Setting GitHub repository secret ${secretName}...`).start();

  try {
    setGitHubSecret(secretName, token);
    secretSpinner.succeed(`GitHub secret ${secretName} set successfully`);
  } catch (error) {
    secretSpinner.fail('Failed to set GitHub secret');
    logger.error((error as Error).message);
    process.exit(1);
  }

  logger.newline();
  logger.success('AI authentication setup complete!');
  logger.newline();
  logger.info(
    'Your workflows will use ' + (useSubscription ? 'your Claude subscription' : 'API access') + '.'
  );
  logger.newline();
  logger.info('Next steps:');
  logger.log('  1. Create agent files in .github/agents/');
  logger.log('  2. Run: repo-agents compile');
  logger.log('  3. Commit and push the generated workflows');
}
