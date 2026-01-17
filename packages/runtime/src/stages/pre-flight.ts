import { readFile } from "node:fs/promises";
import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { Stage, StageContext, StageResult } from "../types";
import { writeArtifact } from "../utils/artifacts";
import {
  getIssue,
  getPullRequest,
  getRecentWorkflowRuns,
  getRepositoryPermission,
  isOrgMember,
  isTeamMember,
  parseRepository,
} from "../utils/index";

/**
 * Validation status tracking for audit
 */
interface ValidationStatus {
  secrets_check: boolean;
  user_authorization: boolean;
  labels_check: boolean;
  rate_limit_check: boolean;
}

/**
 * Permission issue for audit tracking
 */
interface PermissionIssue {
  timestamp: string;
  issue_type: "missing_permission" | "path_restriction" | "rate_limit" | "validation_error";
  severity: "error" | "warning";
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Pre-flight stage: validates all preconditions before running the Claude agent.
 *
 * Checks:
 * 1. Load and validate agent definition
 * 2. Check Claude API secrets exist
 * 3. Verify user authorization (repo permission, org membership, allowed lists)
 * 4. Check trigger labels (if configured)
 * 5. Check rate limiting (time since last successful run)
 */
export const runPreFlight: Stage = async (ctx: StageContext): Promise<StageResult> => {
  const validationStatus: ValidationStatus = {
    secrets_check: false,
    user_authorization: false,
    labels_check: false,
    rate_limit_check: false,
  };
  const permissionIssues: PermissionIssue[] = [];

  const outputs: Record<string, string> = {
    "should-run": "false",
    "rate-limited": "false",
  };

  try {
    // Step 1: Load and validate agent definition
    const agent = await loadAgent(ctx.agentPath);

    // Step 2: Check secrets
    const secretsResult = checkSecrets();
    if (!secretsResult.valid) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "missing_permission",
        severity: "error",
        message: "No Claude authentication configured",
        context: { required: ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"] },
      });
      await writeAuditData(validationStatus, permissionIssues);
      return {
        success: false,
        outputs,
      };
    }
    validationStatus.secrets_check = true;
    console.log("Secrets check passed");

    // Step 3: Check user authorization
    const authResult = await checkUserAuthorization(ctx, agent);
    if (!authResult.authorized) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "missing_permission",
        severity: "error",
        message: "User not authorized to trigger agent",
        context: { user: ctx.actor, permission: authResult.permission },
      });
      await writeAuditData(validationStatus, permissionIssues);
      outputs["skip-reason"] = authResult.reason ?? "User not authorized";
      return {
        success: false,
        outputs,
      };
    }
    validationStatus.user_authorization = true;
    console.log(`User authorization passed: ${authResult.reason}`);

    // Step 4: Check trigger labels (if configured)
    if (agent.trigger_labels && agent.trigger_labels.length > 0) {
      const labelsResult = await checkTriggerLabels(ctx, agent.trigger_labels);
      if (!labelsResult.valid) {
        permissionIssues.push({
          timestamp: new Date().toISOString(),
          issue_type: "validation_error",
          severity: "error",
          message: "Required label not found",
          context: {
            required_labels: agent.trigger_labels,
            current_labels: labelsResult.currentLabels,
          },
        });
        await writeAuditData(validationStatus, permissionIssues);
        outputs["skip-reason"] = labelsResult.reason ?? "Required label not found";
        return {
          success: true, // Not an error, just skipped
          outputs,
          skipReason: labelsResult.reason,
        };
      }
      validationStatus.labels_check = true;
      console.log(`Labels check passed: found ${labelsResult.foundLabel}`);
    } else {
      validationStatus.labels_check = true;
    }

    // Step 5: Check rate limiting
    const rateLimitMinutes = agent.rate_limit_minutes ?? 5;
    const rateLimitResult = await checkRateLimit(ctx, rateLimitMinutes);
    if (!rateLimitResult.allowed) {
      validationStatus.rate_limit_check = true; // We checked it, it's just not allowing execution
      outputs["rate-limited"] = "true";
      outputs["skip-reason"] = rateLimitResult.reason ?? "Rate limit exceeded";
      await writeAuditData(validationStatus, permissionIssues);
      return {
        success: true, // Not an error, just rate limited
        outputs,
        skipReason: rateLimitResult.reason,
      };
    }
    validationStatus.rate_limit_check = true;
    console.log("Rate limit check passed");

    // All checks passed
    outputs["should-run"] = "true";
    await writeAuditData(validationStatus, permissionIssues);

    console.log("All validation checks passed");
    return {
      success: true,
      outputs,
      artifacts: [{ name: "validation-audit", path: "/tmp/artifacts/validation-audit" }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    permissionIssues.push({
      timestamp: new Date().toISOString(),
      issue_type: "validation_error",
      severity: "error",
      message: `Pre-flight check failed: ${errorMessage}`,
    });
    await writeAuditData(validationStatus, permissionIssues);
    return {
      success: false,
      outputs,
    };
  }
};

/**
 * Load and validate the agent definition from a markdown file.
 */
async function loadAgent(agentPath: string): Promise<AgentDefinition> {
  const result = await agentParser.parseFile(agentPath);

  if (result.errors.some((e) => e.severity === "error")) {
    const errorMessages = result.errors
      .filter((e) => e.severity === "error")
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`Agent validation failed: ${errorMessages}`);
  }

  if (!result.agent) {
    throw new Error("Failed to parse agent definition");
  }

  // Run additional business logic validation
  const validationErrors = agentParser.validateAgent(result.agent);
  if (validationErrors.some((e) => e.severity === "error")) {
    const errorMessages = validationErrors
      .filter((e) => e.severity === "error")
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`Agent validation failed: ${errorMessages}`);
  }

  return result.agent;
}

/**
 * Check that required secrets are available.
 */
function checkSecrets(): { valid: boolean; error?: string } {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  if (!anthropicKey && !oauthToken) {
    return {
      valid: false,
      error:
        "No Claude authentication found. Please set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN.",
    };
  }

  if (anthropicKey) {
    console.log("ANTHROPIC_API_KEY is configured");
  }
  if (oauthToken) {
    console.log("CLAUDE_CODE_OAUTH_TOKEN is configured");
  }

  return { valid: true };
}

/**
 * Check if the actor is authorized to trigger this agent.
 */
async function checkUserAuthorization(
  ctx: StageContext,
  agent: AgentDefinition,
): Promise<{ authorized: boolean; permission?: string; reason?: string }> {
  const { owner, repo } = parseRepository(ctx.repository);
  const actor = ctx.actor;

  // Combine allowed_users and allowed_actors
  const allowedUsers = [...(agent.allowed_users ?? []), ...(agent.allowed_actors ?? [])];
  const allowedTeams = agent.allowed_teams ?? [];

  // If no explicit restrictions, check repo permission
  if (allowedUsers.length === 0 && allowedTeams.length === 0) {
    // Default behavior: check repo permission level
    const permission = await getRepositoryPermission(owner, repo, actor);

    if (permission === "admin" || permission === "write") {
      return {
        authorized: true,
        permission,
        reason: `User has ${permission} permission`,
      };
    }

    // Also check if user is org member
    const isMember = await isOrgMember(owner, actor);
    if (isMember) {
      return {
        authorized: true,
        permission,
        reason: "User is organization member",
      };
    }

    return {
      authorized: false,
      permission,
      reason: `User @${actor} does not have sufficient permissions (has: ${permission})`,
    };
  }

  // Check explicit user list
  if (allowedUsers.includes(actor)) {
    return {
      authorized: true,
      reason: "User is in allowed users list",
    };
  }

  // Check team membership
  for (const team of allowedTeams) {
    const isMember = await isTeamMember(owner, team, actor);
    if (isMember) {
      return {
        authorized: true,
        reason: `User is a member of team ${team}`,
      };
    }
  }

  return {
    authorized: false,
    reason: `User @${actor} is not in allowed users or teams`,
  };
}

/**
 * Check if the issue/PR has at least one required trigger label.
 */
async function checkTriggerLabels(
  ctx: StageContext,
  requiredLabels: string[],
): Promise<{ valid: boolean; currentLabels?: string[]; foundLabel?: string; reason?: string }> {
  const { owner, repo } = parseRepository(ctx.repository);

  // Get issue or PR number from event
  const number = await getIssueOrPrNumber(ctx);

  if (!number) {
    console.log("No issue or PR number found, skipping label check");
    return { valid: true, reason: "No issue or PR to check labels" };
  }

  // Get current labels
  let currentLabels: string[] = [];
  try {
    if (ctx.eventName === "pull_request") {
      const pr = await getPullRequest(owner, repo, number);
      currentLabels = pr.labels;
    } else {
      const issue = await getIssue(owner, repo, number);
      currentLabels = issue.labels;
    }
  } catch (error) {
    console.log(`Failed to fetch labels: ${error}`);
    return { valid: false, currentLabels: [], reason: "Failed to fetch current labels" };
  }

  // Check for at least one required label
  for (const required of requiredLabels) {
    if (currentLabels.includes(required)) {
      return { valid: true, currentLabels, foundLabel: required };
    }
  }

  return {
    valid: false,
    currentLabels,
    reason: `Required label not found. Need one of: ${requiredLabels.join(", ")}`,
  };
}

/**
 * Check if enough time has passed since the last successful run.
 */
async function checkRateLimit(
  ctx: StageContext,
  rateLimitMinutes: number,
): Promise<{ allowed: boolean; reason?: string }> {
  // Bypass rate limit for manual workflow_dispatch runs
  if (ctx.eventName === "workflow_dispatch") {
    console.log("Manual run - bypassing rate limit check");
    return { allowed: true };
  }

  const { owner, repo } = parseRepository(ctx.repository);
  const workflowName = process.env.GITHUB_WORKFLOW ?? "";

  const recentRuns = await getRecentWorkflowRuns(owner, repo, workflowName, 5);

  if (recentRuns.length === 0) {
    return { allowed: true };
  }

  const now = Date.now();

  for (const run of recentRuns) {
    const runTime = new Date(run.created_at).getTime();
    const diffMinutes = (now - runTime) / (1000 * 60);

    if (diffMinutes < rateLimitMinutes) {
      return {
        allowed: false,
        reason: `Rate limit: Agent ran ${Math.floor(diffMinutes)} minutes ago. Minimum interval is ${rateLimitMinutes} minutes.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Extract issue or PR number from the event context.
 */
async function getIssueOrPrNumber(ctx: StageContext): Promise<number | undefined> {
  // Try to read from event payload
  try {
    const eventPath = ctx.eventPath;
    if (!eventPath) {
      return undefined;
    }

    const eventPayload = JSON.parse(await readFile(eventPath, "utf-8"));

    if (eventPayload.issue?.number) {
      return eventPayload.issue.number;
    }

    if (eventPayload.pull_request?.number) {
      return eventPayload.pull_request.number;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Write audit data to artifacts directory.
 */
async function writeAuditData(
  validationStatus: ValidationStatus,
  permissionIssues: PermissionIssue[],
): Promise<void> {
  await writeArtifact(
    "validation-audit",
    "validation-status.json",
    JSON.stringify(validationStatus, null, 2),
  );

  await writeArtifact(
    "validation-audit",
    "permission-issues.json",
    JSON.stringify(permissionIssues, null, 2),
  );
}
