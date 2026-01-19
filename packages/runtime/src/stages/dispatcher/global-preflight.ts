import { createSign } from "node:crypto";
import type { StageResult } from "../../types";
import type { DispatcherContext } from "./types";

/**
 * Global preflight stage: Validates global dispatcher configuration.
 *
 * Checks:
 * 1. Claude API authentication (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)
 * 2. Generates GitHub App token (if GH_APP_ID and GH_APP_PRIVATE_KEY configured)
 * 3. Self-heals by creating issues on configuration errors
 * 4. Disables dispatcher workflow on errors
 *
 * Outputs:
 * - should-continue: "true" if config valid, "false" otherwise
 * - app-token: GitHub token (App token or GITHUB_TOKEN)
 * - git-user: Git user for commits
 * - git-email: Git email for commits
 */
export async function runGlobalPreflight(ctx: DispatcherContext): Promise<StageResult> {
  const outputs: Record<string, string> = {
    "should-continue": "false",
    "app-token": "",
    "git-user": "github-actions[bot]",
    "git-email": "github-actions[bot]@users.noreply.github.com",
  };

  try {
    // Step 1: Check Claude authentication
    const claudeAuthValid = checkClaudeAuth();
    if (!claudeAuthValid) {
      console.error("❌ Missing Claude authentication");
      await handleConfigurationError(
        ctx,
        "Missing Claude authentication (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)",
      );
      return {
        success: false,
        outputs,
      };
    }

    console.log("✓ Claude authentication configured");
    outputs["should-continue"] = "true";

    // Step 2: Generate GitHub App token (or use GITHUB_TOKEN)
    const tokenResult = await generateGitHubToken(ctx);
    outputs["app-token"] = tokenResult.token;
    outputs["git-user"] = tokenResult.gitUser;
    outputs["git-email"] = tokenResult.gitEmail;

    if (tokenResult.source === "app") {
      console.log(`✓ Generated GitHub App token for ${tokenResult.gitUser}`);
    } else {
      console.log("Using default GITHUB_TOKEN");
    }

    return {
      success: true,
      outputs,
    };
  } catch (error) {
    console.error("Global preflight failed:", error);
    return {
      success: false,
      outputs,
    };
  }
}

/**
 * Check if Claude authentication is configured.
 */
function checkClaudeAuth(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  return Boolean(apiKey || oauthToken);
}

/**
 * Generate GitHub App installation token or fall back to GITHUB_TOKEN.
 */
async function generateGitHubToken(ctx: DispatcherContext): Promise<{
  token: string;
  gitUser: string;
  gitEmail: string;
  source: "app" | "fallback";
}> {
  const appId = process.env.GH_APP_ID;
  const privateKey = process.env.GH_APP_PRIVATE_KEY;
  const fallbackToken = process.env.FALLBACK_TOKEN ?? process.env.GITHUB_TOKEN ?? "";

  // If no app configured, use fallback
  if (!appId || !privateKey) {
    return {
      token: fallbackToken,
      gitUser: "github-actions[bot]",
      gitEmail: "github-actions[bot]@users.noreply.github.com",
      source: "fallback",
    };
  }

  try {
    // Generate JWT
    const jwt = generateJWT(appId, privateKey);

    // Get installation ID
    const [owner, repo] = ctx.github.repository.split("/");
    const installationId = await getInstallationId(jwt, owner, repo);

    if (!installationId) {
      console.warn("Failed to get installation ID, falling back to GITHUB_TOKEN");
      return {
        token: fallbackToken,
        gitUser: "github-actions[bot]",
        gitEmail: "github-actions[bot]@users.noreply.github.com",
        source: "fallback",
      };
    }

    // Generate installation token
    const installationToken = await getInstallationToken(jwt, installationId);

    if (!installationToken) {
      console.warn("Failed to generate installation token, falling back to GITHUB_TOKEN");
      return {
        token: fallbackToken,
        gitUser: "github-actions[bot]",
        gitEmail: "github-actions[bot]@users.noreply.github.com",
        source: "fallback",
      };
    }

    // Get app info for git identity
    const appInfo = await getAppInfo(jwt);

    // Mask token in logs (GitHub Actions feature)
    console.log(`::add-mask::${installationToken}`);

    return {
      token: installationToken,
      gitUser: `${appInfo.slug}[bot]`,
      gitEmail: `${appInfo.id}+${appInfo.slug}[bot]@users.noreply.github.com`,
      source: "app",
    };
  } catch (error) {
    console.warn("Error generating GitHub App token:", error);
    return {
      token: fallbackToken,
      gitUser: "github-actions[bot]",
      gitEmail: "github-actions[bot]@users.noreply.github.com",
      source: "fallback",
    };
  }
}

/**
 * Generate JWT for GitHub App authentication.
 */
function generateJWT(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const iat = now - 60; // Issued 60 seconds ago (account for clock drift)
  const exp = now + 600; // Expires in 10 minutes

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iat,
    exp,
    iss: appId,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const sign = createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();

  const signature = sign.sign(privateKey, "base64");
  const signatureB64 = base64UrlEncode(Buffer.from(signature, "base64"));

  return `${unsigned}.${signatureB64}`;
}

/**
 * Base64 URL-safe encoding.
 */
function base64UrlEncode(data: string | Buffer): string {
  const base64 =
    typeof data === "string" ? Buffer.from(data).toString("base64") : data.toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Get installation ID for a repository.
 */
async function getInstallationId(jwt: string, owner: string, repo: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to get installation ID: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as { id?: number };
    return data.id ? String(data.id) : null;
  } catch (error) {
    console.warn("Error getting installation ID:", error);
    return null;
  }
}

/**
 * Generate installation access token.
 */
async function getInstallationToken(jwt: string, installationId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      console.warn(
        `Failed to generate installation token: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch (error) {
    console.warn("Error generating installation token:", error);
    return null;
  }
}

/**
 * Get app info for git identity.
 */
async function getAppInfo(jwt: string): Promise<{ slug: string; id: string }> {
  try {
    const response = await fetch("https://api.github.com/app", {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!response.ok) {
      return { slug: "github-app", id: "0" };
    }

    const data = (await response.json()) as { slug?: string; id?: number };
    return {
      slug: data.slug ?? "github-app",
      id: data.id ? String(data.id) : "0",
    };
  } catch {
    return { slug: "github-app", id: "0" };
  }
}

/**
 * Handle configuration error by creating issue and disabling workflow.
 */
async function handleConfigurationError(
  ctx: DispatcherContext,
  errorMessage: string,
): Promise<void> {
  try {
    const ghToken = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (!ghToken) {
      console.warn("No GitHub token available for self-healing");
      return;
    }

    // Check for existing configuration issue
    const repository = ctx.github.repository;
    const existingIssue = await findConfigurationIssue(repository, ghToken);

    const issueBody = `## Configuration Error

The Claude agent dispatcher detected missing configuration and has been disabled.

### Issues Found

${errorMessage}

### How to Fix

1. **Add Claude authentication:**
   \`\`\`bash
   repo-agents setup-token
   \`\`\`

2. **Re-enable the dispatcher:**
   \`\`\`bash
   gh workflow enable agent-dispatcher.yml
   \`\`\`

3. **Test the configuration:**
   \`\`\`bash
   gh workflow run agent-dispatcher.yml
   \`\`\`

---
*This issue was automatically created by the Claude agent dispatcher.*`;

    if (existingIssue) {
      // Update existing issue
      await addIssueComment(
        repository,
        existingIssue,
        `Configuration check failed again at ${new Date().toISOString()}:\n\n${errorMessage}`,
        ghToken,
      );
      console.log(`Updated existing configuration issue #${existingIssue}`);
    } else {
      // Create new issue
      const issueNumber = await createIssue(
        repository,
        "Claude Dispatcher: Configuration Required",
        issueBody,
        ["repo-agents-config"],
        ghToken,
      );
      console.log(`Created configuration issue #${issueNumber}`);
    }

    // Disable dispatcher workflow
    await disableWorkflow(repository, "agent-dispatcher.yml", ghToken);
    console.log("Dispatcher workflow disabled due to configuration errors");
  } catch (error) {
    console.warn("Failed to handle configuration error:", error);
  }
}

/**
 * Find existing configuration issue.
 */
async function findConfigurationIssue(repository: string, token: string): Promise<number | null> {
  try {
    const [owner, repo] = repository.split("/");
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=open&labels=repo-agents-config&per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const issues = (await response.json()) as Array<{ number: number }>;
    return issues.length > 0 ? issues[0].number : null;
  } catch {
    return null;
  }
}

/**
 * Create a new issue.
 */
async function createIssue(
  repository: string,
  title: string,
  body: string,
  labels: string[],
  token: string,
): Promise<number> {
  const [owner, repo] = repository.split("/");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body, labels }),
  });

  const data = (await response.json()) as { number: number };
  return data.number;
}

/**
 * Add comment to issue.
 */
async function addIssueComment(
  repository: string,
  issueNumber: number,
  comment: string,
  token: string,
): Promise<void> {
  const [owner, repo] = repository.split("/");
  await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ body: comment }),
  });
}

/**
 * Disable a workflow.
 */
async function disableWorkflow(
  repository: string,
  workflowFile: string,
  token: string,
): Promise<void> {
  const [owner, repo] = repository.split("/");
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/disable`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );
}
