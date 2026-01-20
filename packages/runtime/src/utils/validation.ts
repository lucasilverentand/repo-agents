import type { AgentDefinition } from "@repo-agents/types";
import {
  countOpenPRs,
  getRecentWorkflowRuns,
  getRepositoryPermission,
  isOrgMember,
  isTeamMember,
  parseRepository,
} from "./index";

/**
 * Validation status tracking for audit
 */
export interface ValidationStatus {
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
export interface PermissionIssue {
  timestamp: string;
  issue_type: "missing_permission" | "path_restriction" | "rate_limit" | "validation_error";
  severity: "error" | "warning";
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Context for validation checks
 */
export interface ValidationContext {
  github: {
    actor: string;
    repository: string;
    eventName: string;
    eventPath: string;
    runId: number;
    serverUrl: string;
  };
  options?: {
    agentPath?: string;
    workflowFile?: string;
  };
}

/**
 * Check user authorization.
 *
 * Validates if the user triggering the workflow is authorized based on:
 * - Explicit allow lists (allowed_users, allowed_actors)
 * - Team membership (allowed_teams)
 * - Repository permission level (admin or write access)
 * - Personal repo ownership
 * - Organization membership
 */
export async function checkUserAuthorization(
  ctx: ValidationContext,
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
 *
 * Validates if the required labels (trigger_labels) are present on the issue.
 * Only applies to issue events; other event types are always valid.
 */
export async function checkTriggerLabels(
  ctx: ValidationContext,
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
 *
 * Ensures minimum time has passed since the last successful run.
 * Default rate limit is 5 minutes between runs.
 */
export async function checkRateLimit(
  ctx: ValidationContext,
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
 *
 * If the agent has max_open_prs configured and creates PRs, check if limit is reached.
 * Silently skips execution if limit reached (no comment, agent will retry on PR close/merge).
 */
export async function checkMaxOpenPRs(
  ctx: ValidationContext,
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
 *
 * If the agent has pre_flight.check_blocking_issues configured,
 * check if the issue has any open blocking dependencies.
 */
export async function checkBlockingIssues(
  ctx: ValidationContext,
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
 * Get issue or PR number from event payload.
 */
export async function getIssueOrPRNumber(ctx: ValidationContext): Promise<number | undefined> {
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
 * Get the full event payload as a base64-encoded string for agent context.
 * Base64 encoding is required because GitHub Actions outputs can't contain newlines.
 */
export async function getEventPayload(ctx: ValidationContext): Promise<string | undefined> {
  try {
    const payload = await Bun.file(ctx.github.eventPath).text();
    // Base64 encode to avoid newline issues with GitHub Actions outputs
    return Buffer.from(payload).toString("base64");
  } catch {
    return undefined;
  }
}
