import { createSign } from "node:crypto";
import type { Stage, StageContext, StageResult } from "../types";

/**
 * Setup stage: First stage in agent workflow.
 *
 * Responsibilities:
 * 1. Generate GitHub App token (if GH_APP_ID and GH_APP_PRIVATE_KEY configured)
 * 2. Validate Claude authentication exists
 *
 * Outputs:
 * - should-continue: "true" if setup succeeded
 * - app-token: GitHub token (App token or GITHUB_TOKEN)
 * - git-user: Git user for commits
 * - git-email: Git email for commits
 */
export const runSetup: Stage = async (ctx: StageContext): Promise<StageResult> => {
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
      console.error("Please set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN");
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
    console.error("Setup stage failed:", error);
    return {
      success: false,
      outputs,
    };
  }
};

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
async function generateGitHubToken(ctx: StageContext): Promise<{
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
    const [owner, repo] = ctx.repository.split("/");
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
