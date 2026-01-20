import type { StageResult } from "../../types";
import type { DispatcherContext } from "./types";

/**
 * Global preflight stage: Validates global dispatcher configuration.
 *
 * Checks:
 * 1. Claude API authentication (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)
 * 2. Self-heals by creating issues on configuration errors
 * 3. Disables dispatcher workflow on errors
 *
 * Note: GitHub App token generation has been moved to agent workflows (setup stage).
 *
 * Outputs:
 * - should-continue: "true" if config valid, "false" otherwise
 */
export async function runGlobalPreflight(ctx: DispatcherContext): Promise<StageResult> {
  const outputs: Record<string, string> = {
    "should-continue": "false",
  };

  try {
    // Check Claude authentication
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

The agent dispatcher detected missing configuration and has been disabled.

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
*This issue was automatically created by the agent dispatcher.*`;

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
