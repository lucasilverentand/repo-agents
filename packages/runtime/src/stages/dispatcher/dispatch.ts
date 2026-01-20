import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { StageResult } from "../../types";
import { writeArtifact } from "../../utils/artifacts";
import {
  countOpenPRs,
  createInitialProgressState,
  createProgressComment,
  getRecentWorkflowRuns,
  getRepositoryPermission,
  isOrgMember,
  isTeamMember,
  parseRepository,
  shouldUseProgressComment,
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
  max_open_prs_check: boolean;
  blocking_issues_check: boolean;
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
    max_open_prs_check: false,
    blocking_issues_check: false,
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

    // Step 5: Check max open PRs limit (if configured)
    const maxOpenPrsResult = await checkMaxOpenPRs(ctx, agent);
    if (!maxOpenPrsResult.allowed) {
      // Silently skip - no comment, just don't run. Will retry on PR close/merge.
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = maxOpenPrsResult.reason ?? "Max open PRs limit reached";
      outputs["pr-limited"] = "true";
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.max_open_prs_check = true;
    console.log("✓ Max open PRs check passed");

    // Step 6: Check for blocking issues (if configured)
    const blockingIssuesResult = await checkBlockingIssues(ctx, agent);
    if (!blockingIssuesResult.allowed) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "validation_error",
        severity: "warning",
        message: "Issue has open blocking dependencies",
        context: {
          blockers: blockingIssuesResult.blockers,
          blockingCount: blockingIssuesResult.blockingCount,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] =
        blockingIssuesResult.reason ?? "Issue has open blocking dependencies";
      outputs["blocked-by-issues"] = "true";
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.blocking_issues_check = true;
    console.log("✓ Blocking issues check passed");

    // All checks passed
    await writeAuditData(validationStatus, permissionIssues, agent.name);

    // Always get the target issue/PR number for outputs to use
    const targetNumber = await getIssueOrPRNumber(ctx);
    if (targetNumber) {
      outputs["target-issue-number"] = String(targetNumber);
    }

    // Get the full event payload for agent stage context
    const eventPayload = await getEventPayload(ctx);
    if (eventPayload) {
      outputs["event-payload"] = eventPayload;
    }

    // Create progress comment if enabled for this agent
    const progressCommentResult = await createProgressCommentIfEnabled(ctx, agent);
    if (progressCommentResult.created) {
      outputs["progress-comment-id"] = String(progressCommentResult.commentId);
      outputs["progress-issue-number"] = String(progressCommentResult.issueNumber);
      console.log(`✓ Created progress comment #${progressCommentResult.commentId}`);
    }

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

  // Check repository permission level (works for both org and personal repos)
  const { owner, repo } = parseRepository(repository);
  const permission = await getRepositoryPermission(owner, repo, actor);
  if (permission === "admin" || permission === "write") {
    return { authorized: true, permission };
  }

  // Check if this is a personal repo and actor is the owner
  if (owner === actor) {
    return { authorized: true, permission: "admin" };
  }

  // Check org membership for organization repositories
  if (await isOrgMember(owner, actor)) {
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

  // For pull_request events (e.g., PR closed), skip label check
  // The agent will find issues with the required labels to work on
  if (eventName === "pull_request") {
    return { valid: true };
  }

  // Only issue events require label validation
  if (eventName !== "issues") {
    return { valid: true };
  }

  // Get labels from issue event
  let labels: string[] = [];
  try {
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { labels?: Array<{ name: string }> };
    };
    labels = eventPayload.issue?.labels?.map((l) => l.name) ?? [];
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
 * Check max open PRs limit.
 * If the agent has max_open_prs configured and creates PRs, check if limit is reached.
 */
async function checkMaxOpenPRs(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{ allowed: boolean; reason?: string; currentCount?: number }> {
  // Skip check if max_open_prs is not configured
  if (!agent.max_open_prs) {
    return { allowed: true };
  }

  // Only check if agent can create PRs
  const canCreatePRs = agent.outputs && "create-pr" in agent.outputs;
  if (!canCreatePRs) {
    return { allowed: true };
  }

  const { owner, repo } = parseRepository(ctx.github.repository);

  try {
    // Count open PRs with the implementation-in-progress label
    // This label is added by the implementer agent when it starts working
    const openPRCount = await countOpenPRs(owner, repo, "implementation-in-progress");

    if (openPRCount >= agent.max_open_prs) {
      return {
        allowed: false,
        reason: `Max open PRs limit reached: ${openPRCount}/${agent.max_open_prs}`,
        currentCount: openPRCount,
      };
    }

    return { allowed: true, currentCount: openPRCount };
  } catch (error) {
    console.warn("Failed to check max open PRs:", error);
    // Allow execution if we can't check
    return { allowed: true };
  }
}

/**
 * Check for blocking issues.
 * If the agent has pre_flight.check_blocking_issues configured,
 * check if the issue has any open blocking dependencies.
 */
async function checkBlockingIssues(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{
  allowed: boolean;
  reason?: string;
  blockers?: Array<{ number: number; title: string; state: string }>;
  blockingCount?: number;
}> {
  // Skip check if not configured
  if (!agent.pre_flight?.check_blocking_issues) {
    return { allowed: true };
  }

  // Get issue number from event payload
  let issueNumber: number | undefined;
  try {
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { number: number };
    };
    issueNumber = eventPayload.issue?.number;
  } catch (error) {
    console.warn("Failed to read event payload:", error);
    return { allowed: true };
  }

  // Skip check if not an issue event
  if (!issueNumber) {
    return { allowed: true };
  }

  const { owner, repo } = parseRepository(ctx.github.repository);

  try {
    // Query GitHub API for blocking dependencies
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/dependencies/blocked_by`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );

    if (!response.ok) {
      console.warn(`Failed to fetch blocking issues: ${response.statusText}`);
      // Allow execution if we can't check
      return { allowed: true };
    }

    const blockers = (await response.json()) as Array<{
      number: number;
      title: string;
      state: string;
      html_url: string;
    }>;

    // Filter for open blockers only
    const openBlockers = blockers.filter((b) => b.state === "open");

    if (openBlockers.length > 0) {
      const blockerList = openBlockers.map((b) => `#${b.number}: ${b.title}`).join(", ");
      return {
        allowed: false,
        reason: `Issue is blocked by ${openBlockers.length} open issue(s): ${blockerList}`,
        blockers: openBlockers,
        blockingCount: openBlockers.length,
      };
    }

    return { allowed: true, blockingCount: 0 };
  } catch (error) {
    console.warn("Failed to check blocking issues:", error);
    // Allow execution if we can't check
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

/**
 * Create progress comment if enabled for this agent.
 */
async function createProgressCommentIfEnabled(
  ctx: DispatcherContext,
  agent: AgentDefinition,
): Promise<{ created: boolean; commentId?: number; issueNumber?: number }> {
  // Check if progress comments should be enabled
  if (!shouldUseProgressComment(agent.on, agent.progress_comment)) {
    return { created: false };
  }

  // Get issue/PR number from event
  const issueNumber = await getIssueOrPRNumber(ctx);
  if (!issueNumber) {
    console.log("Progress comment: No issue/PR number found, skipping");
    return { created: false };
  }

  const { owner, repo } = parseRepository(ctx.github.repository);
  const hasContext = !!agent.context;

  // Create initial progress state
  const workflowRunUrl = `${ctx.github.serverUrl}/${ctx.github.repository}/actions/runs/${ctx.github.runId}`;
  const state = createInitialProgressState(
    agent.name,
    ctx.github.runId,
    workflowRunUrl,
    hasContext,
  );

  try {
    const comment = await createProgressComment(owner, repo, issueNumber, state);

    return {
      created: true,
      commentId: comment.id,
      issueNumber,
    };
  } catch (error) {
    console.warn("Failed to create progress comment:", error);
    return { created: false };
  }
}

/**
 * Get issue or PR number from event payload.
 */
async function getIssueOrPRNumber(ctx: DispatcherContext): Promise<number | undefined> {
  try {
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { number: number };
      pull_request?: { number: number };
    };
    return eventPayload.issue?.number ?? eventPayload.pull_request?.number;
  } catch {
    return undefined;
  }
}

/**
 * Get the full event payload as a JSON string for agent context.
 */
async function getEventPayload(ctx: DispatcherContext): Promise<string | undefined> {
  try {
    return await Bun.file(ctx.github.eventPath).text();
  } catch {
    return undefined;
  }
}
