import { execSync } from "node:child_process";
import { logger } from "@repo-agents/cli-utils/logger";
import { promptForInput } from "@repo-agents/cli-utils/prompts";
import {
  getExistingAppSecrets,
  getExistingSecrets,
  isGhAuthenticated,
  setGitHubSecret,
} from "@repo-agents/cli-utils/secrets";
import ora from "ora";
import { setupAppCommand } from "./setup-app";

interface SetupOptions {
  force?: boolean;
  skipAuth?: boolean;
  skipApp?: boolean;
}

/**
 * Validates an API key format (basic check)
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  return apiKey.startsWith("sk-ant-") && apiKey.length > 20;
}

/**
 * Configures the Anthropic API key as a GitHub secret
 */
async function configureApiKey(options: { force?: boolean }): Promise<void> {
  const existingSecrets = getExistingSecrets();

  if (existingSecrets.hasApiKey && !options.force) {
    logger.success("API key already configured");
    return;
  }

  logger.info("You can get an API key from: https://console.anthropic.com/settings/keys");
  logger.newline();

  const apiKey = await promptForInput("Enter your Anthropic API key: ");

  if (!apiKey) {
    logger.error("No API key provided. Setup cancelled.");
    process.exit(1);
  }

  if (!isValidApiKeyFormat(apiKey)) {
    logger.error('Invalid API key format. Key should start with "sk-ant-"');
    process.exit(1);
  }

  const spinner = ora("Setting GitHub repository secret ANTHROPIC_API_KEY...").start();

  try {
    setGitHubSecret("ANTHROPIC_API_KEY", apiKey);
    spinner.succeed("GitHub secret ANTHROPIC_API_KEY set successfully");
  } catch (error) {
    spinner.fail("Failed to set GitHub secret");
    logger.error((error as Error).message);
    process.exit(1);
  }

  logger.newline();
  logger.success("API key configured successfully!");
}

/**
 * Checks if the repository is initialized with Repo Agents
 */
function isRepoInitialized(): boolean {
  try {
    execSync("test -d .github/agents", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Unified setup command that guides users through the entire setup process
 */
export async function setupCommand(options: SetupOptions): Promise<void> {
  logger.info("═══════════════════════════════════════════════════════════════");
  logger.info("              Welcome to Repo Agents Setup Wizard              ");
  logger.info("═══════════════════════════════════════════════════════════════");
  logger.newline();

  logger.info("This wizard will guide you through setting up Repo Agents in your repository.");
  logger.newline();

  // Step 1: Check prerequisites
  logger.info("Step 1/4: Checking prerequisites...");
  logger.newline();

  if (!isGhAuthenticated()) {
    logger.error("✗ GitHub CLI is not authenticated");
    logger.error("  Please run: gh auth login");
    process.exit(1);
  }
  logger.success("✓ GitHub CLI is authenticated");

  const repoInitialized = isRepoInitialized();
  if (repoInitialized) {
    logger.success("✓ Repository is initialized with Repo Agents");
  } else {
    logger.warn("✗ Repository is not initialized with Repo Agents");
    const shouldInit = await promptForInput("  Would you like to initialize now? (Y/n): ");
    if (shouldInit.toLowerCase() !== "n" && shouldInit.toLowerCase() !== "no") {
      logger.info("  Initializing repository...");
      try {
        execSync("repo-agents init --examples", { stdio: "inherit" });
        logger.success("✓ Repository initialized successfully");
      } catch {
        logger.error("Failed to initialize repository");
        process.exit(1);
      }
    } else {
      logger.error("Cannot continue without initializing the repository");
      process.exit(1);
    }
  }

  logger.newline();

  // Step 2: Configure Claude authentication
  if (!options.skipAuth) {
    logger.info("Step 2/4: Configure AI authentication...");
    logger.newline();

    const existingSecrets = getExistingSecrets();
    const hasAuth = existingSecrets.hasApiKey || existingSecrets.hasAccessToken;

    if (hasAuth && !options.force) {
      logger.success("✓ AI authentication is already configured");
      if (existingSecrets.hasAccessToken) {
        logger.log("  Using: CLAUDE_CODE_OAUTH_TOKEN (subscription)");
      } else if (existingSecrets.hasApiKey) {
        logger.log("  Using: ANTHROPIC_API_KEY (API key)");
      }
      logger.newline();

      const reconfigure = await promptForInput("  Would you like to reconfigure? (y/N): ");
      if (reconfigure.toLowerCase() === "y" || reconfigure.toLowerCase() === "yes") {
        await configureApiKey({ force: true });
      }
    } else {
      logger.warn("✗ AI authentication is not configured");
      logger.info("  Agents require authentication to run in GitHub Actions.");
      logger.newline();

      const shouldSetup = await promptForInput("  Configure AI authentication now? (Y/n): ");
      if (shouldSetup.toLowerCase() !== "n" && shouldSetup.toLowerCase() !== "no") {
        await configureApiKey({ force: options.force });
      } else {
        logger.warn("  Skipping AI authentication setup");
        logger.warn("  You can configure it later with: repo-agents setup");
      }
    }
  } else {
    logger.info("Step 2/4: Skipping AI authentication (--skip-auth)");
  }

  logger.newline();

  // Step 3: Configure GitHub App (optional)
  if (!options.skipApp) {
    logger.info("Step 3/4: Configure GitHub App (optional)...");
    logger.newline();

    logger.info("GitHub App provides:");
    logger.log('  • Branded identity for your agent (e.g., "YourApp[bot]")');
    logger.log("  • Ability to trigger CI workflows from agent-created PRs");
    logger.newline();

    const existingAppSecrets = getExistingAppSecrets();
    const hasApp = existingAppSecrets.hasAppId && existingAppSecrets.hasPrivateKey;

    if (hasApp && !options.force) {
      logger.success("✓ GitHub App is already configured");
      logger.newline();

      const reconfigure = await promptForInput("  Would you like to reconfigure? (y/N): ");
      if (reconfigure.toLowerCase() === "y" || reconfigure.toLowerCase() === "yes") {
        await setupAppCommand({ force: true });
      }
    } else {
      logger.warn("✗ GitHub App is not configured");
      logger.newline();

      const shouldSetup = await promptForInput("  Configure GitHub App now? (y/N): ");
      if (shouldSetup.toLowerCase() === "y" || shouldSetup.toLowerCase() === "yes") {
        await setupAppCommand({ force: options.force });
      } else {
        logger.warn("  Skipping GitHub App setup");
        logger.warn("  You can configure it later with: repo-agents setup-app");
      }
    }
  } else {
    logger.info("Step 3/4: Skipping GitHub App setup (--skip-app)");
  }

  logger.newline();

  // Step 4: Next steps
  logger.info("Step 4/4: Next steps");
  logger.newline();

  logger.success("Setup complete! Here's what to do next:");
  logger.newline();

  logger.info("1. Create or add agents:");
  logger.log("   • Create custom agents in .github/agents/");
  logger.log("   • Or add from library: repo-agents add");
  logger.newline();

  logger.info("2. Compile agents to workflows:");
  logger.log("   repo-agents compile");
  logger.newline();

  logger.info("3. Commit and push:");
  logger.log("   git add .github/");
  logger.log('   git commit -m "Add agents"');
  logger.log("   git push");
  logger.newline();

  logger.info("4. Test your agents:");
  logger.log("   • Open an issue or PR to trigger your agents");
  logger.log("   • Check the Actions tab for workflow runs");
  logger.newline();

  logger.info("═══════════════════════════════════════════════════════════════");
  logger.success("Happy automating!");
  logger.info("═══════════════════════════════════════════════════════════════");
  logger.newline();

  logger.info("Need help? Visit: https://github.com/lucasilverentand/repo-agents");
}
