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
  bot_actor_check: boolean;
  user_authorization: boolean;
  labels_check: boolean;
  rate_limit_check: boolean;
  max_open_prs_check: boolean;
  blocking_issues_check: boolean;
  deduplication_check: boolean;
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
 * Known bot actor patterns.
 * These patterns identify automated actors that could cause recursive loops.
 */
const BOT_ACTOR_PATTERNS = [
  // GitHub Apps and bots
  /\[bot\]$/i, // Matches: github-actions[bot], dependabot[bot], etc.
  /^github-actions$/i, // GitHub Actions actor
  /^dependabot$/i, // Dependabot preview
  // Common CI/CD bots
  /^renovate$/i, // Renovate bot
  /^greenkeeper$/i, // Greenkeeper bot
  /^snyk-bot$/i, // Snyk bot
  /^codecov$/i, // Codecov bot
  /^semantic-release-bot$/i, // Semantic release bot
];

/**
 * Check if the actor is a bot or automated system.
 *
 * By default, agents skip execution when triggered by bots to prevent
 * recursive loops (e.g., agent edits issue -> triggers agent -> edits issue...).
 *
 * Set `allow_bot_triggers: true` in agent config to allow bot triggers.
 */
export async function checkBotActor(
  ctx: ValidationContext,
  agent: AgentDefinition,
): Promise<{ allowed: boolean; reason?: string; isBot?: boolean }> {
  // If agent explicitly allows bot triggers, skip this check
  if (agent.allow_bot_triggers === true) {
    return { allowed: true, isBot: false };
  }

  const actor = ctx.github.actor;

  // Check if actor matches any bot patterns
  for (const pattern of BOT_ACTOR_PATTERNS) {
    if (pattern.test(actor)) {
      return {
        allowed: false,
        reason: `Bot actor '${actor}' cannot trigger this agent (prevents recursive loops). Set 'allow_bot_triggers: true' to override.`,
        isBot: true,
      };
    }
  }

  return { allowed: true, isBot: false };
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

  // Check if at least one trigger label is present (OR logic)
  const hasAnyTriggerLabel = agent.trigger_labels.some((label) => labels.includes(label));
  if (!hasAnyTriggerLabel) {
    return {
      valid: false,
      reason: `Missing any of the required labels: ${agent.trigger_labels.join(", ")}`,
      presentLabels: labels,
    };
  }

  return { valid: true, presentLabels: labels };
}

/**
 * Check skip labels.
 *
 * Validates if ANY of the skip_labels are present on the issue/PR.
 * If any skip label is present, the agent should be skipped.
 * Only applies to issue and pull_request events; other event types are always valid.
 */
export async function checkSkipLabels(
  ctx: ValidationContext,
  agent: AgentDefinition,
): Promise<{
  valid: boolean;
  reason?: string;
  presentLabels?: string[];
  matchedLabels?: string[];
}> {
  // If no skip labels configured, always valid
  if (!agent.skip_labels || agent.skip_labels.length === 0) {
    return { valid: true };
  }

  const eventName = ctx.github.eventName;

  // Only issue and pull_request events support label validation
  if (eventName !== "issues" && eventName !== "pull_request") {
    return { valid: true };
  }

  // Get labels from event
  let labels: string[] = [];
  try {
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { labels?: Array<{ name: string }> };
      pull_request?: { labels?: Array<{ name: string }> };
    };
    labels =
      eventPayload.issue?.labels?.map((l) => l.name) ??
      eventPayload.pull_request?.labels?.map((l) => l.name) ??
      [];
  } catch (error) {
    console.warn("Failed to read event labels:", error);
    // If we can't read labels, allow execution (fail open)
    return { valid: true };
  }

  // Check if any skip label is present (OR logic - any match skips)
  const matchedLabels = agent.skip_labels.filter((label) => labels.includes(label));
  if (matchedLabels.length > 0) {
    return {
      valid: false,
      reason: `Skipped due to label(s): ${matchedLabels.join(", ")}`,
      presentLabels: labels,
      matchedLabels,
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
    console.log(`Reading event payload from: ${ctx.github.eventPath}`);
    const payload = await Bun.file(ctx.github.eventPath).text();
    console.log(`Event payload length: ${payload.length} characters`);
    // Base64 encode to avoid newline issues with GitHub Actions outputs
    const encoded = Buffer.from(payload).toString("base64");
    console.log(`Encoded payload length: ${encoded.length} characters`);
    return encoded;
  } catch (error) {
    console.error(`Failed to read event payload: ${error}`);
    return undefined;
  }
}

/**
 * Deduplication record stored in artifacts.
 */
export interface DeduplicationRecord {
  key: string;
  timestamp: string;
  agent_name: string;
  action_type?: string;
  event_type?: string;
  issue_number?: number;
  details?: Record<string, unknown>;
}

/**
 * Deduplication state stored in artifacts.
 */
export interface DeduplicationState {
  schema_version: "1.0.0";
  records: DeduplicationRecord[];
  last_cleanup: string;
}

/**
 * Parse a time window string (e.g., "1h", "24h", "7d") into milliseconds.
 */
export function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)([hdwm])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // Default: 24 hours
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    case "m":
      return value * 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Generate a deduplication key for an event.
 */
function generateEventKey(
  ctx: ValidationContext,
  agent: AgentDefinition,
  issueNumber?: number,
  eventAction?: string,
): string {
  const keyFields = agent.deduplication?.events?.key ?? ["event_type", "issue_number", "action"];
  const keyParts: string[] = [];

  for (const field of keyFields) {
    switch (field) {
      case "event_type":
        keyParts.push(`event:${ctx.github.eventName}`);
        break;
      case "issue_number":
        if (issueNumber) {
          keyParts.push(`issue:${issueNumber}`);
        }
        break;
      case "action":
        if (eventAction) {
          keyParts.push(`action:${eventAction}`);
        }
        break;
      default:
        keyParts.push(`custom:${field}`);
    }
  }

  return `${agent.name}:${keyParts.join(":")}`;
}

/**
 * Check event deduplication.
 *
 * Validates if this event has already been processed within the configured time window.
 * Uses artifact storage to track processed events across workflow runs.
 */
export async function checkEventDeduplication(
  ctx: ValidationContext,
  agent: AgentDefinition,
  state: DeduplicationState | null,
): Promise<{
  allowed: boolean;
  reason?: string;
  key?: string;
  previousTimestamp?: string;
}> {
  // Skip if deduplication not configured or disabled
  if (!agent.deduplication?.events || agent.deduplication.events.enabled === false) {
    return { allowed: true };
  }

  // Get event details
  let issueNumber: number | undefined;
  let eventAction: string | undefined;
  try {
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { number: number };
      pull_request?: { number: number };
      action?: string;
    };
    issueNumber = eventPayload.issue?.number ?? eventPayload.pull_request?.number;
    eventAction = eventPayload.action;
  } catch (error) {
    console.warn("Failed to read event payload for deduplication:", error);
    return { allowed: true };
  }

  const key = generateEventKey(ctx, agent, issueNumber, eventAction);
  const windowMs = parseTimeWindow(agent.deduplication.events.window ?? "1h");
  const now = Date.now();

  // Check if this event was processed within the window
  if (state) {
    const existingRecord = state.records.find(
      (r) => r.key === key && r.event_type === ctx.github.eventName,
    );

    if (existingRecord) {
      const recordTime = new Date(existingRecord.timestamp).getTime();
      if (now - recordTime < windowMs) {
        return {
          allowed: false,
          reason: `Event already processed at ${existingRecord.timestamp} (within ${agent.deduplication.events.window ?? "1h"} window)`,
          key,
          previousTimestamp: existingRecord.timestamp,
        };
      }
    }
  }

  return { allowed: true, key };
}

/**
 * Check action deduplication.
 *
 * Validates if this action has already been performed within the configured time window.
 * Used before executing outputs to prevent duplicate actions.
 */
export async function checkActionDeduplication(
  agent: AgentDefinition,
  actionType: string,
  actionDetails: Record<string, unknown>,
  state: DeduplicationState | null,
): Promise<{
  allowed: boolean;
  reason?: string;
  key?: string;
  previousTimestamp?: string;
}> {
  // Skip if deduplication not configured
  if (!agent.deduplication?.actions) {
    return { allowed: true };
  }

  // Get action-specific config or global config
  let actionConfig: { enabled?: boolean; window?: string; match?: "exact" | "similar" };
  if (typeof agent.deduplication.actions === "object" && "enabled" in agent.deduplication.actions) {
    actionConfig = agent.deduplication.actions;
  } else if (
    typeof agent.deduplication.actions === "object" &&
    actionType in agent.deduplication.actions
  ) {
    const actions = agent.deduplication.actions as Record<
      string,
      { enabled?: boolean; window?: string; match?: "exact" | "similar" }
    >;
    actionConfig = actions[actionType] ?? { enabled: true };
  } else {
    return { allowed: true };
  }

  // Skip if disabled
  if (actionConfig.enabled === false) {
    return { allowed: true };
  }

  const windowMs = parseTimeWindow(actionConfig.window ?? "24h");
  const matchMode = actionConfig.match ?? "exact";
  const now = Date.now();

  // Generate action key
  const key = `${agent.name}:action:${actionType}:${JSON.stringify(actionDetails)}`;

  // Check if this action was performed within the window
  if (state) {
    const existingRecords = state.records.filter(
      (r) => r.action_type === actionType && r.agent_name === agent.name,
    );

    for (const record of existingRecords) {
      const recordTime = new Date(record.timestamp).getTime();
      if (now - recordTime >= windowMs) {
        continue;
      }

      if (matchMode === "exact") {
        // Exact match: compare stringified details
        if (JSON.stringify(record.details) === JSON.stringify(actionDetails)) {
          return {
            allowed: false,
            reason: `Action '${actionType}' already performed at ${record.timestamp} (within ${actionConfig.window ?? "24h"} window)`,
            key,
            previousTimestamp: record.timestamp,
          };
        }
      } else if (matchMode === "similar") {
        // Similar match: check if key fields match (for comments, check target)
        const recordTarget = record.details?.issue_number ?? record.details?.pr_number;
        const currentTarget = actionDetails.issue_number ?? actionDetails.pr_number;
        if (recordTarget && currentTarget && recordTarget === currentTarget) {
          return {
            allowed: false,
            reason: `Similar action '${actionType}' already performed on #${currentTarget} at ${record.timestamp}`,
            key,
            previousTimestamp: record.timestamp,
          };
        }
      }
    }
  }

  return { allowed: true, key };
}

/**
 * Create a new deduplication record.
 */
export function createDeduplicationRecord(
  agent: AgentDefinition,
  key: string,
  options: {
    actionType?: string;
    eventType?: string;
    issueNumber?: number;
    details?: Record<string, unknown>;
  },
): DeduplicationRecord {
  return {
    key,
    timestamp: new Date().toISOString(),
    agent_name: agent.name,
    action_type: options.actionType,
    event_type: options.eventType,
    issue_number: options.issueNumber,
    details: options.details,
  };
}

/**
 * Clean up old deduplication records.
 */
export function cleanupDeduplicationState(
  state: DeduplicationState,
  maxAge: number = 7 * 24 * 60 * 60 * 1000, // Default: 7 days
): DeduplicationState {
  const now = Date.now();
  const filteredRecords = state.records.filter((record) => {
    const recordTime = new Date(record.timestamp).getTime();
    return now - recordTime < maxAge;
  });

  return {
    ...state,
    records: filteredRecords,
    last_cleanup: new Date().toISOString(),
  };
}

/**
 * Initialize empty deduplication state.
 */
export function initDeduplicationState(): DeduplicationState {
  return {
    schema_version: "1.0.0",
    records: [],
    last_cleanup: new Date().toISOString(),
  };
}
