import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { logger } from "@repo-agents/cli-utils/logger";
import ora from "ora";

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
 * Reads a private key from a file path
 */
function readPrivateKeyFile(filePath: string): string {
  const resolvedPath = resolve(filePath.replace(/^~/, process.env.HOME || ""));

  if (!existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  const content = readFileSync(resolvedPath, "utf-8");
  return content.trim();
}

/**
 * Validates a PEM private key format
 */
function isValidPrivateKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    (trimmed.startsWith("-----BEGIN RSA PRIVATE KEY-----") ||
      trimmed.startsWith("-----BEGIN PRIVATE KEY-----")) &&
    (trimmed.endsWith("-----END RSA PRIVATE KEY-----") ||
      trimmed.endsWith("-----END PRIVATE KEY-----"))
  );
}

/**
 * Checks if gh CLI is authenticated
 */
function isGhAuthenticated(): boolean {
  try {
    execSync("gh auth status", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

interface OwnerInfo {
  login: string;
  type: "User" | "Organization";
}

/**
 * Gets the owner info from the current repository
 */
function getOwnerFromRepo(): OwnerInfo | null {
  try {
    // Get owner login from repo
    const ownerOutput = execSync("gh repo view --json owner -q .owner.login", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const owner = ownerOutput.trim();

    // Check if the owner is an organization or user
    const typeOutput = execSync(`gh api users/${owner} --jq .type`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const type = typeOutput.trim() as "User" | "Organization";

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
      stdio: ["pipe", "inherit", "inherit"],
    });
  } catch {
    throw new Error(
      `Failed to set organization secret. Make sure you have admin access to the ${org} organization.`,
    );
  }
}

/**
 * Sets a GitHub repository secret
 */
function setRepoSecret(secretName: string, secretValue: string): void {
  try {
    execSync(`gh secret set ${secretName}`, {
      input: secretValue,
      stdio: ["pipe", "inherit", "inherit"],
    });
  } catch {
    throw new Error(
      "Failed to set repository secret. Make sure you have admin access to this repository.",
    );
  }
}

/**
 * Checks which GitHub App secrets are already set at org level
 */
function getExistingOrgSecrets(org: string): { hasAppId: boolean; hasPrivateKey: boolean } {
  try {
    const output = execSync(`gh secret list --org ${org} --json name`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const secrets = JSON.parse(output);
    return {
      hasAppId: secrets.some((s: { name: string }) => s.name === "GH_APP_ID"),
      hasPrivateKey: secrets.some((s: { name: string }) => s.name === "GH_APP_PRIVATE_KEY"),
    };
  } catch {
    return { hasAppId: false, hasPrivateKey: false };
  }
}

/**
 * Checks which GitHub App secrets are already set at repo level
 */
function getExistingRepoSecrets(): { hasAppId: boolean; hasPrivateKey: boolean } {
  try {
    const output = execSync("gh secret list --json name", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const secrets = JSON.parse(output);
    return {
      hasAppId: secrets.some((s: { name: string }) => s.name === "GH_APP_ID"),
      hasPrivateKey: secrets.some((s: { name: string }) => s.name === "GH_APP_PRIVATE_KEY"),
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
    const output = execSync("gh repo view --json url -q .url", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    return "https://github.com";
  }
}

/**
 * Displays the GitHub App creation guide
 */
function displaySetupGuide(owner: string, isOrg: boolean): void {
  const repoUrl = getRepoUrl();

  logger.newline();
  logger.info("═══════════════════════════════════════════════════════════════");
  logger.info("                    GitHub App Setup Guide                      ");
  logger.info("═══════════════════════════════════════════════════════════════");
  logger.newline();

  if (isOrg) {
    logger.info("Step 1: Create a new GitHub App for your organization");
    logger.log(`  Go to: https://github.com/organizations/${owner}/settings/apps/new`);
  } else {
    logger.info("Step 1: Create a new GitHub App for your account");
    logger.log("  Go to: https://github.com/settings/apps/new");
  }
  logger.newline();

  logger.info("Step 2: Configure the app with these settings:");
  logger.newline();
  logger.log(`  GitHub App name: (e.g., "${owner} Claude" or "Claude Agent")`);
  logger.log(`  Homepage URL: ${repoUrl}`);
  logger.newline();
  logger.log("  Webhook:");
  logger.log('    ☐ Uncheck "Active" (webhooks not needed)');
  logger.newline();

  logger.info("  Repository permissions (required):");
  logger.log("    • Contents:      Read and write");
  logger.log("    • Issues:        Read and write");
  logger.log("    • Pull requests: Read and write");
  logger.log("    • Metadata:      Read-only (auto-selected)");
  logger.log("    • Workflows:     Read and write (enables CI triggering)");
  logger.newline();

  logger.info("  Where can this GitHub App be installed?");
  logger.log("    ○ Only on this account");
  logger.newline();

  logger.info("Step 3: After creating the app:");
  logger.log('  1. Note the "App ID" shown on the settings page');
  logger.log('  2. Scroll down and click "Generate a private key"');
  logger.log("  3. Save the downloaded .pem file");
  logger.newline();

  logger.info("Step 4: Install the app on your repositories:");
  logger.log('  Go to: App settings → "Install App" → Select repositories');
  if (isOrg) {
    logger.log('  (You can select "All repositories" for org-wide coverage)');
  }
  logger.newline();

  logger.info("═══════════════════════════════════════════════════════════════");
  logger.newline();
}

export async function setupAppCommand(options: SetupAppOptions): Promise<void> {
  logger.info("Setting up GitHub App authentication for Claude agents...");
  logger.newline();

  // Check if gh CLI is authenticated
  if (!isGhAuthenticated()) {
    logger.error("GitHub CLI is not authenticated.");
    logger.error("Please run: gh auth login");
    process.exit(1);
  }

  // Determine the owner and whether it's an org or user
  let owner: string;
  let isOrg: boolean;

  if (options.org) {
    // Explicit org specified
    owner = options.org;
    isOrg = true;
    logger.info(`Organization: ${owner}`);
  } else {
    // Auto-detect from repo
    const ownerInfo = getOwnerFromRepo();
    if (!ownerInfo) {
      logger.error("Could not detect repository owner.");
      logger.error("Make sure you are in a git repository with a GitHub remote.");
      process.exit(1);
    }

    owner = ownerInfo.login;
    isOrg = ownerInfo.type === "Organization";

    if (isOrg) {
      logger.info(`Detected organization: ${owner}`);
    } else {
      logger.info(`Detected user: ${owner}`);
    }
  }

  if (isOrg) {
    logger.log(
      "Secrets will be stored as organization secrets (available to all repos in the org)",
    );
  } else {
    logger.log("Secrets will be stored as repository secrets (for this repo only)");
    logger.warn("To share across repos, use an organization or run setup-app in each repo.");
  }
  logger.newline();

  // Check which secrets already exist
  const existingSecrets = isOrg ? getExistingOrgSecrets(owner) : getExistingRepoSecrets();
  const hasExistingSecrets = existingSecrets.hasAppId || existingSecrets.hasPrivateKey;

  if (!options.force && hasExistingSecrets) {
    const location = isOrg ? `${owner} organization` : "this repository";
    logger.warn(`GitHub App secrets already exist in ${location}:`);
    if (existingSecrets.hasAppId) logger.log("  • GH_APP_ID");
    if (existingSecrets.hasPrivateKey) logger.log("  • GH_APP_PRIVATE_KEY");
    logger.newline();

    const answer = await promptForInput("Do you want to overwrite them? (y/N): ");
    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      logger.info("Setup cancelled.");
      return;
    }
    logger.newline();
  }

  // Display setup guide
  displaySetupGuide(owner, isOrg);

  // Offer to open browser
  const appCreationUrl = isOrg
    ? `https://github.com/organizations/${owner}/settings/apps/new`
    : "https://github.com/settings/apps/new";

  const openBrowser = await promptForInput("Open GitHub App creation page in browser? (Y/n): ");
  if (openBrowser.toLowerCase() !== "n" && openBrowser.toLowerCase() !== "no") {
    logger.info("Opening browser...");
    try {
      // Use 'open' on macOS, 'xdg-open' on Linux, 'start' on Windows
      const platform = process.platform;
      const openCmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
      execSync(`${openCmd} "${appCreationUrl}"`, { stdio: "ignore" });
    } catch {
      logger.warn(`Could not open browser. Please visit: ${appCreationUrl}`);
    }
    logger.newline();
  }

  const proceed = await promptForInput(
    "Have you created the GitHub App and downloaded the private key? (y/N): ",
  );
  if (proceed.toLowerCase() !== "y" && proceed.toLowerCase() !== "yes") {
    logger.info("Setup cancelled. Run this command again after creating your GitHub App.");
    return;
  }

  logger.newline();

  // Collect App ID
  const appId = await promptForInput("Enter your GitHub App ID: ");
  if (!appId || !/^\d+$/.test(appId)) {
    logger.error("Invalid App ID. The App ID should be a number (e.g., 123456).");
    process.exit(1);
  }

  logger.newline();

  // Collect Private Key via file path
  logger.info("Enter the path to your private key file (.pem file downloaded from GitHub):");
  logger.log("  Tip: You can drag and drop the file into the terminal");
  const keyFilePath = await promptForInput("Private key file path: ");

  if (!keyFilePath) {
    logger.error("No private key file path provided. Setup cancelled.");
    process.exit(1);
  }

  let privateKey: string;
  try {
    privateKey = readPrivateKeyFile(keyFilePath.trim().replace(/['"]|\\$/g, ""));
  } catch (error) {
    logger.error((error as Error).message);
    process.exit(1);
  }

  if (!isValidPrivateKey(privateKey)) {
    logger.error("Invalid private key format.");
    logger.error('The key should start with "-----BEGIN RSA PRIVATE KEY-----"');
    logger.error('and end with "-----END RSA PRIVATE KEY-----"');
    process.exit(1);
  }

  logger.newline();

  // Set secrets (org or repo level)
  const secretLocation = isOrg ? `${owner} organization secret` : "repository secret";

  const appIdSpinner = ora(`Setting GH_APP_ID as ${secretLocation}...`).start();
  try {
    if (isOrg) {
      setOrgSecret(owner, "GH_APP_ID", appId);
    } else {
      setRepoSecret("GH_APP_ID", appId);
    }
    appIdSpinner.succeed(`GH_APP_ID set as ${secretLocation}`);
  } catch (error) {
    appIdSpinner.fail("Failed to set GH_APP_ID secret");
    logger.error((error as Error).message);
    process.exit(1);
  }

  const keySpinner = ora(`Setting GH_APP_PRIVATE_KEY as ${secretLocation}...`).start();
  try {
    if (isOrg) {
      setOrgSecret(owner, "GH_APP_PRIVATE_KEY", privateKey);
    } else {
      setRepoSecret("GH_APP_PRIVATE_KEY", privateKey);
    }
    keySpinner.succeed(`GH_APP_PRIVATE_KEY set as ${secretLocation}`);
  } catch (error) {
    keySpinner.fail("Failed to set GH_APP_PRIVATE_KEY secret");
    logger.error((error as Error).message);
    process.exit(1);
  }

  logger.newline();
  logger.success("GitHub App authentication setup complete!");
  logger.newline();

  logger.info("What happens now:");
  if (isOrg) {
    logger.log(`  • All repositories in ${owner} can now use these secrets`);
  } else {
    logger.log("  • This repository can now use your GitHub App");
  }
  logger.log("  • Generated workflows will automatically use your GitHub App");
  logger.log('  • Commits and comments will appear as your app (e.g., "Claude[bot]")');
  logger.log("  • PRs created by Claude agents will trigger CI workflows");
  logger.newline();

  logger.info("Important reminders:");
  logger.log("  • Make sure the app is installed on this repository");
  logger.log("  • Re-compile your agents: gh claude compile --all");
  logger.newline();

  if (isOrg) {
    logger.info("To install the app on more repositories:");
    logger.log(`  Go to: https://github.com/organizations/${owner}/settings/installations`);
  } else {
    logger.info("To use in other repositories:");
    logger.log("  Run: gh claude setup-app (in each repository)");
  }
}
