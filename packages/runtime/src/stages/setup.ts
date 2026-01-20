import type { Stage, StageContext, StageResult } from "../types";

/**
 * Setup stage: First stage in agent workflow.
 *
 * Responsibilities:
 * 1. Validate Claude authentication exists
 *
 * Outputs:
 * - should-continue: "true" if setup succeeded
 *
 * Note: GitHub App token generation now happens per-job using actions/create-github-app-token
 */
export const runSetup: Stage = async (_ctx: StageContext): Promise<StageResult> => {
  const outputs: Record<string, string> = {
    "should-continue": "false",
  };

  try {
    // Check Claude authentication
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
