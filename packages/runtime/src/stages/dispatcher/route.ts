import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { agentParser } from "@repo-agents/parser";
import type { StageResult } from "../../types";
import type { DispatcherContext, RoutingRule } from "./types";

/**
 * Route stage: Discovers agents and matches events to them.
 *
 * Steps:
 * 1. Discover agent markdown files from --agents-dir
 * 2. Parse each agent to extract trigger configuration
 * 3. Build routing table with matching rules
 * 4. Match current event against routing rules
 * 5. Handle workflow_dispatch with specific agent selection
 * 6. Output JSON array of matching agents
 */
export async function runRoute(ctx: DispatcherContext): Promise<StageResult> {
  try {
    const agentsDir = ctx.options?.agentsDir ?? ".github/agents";
    const workflowDispatchAgent = process.env.WORKFLOW_DISPATCH_AGENT;

    // Discover and parse all agents
    const routingTable = await buildRoutingTable(agentsDir);

    if (routingTable.length === 0) {
      console.log("No agents found in", agentsDir);
      return {
        success: true,
        outputs: {
          "matching-agents": "[]",
        },
      };
    }

    console.log(`Discovered ${routingTable.length} agents`);

    // Match event against routing rules
    let matchingAgents: RoutingRule[];

    if (ctx.github.eventName === "workflow_dispatch" && workflowDispatchAgent) {
      // Specific agent requested via workflow_dispatch input
      matchingAgents = routingTable.filter((rule) => rule.agentName === workflowDispatchAgent);
      console.log(`Workflow dispatch for specific agent: ${workflowDispatchAgent}`);
    } else if (ctx.github.eventName === "issues" && ctx.github.eventAction === "closed") {
      // Special handling: check if closed issue was blocking others that need retry
      const retryAgents = await handleClosedIssueRetries(ctx, routingTable);
      // Also match normal routing for agents listening to 'closed' events
      const normalMatches = routingTable.filter((rule) => matchesEvent(rule, ctx.github));
      // Combine both (deduplicate by agentName)
      const combinedMap = new Map<string, RoutingRule>();
      for (const agent of [...retryAgents, ...normalMatches]) {
        combinedMap.set(agent.agentName, agent);
      }
      matchingAgents = Array.from(combinedMap.values());
      console.log(
        `Closed issue detected: ${retryAgents.length} retry agents, ${normalMatches.length} normal matches`,
      );
    } else {
      // Match against all agents
      matchingAgents = routingTable.filter((rule) => matchesEvent(rule, ctx.github));
    }

    console.log(`Matched ${matchingAgents.length} agents`);
    for (const agent of matchingAgents) {
      console.log(`  - ${agent.agentName} (${agent.workflowFile})`);
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
 * Discovers all agent markdown files and builds routing table.
 */
async function buildRoutingTable(agentsDir: string): Promise<RoutingRule[]> {
  const routingTable: RoutingRule[] = [];

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

      // Generate workflow filename from agent filename
      const workflowFile = `agent-${basename(agentPath, ".md")}.yml`;

      // Extract triggers from agent definition
      const triggers = {
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
      };

      routingTable.push({
        agentName: agent.name,
        agentPath,
        workflowFile,
        triggers,
      });
    }
  } catch (error) {
    console.error(`Failed to read agents directory ${agentsDir}:`, error);
  }

  return routingTable;
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
  ctx: DispatcherContext,
  routingTable: RoutingRule[],
): Promise<RoutingRule[]> {
  const matchingAgents: RoutingRule[] = [];

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

      // Find agents that have pre_flight.check_blocking_issues enabled
      // and whose trigger labels match this issue
      for (const rule of routingTable) {
        // Load agent to check pre_flight config
        const { agent } = await agentParser.parseFile(rule.agentPath);
        if (!agent || !agent.pre_flight?.check_blocking_issues) {
          continue;
        }

        // Check if this issue has the required trigger labels for this agent
        const requiredLabels = agent.trigger_labels || [];
        const hasAllLabels = requiredLabels.every((required) => labels.includes(required));

        if (hasAllLabels && !matchingAgents.some((a) => a.agentName === rule.agentName)) {
          console.log(`    -> Matching agent: ${rule.agentName}`);
          matchingAgents.push(rule);
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
 * Checks if a routing rule matches the current event.
 */
function matchesEvent(rule: RoutingRule, github: DispatcherContext["github"]): boolean {
  const { eventName, eventAction } = github;

  switch (eventName) {
    case "issues":
      return rule.triggers.issues?.includes(eventAction) ?? false;

    case "pull_request":
      return rule.triggers.pullRequest?.includes(eventAction) ?? false;

    case "discussion":
      return rule.triggers.discussion?.includes(eventAction) ?? false;

    case "schedule": {
      // For schedule events, github.event.schedule contains the cron expression
      // We need to match it against the agent's schedule triggers
      const eventSchedule = process.env.GITHUB_EVENT_SCHEDULE ?? "";
      return rule.triggers.schedule?.includes(eventSchedule) ?? false;
    }

    case "repository_dispatch":
      // For repository_dispatch, the action field contains the dispatch type
      return rule.triggers.repositoryDispatch?.includes(eventAction) ?? false;

    case "workflow_dispatch":
      // Generic workflow_dispatch (no specific agent requested)
      // Routes to all agents that have workflow_dispatch enabled
      return rule.triggers.workflowDispatch ?? false;

    default:
      return false;
  }
}
