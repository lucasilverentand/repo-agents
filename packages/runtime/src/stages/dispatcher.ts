import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { StageResult } from "../types";
import {
  checkBlockingIssues,
  checkBotActor,
  checkMaxOpenPRs,
  checkRateLimit,
  checkSkipLabels,
  checkTriggerLabels,
  checkUserAuthorization,
  getEventPayload,
  type ValidationContext,
} from "../utils/validation";

/**
 * Dispatcher stage: Discovers, routes, and validates all agents.
 *
 * This replaces the old route-event + agent-validation jobs with a single dispatcher
 * that outputs per-agent decisions for the workflow to use.
 *
 * Includes global preflight check (Claude authentication) before proceeding.
 *
 * Outputs (per agent):
 * - agent-{slug}-should-run: "true" | "false"
 * - agent-{slug}-skip-reason: Reason for skipping
 * - agent-{slug}-event-payload: Base64-encoded event payload
 */
export async function runDispatcher(ctx: {
  github: {
    actor: string;
    repository: string;
    eventName: string;
    eventPath: string;
    eventAction: string;
    runId: number;
    serverUrl: string;
  };
  options?: {
    agentsDir?: string;
  };
}): Promise<StageResult> {
  // Step 1: Check Claude authentication (global preflight)
  const secretsResult = checkSecrets();
  if (!secretsResult.valid) {
    console.error("❌ Claude authentication check failed");
    console.error(secretsResult.error);
    return {
      success: false,
      outputs: {
        error: secretsResult.error ?? "No Claude authentication configured",
      },
    };
  }
  console.log("✓ Claude authentication validated");

  const agentsDir = ctx.options?.agentsDir ?? ".github/agents";
  const workflowDispatchAgent = process.env.WORKFLOW_DISPATCH_AGENT;

  // Step 2: Discover all agents
  const allAgents = await discoverAgents(agentsDir);

  if (allAgents.length === 0) {
    console.log("No agents found in", agentsDir);
    return {
      success: true,
      outputs: {},
    };
  }

  console.log(`Discovered ${allAgents.length} agents`);

  // Match event against agent triggers
  let matchingAgents: Array<{ agent: AgentDefinition; path: string }>;

  if (ctx.github.eventName === "workflow_dispatch" && workflowDispatchAgent) {
    // Specific agent requested
    matchingAgents = allAgents.filter(({ agent }) => agent.name === workflowDispatchAgent);
    console.log(`Workflow dispatch for specific agent: ${workflowDispatchAgent}`);
  } else {
    // Match against all agents based on event
    matchingAgents = allAgents.filter(({ agent }) => matchesEvent(agent, ctx.github));
  }

  console.log(`Matched ${matchingAgents.length} agents to event`);

  // Validate each matching agent and build outputs
  const outputs: Record<string, string> = {};

  for (const { agent, path } of matchingAgents) {
    const slug = slugifyAgentName(agent.name);
    console.log(`\nValidating agent: ${agent.name}`);

    const validationContext: ValidationContext = {
      github: ctx.github,
      options: { agentPath: path },
    };

    // Run all validation checks
    const validationResult = await validateAgent(validationContext, agent);

    // Set outputs for this agent
    outputs[`agent-${slug}-should-run`] = validationResult.shouldRun ? "true" : "false";

    if (!validationResult.shouldRun && validationResult.reason) {
      outputs[`agent-${slug}-skip-reason`] = validationResult.reason;
      console.log(`  ✗ Skipped: ${validationResult.reason}`);
    } else {
      console.log(`  ✓ Approved`);
    }

    // Always get event payload for agents that might run
    const eventPayload = await getEventPayload(validationContext);
    if (eventPayload) {
      console.log(`  Event payload size: ${eventPayload.length} characters (base64)`);
      outputs[`agent-${slug}-event-payload`] = eventPayload;
    } else {
      console.warn(`  ⚠ Event payload is undefined for ${agent.name}`);
    }
  }

  return {
    success: true,
    outputs,
  };
}

/**
 * Validate an agent against all checks
 */
async function validateAgent(
  ctx: ValidationContext,
  agent: AgentDefinition,
): Promise<{ shouldRun: boolean; reason?: string }> {
  // 1. Check bot actor (prevents recursive loops from bot-triggered events)
  const botResult = await checkBotActor(ctx, agent);
  if (!botResult.allowed) {
    return { shouldRun: false, reason: botResult.reason ?? "Bot actors not allowed" };
  }

  // 2. Check user authorization
  const authResult = await checkUserAuthorization(ctx, agent);
  if (!authResult.authorized) {
    return { shouldRun: false, reason: authResult.reason ?? "User not authorized" };
  }

  // 3. Check trigger labels
  const labelsResult = await checkTriggerLabels(ctx, agent);
  if (!labelsResult.valid) {
    return { shouldRun: false, reason: labelsResult.reason ?? "Required labels not present" };
  }

  // 4. Check skip labels
  const skipLabelsResult = await checkSkipLabels(ctx, agent);
  if (!skipLabelsResult.valid) {
    return { shouldRun: false, reason: skipLabelsResult.reason ?? "Skipped due to labels" };
  }

  // 5. Check rate limiting
  const rateLimitResult = await checkRateLimit(ctx, agent);
  if (!rateLimitResult.allowed) {
    return { shouldRun: false, reason: rateLimitResult.reason ?? "Rate limit exceeded" };
  }

  // 6. Check max open PRs
  const maxOpenPrsResult = await checkMaxOpenPRs(ctx, agent);
  if (!maxOpenPrsResult.allowed) {
    return { shouldRun: false, reason: maxOpenPrsResult.reason ?? "Max open PRs limit reached" };
  }

  // 7. Check blocking issues
  const blockingIssuesResult = await checkBlockingIssues(ctx, agent);
  if (!blockingIssuesResult.allowed) {
    return {
      shouldRun: false,
      reason: blockingIssuesResult.reason ?? "Issue has open blocking dependencies",
    };
  }

  return { shouldRun: true };
}

/**
 * Discover all agent markdown files and parse them
 */
async function discoverAgents(
  agentsDir: string,
): Promise<Array<{ agent: AgentDefinition; path: string }>> {
  const agents: Array<{ agent: AgentDefinition; path: string }> = [];

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

      agents.push({ agent, path: agentPath });
    }
  } catch (error) {
    console.error(`Failed to read agents directory ${agentsDir}:`, error);
  }

  return agents;
}

/**
 * Recursively find all .md files
 */
async function findAgentFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findAgentFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}

/**
 * Check if agent triggers match the current event
 */
function matchesEvent(
  agent: AgentDefinition,
  github: { eventName: string; eventAction: string },
): boolean {
  const { eventName, eventAction } = github;

  switch (eventName) {
    case "issues":
      return agent.on.issues?.types?.includes(eventAction) ?? false;

    case "pull_request":
      return agent.on.pull_request?.types?.includes(eventAction) ?? false;

    case "discussion":
      return agent.on.discussion?.types?.includes(eventAction) ?? false;

    case "schedule": {
      const eventSchedule = process.env.GITHUB_EVENT_SCHEDULE ?? "";
      return agent.on.schedule?.some((s) => s.cron === eventSchedule) ?? false;
    }

    case "repository_dispatch":
      return agent.on.repository_dispatch?.types?.includes(eventAction) ?? false;

    case "workflow_dispatch":
      return typeof agent.on.workflow_dispatch === "boolean"
        ? agent.on.workflow_dispatch
        : agent.on.workflow_dispatch !== undefined;

    default:
      return false;
  }
}

/**
 * Convert agent name to URL-safe slug
 */
function slugifyAgentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Check that required Claude authentication secrets are available.
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
