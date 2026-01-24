import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { StageResult } from "../../types";

/**
 * Context for unified route stage
 */
export interface UnifiedRouteContext {
  github: {
    repository: string;
    runId: number;
    serverUrl: string;
    eventName: string;
    eventAction: string;
    actor: string;
    eventPath: string;
  };
  options?: {
    agentsDir?: string;
  };
}

/**
 * Agent metadata for matrix execution.
 * Contains full agent configuration needed for validation and execution.
 */
export interface AgentMatrixEntry {
  name: string;
  path: string;
  config: {
    has_context: boolean;
    has_outputs: boolean;
    output_types: string[];
    use_progress_comment: boolean;
    rate_limit_minutes: number;
    max_open_prs?: number;
    trigger_labels?: string[];
    allowed_users?: string[];
    allowed_actors?: string[];
    allowed_teams?: string[];
    check_blocking_issues: boolean;
  };
  triggers: {
    issues?: string[];
    pullRequest?: string[];
    discussion?: string[];
    schedule?: string[];
    repositoryDispatch?: string[];
    workflowDispatch?: boolean;
  };
}

/**
 * Unified route stage: Discovers agents and matches events to them.
 *
 * This replaces the dispatcher route-event job. It:
 * 1. Discovers all agent markdown files from .github/agents/
 * 2. Parses each agent to extract triggers and configuration
 * 3. Builds routing table with full agent metadata for matrix execution
 * 4. Matches current event against routing rules
 * 5. Handles workflow_dispatch with specific agent selection
 * 6. Handles closed issue retry logic for blocking dependencies
 * 7. Outputs JSON array of matching agents with full config
 */
export async function runUnifiedRoute(ctx: UnifiedRouteContext): Promise<StageResult> {
  try {
    const agentsDir = ctx.options?.agentsDir ?? ".github/agents";
    const workflowDispatchAgent = process.env.WORKFLOW_DISPATCH_AGENT;

    // Discover and parse all agents with full configuration
    const allAgents = await discoverAgents(agentsDir);

    if (allAgents.length === 0) {
      console.log("No agents found in", agentsDir);
      return {
        success: true,
        outputs: {
          "matching-agents": "[]",
        },
      };
    }

    console.log(`Discovered ${allAgents.length} agents`);

    // Match event against agent triggers
    let matchingAgents: AgentMatrixEntry[];

    if (ctx.github.eventName === "workflow_dispatch" && workflowDispatchAgent) {
      // Specific agent requested via workflow_dispatch input
      matchingAgents = allAgents.filter((agent) => agent.name === workflowDispatchAgent);
      console.log(`Workflow dispatch for specific agent: ${workflowDispatchAgent}`);
    } else if (ctx.github.eventName === "issues" && ctx.github.eventAction === "closed") {
      // Special handling: check if closed issue was blocking others that need retry
      const retryAgents = await handleClosedIssueRetries(ctx, allAgents);
      // Also match normal routing for agents listening to 'closed' events
      const normalMatches = allAgents.filter((agent) => matchesEvent(agent, ctx.github));
      // Combine both (deduplicate by name)
      const combinedMap = new Map<string, AgentMatrixEntry>();
      for (const agent of [...retryAgents, ...normalMatches]) {
        combinedMap.set(agent.name, agent);
      }
      matchingAgents = Array.from(combinedMap.values());
      console.log(
        `Closed issue detected: ${retryAgents.length} retry agents, ${normalMatches.length} normal matches`,
      );
    } else {
      // Match against all agents
      matchingAgents = allAgents.filter((agent) => matchesEvent(agent, ctx.github));
    }

    console.log(`Matched ${matchingAgents.length} agents`);
    for (const agent of matchingAgents) {
      console.log(`  - ${agent.name} (${agent.path})`);
    }

    return {
      success: true,
      outputs: {
        "matching-agents": JSON.stringify(matchingAgents),
      },
    };
  } catch (error) {
    console.error("Failed to route event:", error);
    return {
      success: false,
      outputs: {
        "matching-agents": "[]",
      },
    };
  }
}

/**
 * Discovers all agent markdown files and extracts their full configuration.
 */
async function discoverAgents(agentsDir: string): Promise<AgentMatrixEntry[]> {
  const agents: AgentMatrixEntry[] = [];

  try {
    const agentFiles = await findAgentFiles(agentsDir);

    for (const agentPath of agentFiles) {
      const { agent, errors } = await agentParser.parseFile(agentPath);

      if (errors.length > 0) {
        console.warn(`Warning: Failed to parse ${agentPath}:`, errors[0].message);
        continue;
      }

      if (!agent) {
        continue;
      }

      // Build matrix entry with full agent configuration
      agents.push(buildAgentMatrixEntry(agent, agentPath));
    }
  } catch (error) {
    console.error(`Failed to read agents directory ${agentsDir}:`, error);
  }

  return agents;
}

/**
 * Build matrix entry from agent definition.
 * Extracts all configuration needed for validation and execution.
 */
function buildAgentMatrixEntry(agent: AgentDefinition, agentPath: string): AgentMatrixEntry {
  return {
    name: agent.name,
    path: agentPath,
    config: {
      has_context: !!agent.context,
      has_outputs: !!agent.outputs && Object.keys(agent.outputs).length > 0,
      output_types: agent.outputs ? Object.keys(agent.outputs) : [],
      use_progress_comment: shouldUseProgressComment(agent),
      rate_limit_minutes: agent.rate_limit_minutes ?? 5,
      max_open_prs: agent.max_open_prs,
      trigger_labels: agent.trigger_labels,
      allowed_users: agent.allowed_users,
      allowed_actors: agent.allowed_actors,
      allowed_teams: agent.allowed_teams,
      check_blocking_issues: agent.pre_flight?.check_blocking_issues ?? false,
    },
    triggers: {
      issues: agent.on.issues?.types,
      pullRequest: agent.on.pull_request?.types,
      discussion: agent.on.discussion?.types,
      schedule: agent.on.schedule?.map((s) => s.cron),
      repositoryDispatch: agent.on.repository_dispatch?.types,
      workflowDispatch: Boolean(
        typeof agent.on.workflow_dispatch === "boolean"
          ? agent.on.workflow_dispatch
          : agent.on.workflow_dispatch !== undefined,
      ),
    },
  };
}

/**
 * Determine if progress comments should be enabled for an agent.
 * Default: enabled for issue/PR triggers, disabled for others.
 */
function shouldUseProgressComment(agent: AgentDefinition): boolean {
  // Explicit setting takes precedence
  if (agent.progress_comment !== undefined) {
    return agent.progress_comment;
  }
  // Default enabled for issue/PR triggers
  return !!(agent.on.issues || agent.on.pull_request);
}

/**
 * Recursively finds all .md files in the agents directory.
 */
async function findAgentFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findAgentFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  return files;
}

/**
 * Handle auto-retry logic when an issue closes.
 * Checks if the closed issue was blocking other issues that need to be retried.
 */
async function handleClosedIssueRetries(
  ctx: UnifiedRouteContext,
  allAgents: AgentMatrixEntry[],
): Promise<AgentMatrixEntry[]> {
  const matchingAgents: AgentMatrixEntry[] = [];

  try {
    // Get the closed issue number from event
    const eventPayload = JSON.parse(await Bun.file(ctx.github.eventPath).text()) as {
      issue?: { number: number };
      repository?: { owner: { login: string }; name: string };
    };

    const closedIssueNumber = eventPayload.issue?.number;
    if (!closedIssueNumber) {
      return [];
    }

    const owner = eventPayload.repository?.owner?.login;
    const repo = eventPayload.repository?.name;
    if (!owner || !repo) {
      return [];
    }

    console.log(`Issue #${closedIssueNumber} closed - checking for blocked issues...`);

    // Query GitHub API to find issues that were blocked by this one
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${closedIssueNumber}/dependencies/blocking`,
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
      return [];
    }

    const blockedIssues = (await response.json()) as Array<{
      number: number;
      title: string;
      state: string;
      labels: Array<{ name: string }>;
    }>;

    // Filter for open issues only
    const openBlockedIssues = blockedIssues.filter((issue) => issue.state === "open");

    if (openBlockedIssues.length === 0) {
      console.log("No open issues were blocked by this issue");
      return [];
    }

    console.log(
      `Found ${openBlockedIssues.length} open issues that were blocked by #${closedIssueNumber}`,
    );

    // For each blocked issue, check if any agents with blocking checks would match
    for (const blockedIssue of openBlockedIssues) {
      const labels = blockedIssue.labels.map((l) => l.name);
      console.log(
        `  - Issue #${blockedIssue.number}: ${blockedIssue.title} (labels: ${labels.join(", ")})`,
      );

      // Find agents that have check_blocking_issues enabled
      // and whose trigger labels match this issue
      for (const agent of allAgents) {
        if (!agent.config.check_blocking_issues) {
          continue;
        }

        // Check if this issue has any of the trigger labels for this agent (OR logic)
        const triggerLabels = agent.config.trigger_labels || [];
        // If no trigger labels configured, agent matches all issues
        // Otherwise, check if ANY trigger label is present
        const hasAnyTriggerLabel =
          triggerLabels.length === 0 || triggerLabels.some((label) => labels.includes(label));

        if (hasAnyTriggerLabel && !matchingAgents.some((a) => a.name === agent.name)) {
          console.log(`    -> Matching agent: ${agent.name}`);
          matchingAgents.push(agent);
        }
      }
    }

    if (matchingAgents.length > 0) {
      console.log(`Will retry ${matchingAgents.length} agents for unblocked issues`);
    }
  } catch (error) {
    console.warn("Failed to handle closed issue retries:", error);
  }

  return matchingAgents;
}

/**
 * Checks if an agent's triggers match the current event.
 */
function matchesEvent(agent: AgentMatrixEntry, github: UnifiedRouteContext["github"]): boolean {
  const { eventName, eventAction } = github;

  switch (eventName) {
    case "issues":
      return agent.triggers.issues?.includes(eventAction) ?? false;

    case "pull_request":
      return agent.triggers.pullRequest?.includes(eventAction) ?? false;

    case "discussion":
      return agent.triggers.discussion?.includes(eventAction) ?? false;

    case "schedule": {
      // For schedule events, github.event.schedule contains the cron expression
      // We need to match it against the agent's schedule triggers
      const eventSchedule = process.env.GITHUB_EVENT_SCHEDULE ?? "";
      return agent.triggers.schedule?.includes(eventSchedule) ?? false;
    }

    case "repository_dispatch":
      // For repository_dispatch, the action field contains the dispatch type
      return agent.triggers.repositoryDispatch?.includes(eventAction) ?? false;

    case "workflow_dispatch":
      // Generic workflow_dispatch (no specific agent requested)
      // Routes to all agents that have workflow_dispatch enabled
      return agent.triggers.workflowDispatch ?? false;

    default:
      return false;
  }
}
