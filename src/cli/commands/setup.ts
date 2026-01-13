import { execSync } from 'child_process';
import { logger } from '../utils/logger';
import { promptForInput } from '../utils/prompts';
import { authCommand } from './auth';
import { setupAppCommand } from './setup-app';

interface SetupOptions {
  force?: boolean;
  skipAuth?: boolean;
  skipApp?: boolean;
}

/**
 * Checks which GitHub secrets are already set
 */
function getExistingSecrets(): { hasApiKey: boolean; hasAccessToken: boolean } {
  try {
    const output = execSync('gh secret list --json name', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const secrets = JSON.parse(output);
    return {
      hasApiKey: secrets.some((s: { name: string }) => s.name === 'ANTHROPIC_API_KEY'),
      hasAccessToken: secrets.some((s: { name: string }) => s.name === 'CLAUDE_CODE_OAUTH_TOKEN'),
    };
  } catch {
    return { hasApiKey: false, hasAccessToken: false };
  }
}

/**
 * Checks if GitHub App secrets are already set
 */
function getExistingAppSecrets(): { hasAppId: boolean; hasPrivateKey: boolean } {
  try {
    const output = execSync('gh secret list --json name', {
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

/**
 * Checks if the repository is initialized with gh-claude
 */
function isRepoInitialized(): boolean {
  try {
    execSync('test -d .github/claude-agents', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Unified setup command that guides users through the entire setup process
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.info('              Welcome to gh-claude Setup Wizard                ');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();

  logger.info('This wizard will guide you through setting up gh-claude in your repository.');
  logger.newline();

  // Step 1: Check prerequisites
  logger.info('Step 1/4: Checking prerequisites...');
  logger.newline();

  if (!isGhAuthenticated()) {
    logger.error('✗ GitHub CLI is not authenticated');
    logger.error('  Please run: gh auth login');
    process.exit(1);
  }
  logger.success('✓ GitHub CLI is authenticated');

  const repoInitialized = isRepoInitialized();
  if (repoInitialized) {
    logger.success('✓ Repository is initialized with gh-claude');
  } else {
    logger.warn('✗ Repository is not initialized with gh-claude');
    const shouldInit = await promptForInput('  Would you like to initialize now? (Y/n): ');
    if (shouldInit.toLowerCase() !== 'n' && shouldInit.toLowerCase() !== 'no') {
      logger.info('  Initializing repository...');
      try {
        execSync('gh claude init --examples', { stdio: 'inherit' });
        logger.success('✓ Repository initialized successfully');
      } catch {
        logger.error('Failed to initialize repository');
        process.exit(1);
      }
    } else {
      logger.error('Cannot continue without initializing the repository');
      process.exit(1);
    }
  }

  logger.newline();

  // Step 2: Configure Claude authentication
  if (!options.skipAuth) {
    logger.info('Step 2/4: Configure Claude authentication...');
    logger.newline();

    const existingSecrets = getExistingSecrets();
    const hasAuth = existingSecrets.hasApiKey || existingSecrets.hasAccessToken;

    if (hasAuth && !options.force) {
      logger.success('✓ Claude authentication is already configured');
      if (existingSecrets.hasAccessToken) {
        logger.log('  Using: CLAUDE_CODE_OAUTH_TOKEN (subscription)');
      } else if (existingSecrets.hasApiKey) {
        logger.log('  Using: ANTHROPIC_API_KEY (API key)');
      }
      logger.newline();

      const reconfigure = await promptForInput('  Would you like to reconfigure? (y/N): ');
      if (reconfigure.toLowerCase() === 'y' || reconfigure.toLowerCase() === 'yes') {
        await authCommand({ force: true });
      }
    } else {
      logger.warn('✗ Claude authentication is not configured');
      logger.info('  Claude agents require authentication to run in GitHub Actions.');
      logger.newline();

      const shouldSetup = await promptForInput('  Configure Claude authentication now? (Y/n): ');
      if (shouldSetup.toLowerCase() !== 'n' && shouldSetup.toLowerCase() !== 'no') {
        await authCommand({ force: options.force });
      } else {
        logger.warn('  Skipping Claude authentication setup');
        logger.warn('  You can configure it later with: gh claude setup-token');
      }
    }
  } else {
    logger.info('Step 2/4: Skipping Claude authentication (--skip-auth)');
  }

  logger.newline();

  // Step 3: Configure GitHub App (optional)
  if (!options.skipApp) {
    logger.info('Step 3/4: Configure GitHub App (optional)...');
    logger.newline();

    logger.info('GitHub App provides:');
    logger.log('  • Branded identity for Claude (e.g., "Claude[bot]")');
    logger.log('  • Ability to trigger CI workflows from Claude-created PRs');
    logger.newline();

    const existingAppSecrets = getExistingAppSecrets();
    const hasApp = existingAppSecrets.hasAppId && existingAppSecrets.hasPrivateKey;

    if (hasApp && !options.force) {
      logger.success('✓ GitHub App is already configured');
      logger.newline();

      const reconfigure = await promptForInput('  Would you like to reconfigure? (y/N): ');
      if (reconfigure.toLowerCase() === 'y' || reconfigure.toLowerCase() === 'yes') {
        await setupAppCommand({ force: true });
      }
    } else {
      logger.warn('✗ GitHub App is not configured');
      logger.newline();

      const shouldSetup = await promptForInput('  Configure GitHub App now? (y/N): ');
      if (shouldSetup.toLowerCase() === 'y' || shouldSetup.toLowerCase() === 'yes') {
        await setupAppCommand({ force: options.force });
      } else {
        logger.warn('  Skipping GitHub App setup');
        logger.warn('  You can configure it later with: gh claude setup-app');
      }
    }
  } else {
    logger.info('Step 3/4: Skipping GitHub App setup (--skip-app)');
  }

  logger.newline();

  // Step 4: Next steps
  logger.info('Step 4/4: Next steps');
  logger.newline();

  logger.success("Setup complete! Here's what to do next:");
  logger.newline();

  logger.info('1. Create or add Claude agents:');
  logger.log('   • Create custom agents in .github/claude-agents/');
  logger.log('   • Or add from library: gh claude add');
  logger.newline();

  logger.info('2. Compile agents to workflows:');
  logger.log('   gh claude compile --all');
  logger.newline();

  logger.info('3. Commit and push:');
  logger.log('   git add .github/');
  logger.log('   git commit -m "Add Claude agents"');
  logger.log('   git push');
  logger.newline();

  logger.info('4. Test your agents:');
  logger.log('   • Open an issue or PR to trigger your agents');
  logger.log('   • Check the Actions tab for workflow runs');
  logger.newline();

  logger.info('═══════════════════════════════════════════════════════════════');
  logger.success('Happy automating with Claude! 🎉');
  logger.info('═══════════════════════════════════════════════════════════════');
  logger.newline();

  logger.info('Need help? Visit: https://github.com/anthropics/gh-claude');
}
