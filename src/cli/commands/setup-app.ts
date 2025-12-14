import { execSync } from 'child_process';
import ora from 'ora';
import { logger } from '../utils/logger';
import * as readline from 'readline';

interface SetupAppOptions {
  force?: boolean;
  org?: string;
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
 * Prompts for multiline input (for private key)
 */
function promptForMultilineInput(prompt: string, endMarker: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    logger.info(prompt);
    logger.log(`(End with a line containing only "${endMarker}")`);
    logger.newline();

    const lines: string[] = [];
    rl.on('line', (line) => {
      if (line.trim() === endMarker) {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}

/**
 * Validates a PEM private key format
 */
function isValidPrivateKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    (trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') ||
      trimmed.startsWith('-----BEGIN PRIVATE KEY-----')) &&
    (trimmed.endsWith('-----END RSA PRIVATE KEY-----') ||
      trimmed.endsWith('-----END PRIVATE KEY-----'))
  );
}

/**
 * Checks if gh CLI is authenticated
 */
function isGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

interface OwnerInfo {
  login: string;
  type: 'User' | 'Organization';
}

/**
 * Gets the owner info from the current repository
 */
function getOwnerFromRepo(): OwnerInfo | null {
  try {
    // Get owner login from repo
    const ownerOutput = execSync('gh repo view --json owner -q .owner.login', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const owner = ownerOutput.trim();

    // Check if the owner is an organization or user
    const typeOutput = execSync(`gh api users/${owner} --jq .type`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const type = typeOutput.trim() as 'User' | 'Organization';

    return { login: owner, type };
  } catch {
    return null;
  }
}

/**
 * Sets a GitHub organization secret
 */
function setOrgSecret(org: string, secretName: string, secretValue: string): void {
  try {
    execSync(`gh secret set ${secretName} --org ${org} --visibility all`, {
      input: secretValue,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch {
    throw new Error(
      `Failed to set organization secret. Make sure you have admin access to the ${org} organization.`
    );
  }
}

/**
 * Checks which GitHub App secrets are already set at org level
 */
function getExistingOrgSecrets(org: string): { hasAppId: boolean; hasPrivateKey: boolean } {
  try {
    const output = execSync(`gh secret list --org ${org} --json name`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output);
    return {
      hasAppId: secrets.some((s: { name: string }) => s.name === 'GH_APP_ID'),
      hasPrivateKey: secrets.some((s: { name: string }) => s.name === 'GH_APP_PRIVATE_KEY'),
    };
  } catch {
    return { hasAppId: false, hasPrivateKey: false };
  }
}

/**
 * Gets the current repository URL for the homepage
 */
function getRepoUrl(): string {
  try {
    const output = execSync('gh repo view --json url -q .url', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim();
  } catch {
    return 'https://github.com';
  }
}

/**
 * Displays the GitHub App creation guide
 */
function displaySetupGuide(owner: string, isOrg: boolean): void {
  const repoUrl = getRepoUrl();

  logger.newline();
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('                    GitHub App Setup Guide                      ');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();

  if (isOrg) {
    logger.info('Step 1: Create a new GitHub App for your organization');
    logger.log(`  Go to: https://github.com/organizations/${owner}/settings/apps/new`);
  } else {
    logger.info('Step 1: Create a new GitHub App for your account');
    logger.log('  Go to: https://github.com/settings/apps/new');
  }
  logger.newline();

  logger.info('Step 2: Configure the app with these settings:');
  logger.newline();
  logger.log(`  GitHub App name: (e.g., "${owner} Claude" or "Claude Agent")`);
  logger.log(`  Homepage URL: ${repoUrl}`);
  logger.newline();
  logger.log('  Webhook:');
  logger.log('    ☐ Uncheck "Active" (webhooks not needed)');
  logger.newline();

  logger.info('  Repository permissions (required):');
  logger.log('    • Contents:      Read and write');
  logger.log('    • Issues:        Read and write');
  logger.log('    • Pull requests: Read and write');
  logger.log('    • Metadata:      Read-only (auto-selected)');
  logger.log('    • Workflows:     Read and write (enables CI triggering)');
  logger.newline();

  logger.info('  Where can this GitHub App be installed?');
  logger.log('    ○ Only on this account');
  logger.newline();

  logger.info('Step 3: After creating the app:');
  logger.log('  1. Note the "App ID" shown on the settings page');
  logger.log('  2. Scroll down and click "Generate a private key"');
  logger.log('  3. Save the downloaded .pem file');
  logger.newline();

  logger.info('Step 4: Install the app on your repositories:');
  logger.log('  Go to: App settings → "Install App" → Select repositories');
  if (isOrg) {
    logger.log('  (You can select "All repositories" for org-wide coverage)');
  }
  logger.newline();

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();
}

export async function setupAppCommand(options: SetupAppOptions): Promise<void> {
  logger.info('Setting up GitHub App authentication for Claude agents...');
  logger.newline();

  // Check if gh CLI is authenticated
  if (!isGhAuthenticated()) {
    logger.error('GitHub CLI is not authenticated.');
    logger.error('Please run: gh auth login');
    process.exit(1);
  }

  // Determine the organization for storing secrets
  let org: string;

  if (options.org) {
    // Explicit org specified
    org = options.org;
    logger.info(`Organization: ${org}`);
  } else {
    // Auto-detect from repo
    const ownerInfo = getOwnerFromRepo();
    if (!ownerInfo) {
      logger.error('Could not detect repository owner.');
      logger.error('Make sure you are in a git repository with a GitHub remote.');
      process.exit(1);
    }

    if (ownerInfo.type === 'Organization') {
      org = ownerInfo.login;
      logger.info(`Detected organization: ${org}`);
    } else {
      // User-owned repo - need to prompt for organization
      logger.info(`Repository owner: ${ownerInfo.login} (personal account)`);
      logger.newline();
      logger.warn(
        'GitHub App secrets must be stored as organization secrets to be shared across repos.'
      );
      logger.log('Personal accounts cannot have organization secrets.');
      logger.newline();

      const orgName = await promptForInput(
        'Enter the organization name where secrets should be stored (or press Enter to cancel): '
      );
      if (!orgName) {
        logger.info('Setup cancelled.');
        logger.log('To use organization secrets, either:');
        logger.log('  1. Run this command with --org <organization>');
        logger.log('  2. Create a GitHub organization and transfer your repos there');
        return;
      }
      org = orgName;
      logger.newline();
      logger.info(`Using organization: ${org}`);
    }
  }

  logger.log('Secrets will be stored as organization secrets (available to all repos in the org)');
  logger.newline();

  // Check which secrets already exist
  const existingSecrets = getExistingOrgSecrets(org);
  const hasExistingSecrets = existingSecrets.hasAppId || existingSecrets.hasPrivateKey;

  if (!options.force && hasExistingSecrets) {
    logger.warn(`GitHub App secrets already exist in ${org} organization:`);
    if (existingSecrets.hasAppId) logger.log('  • GH_APP_ID');
    if (existingSecrets.hasPrivateKey) logger.log('  • GH_APP_PRIVATE_KEY');
    logger.newline();

    const answer = await promptForInput('Do you want to overwrite them? (y/N): ');
    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      logger.info('Setup cancelled.');
      return;
    }
    logger.newline();
  }

  // Display setup guide (always for organization)
  displaySetupGuide(org, true);

  // Offer to open browser (org app creation page)
  const appCreationUrl = `https://github.com/organizations/${org}/settings/apps/new`;

  const openBrowser = await promptForInput('Open GitHub App creation page in browser? (Y/n): ');
  if (openBrowser.toLowerCase() !== 'n' && openBrowser.toLowerCase() !== 'no') {
    logger.info('Opening browser...');
    try {
      // Use 'open' on macOS, 'xdg-open' on Linux, 'start' on Windows
      const platform = process.platform;
      const openCmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      execSync(`${openCmd} "${appCreationUrl}"`, { stdio: 'ignore' });
    } catch {
      logger.warn(`Could not open browser. Please visit: ${appCreationUrl}`);
    }
    logger.newline();
  }

  const proceed = await promptForInput(
    'Have you created the GitHub App and downloaded the private key? (y/N): '
  );
  if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
    logger.info('Setup cancelled. Run this command again after creating your GitHub App.');
    return;
  }

  logger.newline();

  // Collect App ID
  const appId = await promptForInput('Enter your GitHub App ID: ');
  if (!appId || !/^\d+$/.test(appId)) {
    logger.error('Invalid App ID. The App ID should be a number (e.g., 123456).');
    process.exit(1);
  }

  logger.newline();

  // Collect Private Key
  logger.info('Enter your private key (paste the contents of the .pem file):');
  const privateKey = await promptForMultilineInput(
    'Paste the entire contents of your .pem file:',
    'END'
  );

  if (!privateKey) {
    logger.error('No private key provided. Setup cancelled.');
    process.exit(1);
  }

  // Reconstruct the key with proper ending if user typed END
  const fullPrivateKey = privateKey.includes('-----END')
    ? privateKey
    : privateKey + '\n-----END RSA PRIVATE KEY-----';

  if (!isValidPrivateKey(fullPrivateKey)) {
    logger.error('Invalid private key format.');
    logger.error('The key should start with "-----BEGIN RSA PRIVATE KEY-----"');
    logger.error('and end with "-----END RSA PRIVATE KEY-----"');
    process.exit(1);
  }

  logger.newline();

  // Set secrets as organization secrets
  const appIdSpinner = ora(`Setting GH_APP_ID as ${org} organization secret...`).start();
  try {
    setOrgSecret(org, 'GH_APP_ID', appId);
    appIdSpinner.succeed(`GH_APP_ID set as ${org} organization secret`);
  } catch (error) {
    appIdSpinner.fail('Failed to set GH_APP_ID secret');
    logger.error((error as Error).message);
    process.exit(1);
  }

  const keySpinner = ora(`Setting GH_APP_PRIVATE_KEY as ${org} organization secret...`).start();
  try {
    setOrgSecret(org, 'GH_APP_PRIVATE_KEY', fullPrivateKey);
    keySpinner.succeed(`GH_APP_PRIVATE_KEY set as ${org} organization secret`);
  } catch (error) {
    keySpinner.fail('Failed to set GH_APP_PRIVATE_KEY secret');
    logger.error((error as Error).message);
    process.exit(1);
  }

  logger.newline();
  logger.success('GitHub App authentication setup complete!');
  logger.newline();

  logger.info('What happens now:');
  logger.log(`  • All repositories in ${org} can now use these secrets`);
  logger.log('  • Generated workflows will automatically use your GitHub App');
  logger.log('  • Commits and comments will appear as your app (e.g., "Claude[bot]")');
  logger.log('  • PRs created by Claude agents will trigger CI workflows');
  logger.newline();

  logger.info('Important reminders:');
  logger.log('  • Make sure the app is installed on the repositories where you want to use it');
  logger.log('  • Re-compile your agents: gh claude compile --all');
  logger.newline();

  logger.info('To install the app on more repositories:');
  logger.log(`  Go to: https://github.com/organizations/${org}/settings/installations`);
}
