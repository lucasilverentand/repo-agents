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
