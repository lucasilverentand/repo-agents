import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { StageResult } from "../../types";
import { writeArtifact } from "../../utils/artifacts";
import {
  getRecentWorkflowRuns,
  getRepositoryPermission,
  isOrgMember,
  isTeamMember,
  parseRepository,
} from "../../utils/index";
import type { DispatcherContext } from "./types";

/**
 * Validation status tracking for audit
 */
interface ValidationStatus {
  agent_loaded: boolean;
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
 * Dispatch stage: Per-agent validation before triggering agent workflow.
 *
 * Validates:
 * 1. Agent definition can be loaded
 * 2. User authorization (repo permission, org membership, allowed lists)
 * 3. Trigger labels (if configured)
 * 4. Rate limiting (time since last successful run)
 *
 * Outputs:
 * - should-run: "true" if all checks pass, "false" otherwise
 * - skip-reason: Reason for skipping (if should-run is false)
 * - rate-limited: "true" if skipped due to rate limit
 *
 * Creates validation audit artifact for tracking.
 */
export async function runDispatch(ctx: DispatcherContext): Promise<StageResult> {
  const validationStatus: ValidationStatus = {
    agent_loaded: false,
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
    const agentPath = ctx.options?.agentPath;
    if (!agentPath) {
      throw new Error("Agent path is required");
    }

    const agent = await loadAgent(agentPath);
    validationStatus.agent_loaded = true;
    console.log(`✓ Loaded agent: ${agent.name}`);

    // Step 2: Check user authorization
    const authResult = await checkUserAuthorization(ctx, agent);
    if (!authResult.authorized) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "missing_permission",
        severity: "error",
        message: "User not authorized to trigger agent",
        context: { user: ctx.github.actor, permission: authResult.permission },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = authResult.reason ?? "User not authorized";
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.user_authorization = true;
    console.log(`✓ User authorized: ${ctx.github.actor}`);

    // Step 3: Check trigger labels (if configured)
    const labelsResult = await checkTriggerLabels(ctx, agent);
    if (!labelsResult.valid) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "validation_error",
        severity: "warning",
        message: "Required trigger labels not present",
        context: { required: agent.trigger_labels, present: labelsResult.presentLabels },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = labelsResult.reason ?? "Required labels not present";
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.labels_check = true;
    console.log("✓ Trigger labels check passed");

    // Step 4: Check rate limiting
    const rateLimitResult = await checkRateLimit(ctx, agent);
    if (!rateLimitResult.allowed) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "rate_limit",
        severity: "warning",
        message: "Rate limit exceeded",
        context: {
          lastRun: rateLimitResult.lastRun,
          limitMinutes: agent.rate_limit_minutes ?? 5,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = rateLimitResult.reason ?? "Rate limit exceeded";
      outputs["rate-limited"] = "true";
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.rate_limit_check = true;
    console.log("✓ Rate limit check passed");

    // All checks passed
    await writeAuditData(validationStatus, permissionIssues, agent.name);
    outputs["should-run"] = "true";
    console.log(`✓ All pre-flight checks passed for ${agent.name}`);

    return {
      success: true,
      outputs,
    };
  } catch (error) {
    console.error("Dispatch validation failed:", error);
    permissionIssues.push({
      timestamp: new Date().toISOString(),
      issue_type: "validation_error",
      severity: "error",
      message: `Validation error: ${(error as Error).message}`,
    });
    await writeAuditData(validationStatus, permissionIssues, "unknown");
    outputs["skip-reason"] = `Validation error: ${(error as Error).message}`;
    return {
      success: false,
      outputs,
    };
  }
}

/**
 * Load and validate agent definition.
 */
async function loadAgent(agentPath: string): Promise<AgentDefinition> {
  const { agent, errors } = await agentParser.parseFile(agentPath);

  if (errors.length > 0) {
    throw new Error(`Agent validation failed: ${errors[0].message}`);
  }

  if (!agent) {
    throw new Error("Failed to parse agent definition");
  }

  return agent;
}

/**
 * Check user authorization.
 */
async function checkUserAuthorization(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{ authorized: boolean; reason?: string; permission?: string }> {
  const actor = ctx.github.actor;
  const repository = ctx.github.repository;

  // Check allowed-users list
  if (agent.allowed_users && agent.allowed_users.length > 0) {
    if (agent.allowed_users.includes(actor)) {
      return { authorized: true };
    }
  }

  // Check allowed-actors (same as allowed-users, for compatibility)
  if (agent.allowed_actors && agent.allowed_actors.length > 0) {
    if (agent.allowed_actors.includes(actor)) {
      return { authorized: true };
    }
  }

  // Check team membership
  if (agent.allowed_teams && agent.allowed_teams.length > 0) {
    const { owner } = parseRepository(repository);
    for (const team of agent.allowed_teams) {
      if (await isTeamMember(owner, team, actor)) {
        return { authorized: true };
      }
    }
  }

  // Check org membership (if no specific users/teams configured)
  const { owner, repo } = parseRepository(repository);
  if (await isOrgMember(owner, actor)) {
    // Check repository permission level
    const permission = await getRepositoryPermission(owner, repo, actor);
    if (permission === "admin" || permission === "write") {
      return { authorized: true, permission };
    }
    return {
      authorized: false,
      reason: `User ${actor} has read-only access`,
      permission,
    };
  }

  return {
    authorized: false,
    reason: `User ${actor} is not authorized`,
  };
}

/**
 * Check trigger labels.
 */
async function checkTriggerLabels(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{ valid: boolean; reason?: string; presentLabels?: string[] }> {
  // If no trigger labels configured, always valid
  if (!agent.trigger_labels || agent.trigger_labels.length === 0) {
    return { valid: true };
  }

  const eventName = ctx.github.eventName;

  // Only issues and pull_request events have labels
  if (eventName !== "issues" && eventName !== "pull_request") {
    return { valid: true };
  }

  // Get labels from event
  let labels: string[] = [];
  try {
    if (eventName === "issues") {
      const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
        issue?: { labels?: Array<{ name: string }> };
      };
      labels = eventPayload.issue?.labels?.map((l) => l.name) ?? [];
    } else if (eventName === "pull_request") {
      const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
        pull_request?: { labels?: Array<{ name: string }> };
      };
      labels = eventPayload.pull_request?.labels?.map((l) => l.name) ?? [];
    }
  } catch (error) {
    console.warn("Failed to read event labels:", error);
    return { valid: false, reason: "Failed to read event labels" };
  }

  // Check if all required labels are present
  const missingLabels = agent.trigger_labels.filter((label) => !labels.includes(label));
  if (missingLabels.length > 0) {
    return {
      valid: false,
      reason: `Missing required labels: ${missingLabels.join(", ")}`,
      presentLabels: labels,
    };
  }

  return { valid: true, presentLabels: labels };
}

/**
 * Check rate limiting.
 */
async function checkRateLimit(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{ allowed: boolean; reason?: string; lastRun?: string }> {
  const rateLimitMinutes = agent.rate_limit_minutes ?? 5;

  // Get recent workflow runs for this agent
  const workflowFile = ctx.options?.workflowFile ?? `agent-${agent.name}.yml`;
  const { owner, repo } = parseRepository(ctx.github.repository);

  try {
    const recentRuns = await getRecentWorkflowRuns(owner, repo, workflowFile);

    if (recentRuns.length === 0) {
      return { allowed: true };
    }

    // Check most recent successful run
    const lastSuccessfulRun = recentRuns.find((run) => run.conclusion === "success");
    if (!lastSuccessfulRun) {
      return { allowed: true };
    }

    const lastRunTime = new Date(lastSuccessfulRun.created_at).getTime();
    const now = Date.now();
    const minutesSinceLastRun = (now - lastRunTime) / 1000 / 60;

    if (minutesSinceLastRun < rateLimitMinutes) {
      return {
        allowed: false,
        reason: `Rate limit: ${Math.ceil(rateLimitMinutes - minutesSinceLastRun)} minutes remaining`,
        lastRun: lastSuccessfulRun.created_at,
      };
    }

    return { allowed: true };
  } catch (error) {
    console.warn("Failed to check rate limit:", error);
    // Allow execution if we can't check rate limit
    return { allowed: true };
  }
}

/**
 * Write validation audit data.
 */
async function writeAuditData(
  validationStatus: ValidationStatus,
  permissionIssues: PermissionIssue[],
  agentName: string,
): Promise<void> {
  const auditData = {
    timestamp: new Date().toISOString(),
    agent: agentName,
    validation: validationStatus,
    issues: permissionIssues,
  };

  await writeArtifact("validation-audit", "audit.json", JSON.stringify(auditData, null, 2));
}
