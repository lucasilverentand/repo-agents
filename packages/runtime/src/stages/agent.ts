import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { generateSkillsSection } from "@repo-agents/generator/skills";
import { agentParser } from "@repo-agents/parser";
import { $ } from "bun";
import type { Stage, StageContext, StageResult } from "../types";

/**
 * Agent execution stage.
 *
 * This stage runs Claude Code CLI with the agent's instructions and collected context.
 * It:
 * 1. Loads the agent definition from the .md file
 * 2. Builds the context file with event info, payload, and collected context
 * 3. Creates the skills file for Claude
 * 4. Runs Claude Code CLI with appropriate tool permissions
 * 5. Extracts execution metrics
 * 6. Saves artifacts for downstream stages
 */
export const runAgent: Stage = async (ctx: StageContext): Promise<StageResult> => {
  const outputs: Record<string, string> = {};
  const artifacts: Array<{ name: string; path: string }> = [];

  try {
    // 1. Load agent definition
    const { agent, errors } = await agentParser.parseFile(ctx.agentPath);

    if (!agent) {
      return {
        success: false,
        outputs: {
          "is-error": "true",
          error: `Failed to parse agent file: ${errors.map((e) => e.message).join(", ")}`,
        },
        artifacts,
      };
    }

    // Ensure output directories exist
    await mkdir("/tmp/outputs", { recursive: true });
    await mkdir("/tmp/audit", { recursive: true });
    await mkdir(".claude", { recursive: true });

    // 2. Build context file
    const contextContent = await buildContextFile(ctx, agent.markdown);
    await writeFile("/tmp/context.txt", contextContent);

    // 3. Create skills file
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      const skillsContent = generateSkillsSection(agent.outputs, agent.allowed_paths);
      if (skillsContent) {
        await writeFile(".claude/CLAUDE.md", skillsContent);
      }
    }

    // 4. Build allowed tools list
    const hasOutputs = agent.outputs && Object.keys(agent.outputs).length > 0;
    const allowedTools = hasOutputs ? "Write,Read,Glob,Grep" : "Read,Glob,Grep";

    // 5. Run Claude Code CLI
    const claudeResult = await runClaudeCode(allowedTools);

    // 6. Extract metrics from claude-output.json
    const metrics = await extractMetrics();

    // Set outputs
    outputs.cost = String(metrics.total_cost_usd ?? "N/A");
    outputs.turns = String(metrics.num_turns ?? "N/A");
    outputs.duration = String(metrics.duration_ms ?? "N/A");
    outputs["session-id"] = metrics.session_id ?? "N/A";
    outputs["is-error"] = String(metrics.is_error ?? claudeResult.exitCode !== 0);

    // 7. Save metrics artifact
    await writeFile("/tmp/audit/metrics.json", JSON.stringify(metrics, null, 2));

    artifacts.push({ name: "audit-metrics", path: "/tmp/audit/" });

    // Upload outputs if any were created
    if (hasOutputs && existsSync("/tmp/outputs")) {
      artifacts.push({ name: "agent-outputs", path: "/tmp/outputs/" });
    }

    return {
      success: claudeResult.exitCode === 0 && !metrics.is_error,
      outputs,
      artifacts,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      outputs: {
        "is-error": "true",
        error: errorMessage,
      },
      artifacts,
    };
  }
};

/**
 * Builds the context file content with:
 * - GitHub event info (repo, event name)
 * - Event payload (issue/PR details if applicable)
 * - Collected context (if exists at /tmp/context/collected.md)
 * - Available labels (fetched from repo for label outputs)
 * - Agent instructions (the markdown body from agent definition)
 */
async function buildContextFile(ctx: StageContext, agentInstructions: string): Promise<string> {
  const sections: string[] = [];

  // Check for dispatcher context first (when triggered via dispatcher)
  const dispatchContextPath = "/tmp/dispatch-context/context.json";
  let eventHandled = false;

  if (existsSync(dispatchContextPath)) {
    try {
      const dispatchContextContent = await readFile(dispatchContextPath, "utf-8");
      const dispatchContext = JSON.parse(dispatchContextContent);

      // Use original event info from dispatcher
      sections.push(`GitHub Event: ${dispatchContext.eventName}`);
      sections.push(`Event Action: ${dispatchContext.eventAction}`);
      sections.push(`Repository: ${dispatchContext.repository}`);
      sections.push("");

      // Add issue context if present
      if (dispatchContext.issue) {
        sections.push(`Issue #${dispatchContext.issue.number}: ${dispatchContext.issue.title}`);
        sections.push(`Author: @${dispatchContext.issue.author || "unknown"}`);
        if (dispatchContext.issue.body) {
          sections.push("Body:");
          sections.push(dispatchContext.issue.body);
        }
        sections.push("");
      }

      // Add PR context if present
      if (dispatchContext.pullRequest) {
        sections.push(
          `PR #${dispatchContext.pullRequest.number}: ${dispatchContext.pullRequest.title}`,
        );
        sections.push(`Author: @${dispatchContext.pullRequest.author || "unknown"}`);
        if (dispatchContext.pullRequest.body) {
          sections.push("Body:");
          sections.push(dispatchContext.pullRequest.body);
        }
        sections.push("");
      }

      // Add discussion context if present
      if (dispatchContext.discussion) {
        sections.push(
          `Discussion #${dispatchContext.discussion.number}: ${dispatchContext.discussion.title}`,
        );
        sections.push(`Author: @${dispatchContext.discussion.author || "unknown"}`);
        if (dispatchContext.discussion.body) {
          sections.push("Body:");
          sections.push(dispatchContext.discussion.body);
        }
        sections.push("");
      }

      eventHandled = true;
    } catch (error) {
      console.warn("Failed to read dispatch context:", error);
      // Fall through to standard event path handling
    }
  }

  // Standard event handling (direct workflow trigger or fallback)
  if (!eventHandled) {
    sections.push(`GitHub Event: ${ctx.eventName}`);
    sections.push(`Repository: ${ctx.repository}`);
    sections.push("");

    // Event payload from GITHUB_EVENT_PATH
    if (ctx.eventPath && existsSync(ctx.eventPath)) {
      try {
        const eventPayload = await readFile(ctx.eventPath, "utf-8");
        const event = JSON.parse(eventPayload);

        // Add issue context if present
        if (event.issue) {
          sections.push(`Issue #${event.issue.number}: ${event.issue.title}`);
          sections.push(`Author: @${event.issue.user?.login || "unknown"}`);
          if (event.issue.body) {
            sections.push("Body:");
            sections.push(event.issue.body);
          }
          sections.push("");
        }

        // Add PR context if present
        if (event.pull_request) {
          sections.push(`PR #${event.pull_request.number}: ${event.pull_request.title}`);
          sections.push(`Author: @${event.pull_request.user?.login || "unknown"}`);
          if (event.pull_request.body) {
            sections.push("Body:");
            sections.push(event.pull_request.body);
          }
          sections.push("");
        }

        // Add discussion context if present
        if (event.discussion) {
          sections.push(`Discussion #${event.discussion.number}: ${event.discussion.title}`);
          sections.push(`Category: ${event.discussion.category?.name || "unknown"}`);
          sections.push(`Author: @${event.discussion.user?.login || "unknown"}`);
          if (event.discussion.body) {
            sections.push("Body:");
            sections.push(event.discussion.body);
          }
          sections.push("");
        }
      } catch {
        // Failed to parse event payload - continue without it
      }
    }
  }

  // Add collected context if exists
  const collectedContextPath = "/tmp/context/collected.md";
  if (existsSync(collectedContextPath)) {
    try {
      const collectedContext = await readFile(collectedContextPath, "utf-8");
      if (collectedContext.trim()) {
        sections.push("## Collected Context");
        sections.push("");
        sections.push("The following data has been collected from the repository:");
        sections.push("");
        sections.push(collectedContext);
        sections.push("");
      }
    } catch {
      // Failed to read collected context - continue without it
    }
  }

  // Fetch available labels for label-related outputs
  try {
    const labelsResult =
      await $`gh api "repos/${ctx.repository}/labels" --jq '[.[].name]' 2>/dev/null`.quiet();
    if (labelsResult.exitCode === 0 && labelsResult.stdout) {
      const labels = JSON.parse(labelsResult.stdout.toString());
      if (Array.isArray(labels) && labels.length > 0) {
        sections.push("## Available Repository Labels");
        sections.push("");
        sections.push(
          `The following labels are available in this repository: ${labels.join(", ")}`,
        );
        sections.push("");
        sections.push(
          "**Important**: You can only use labels that already exist. New labels cannot be created by this agent.",
        );
        sections.push("");
      }
    }
  } catch {
    // Failed to fetch labels - continue without them
  }

  // Add agent instructions
  sections.push("---");
  sections.push("");
  sections.push(agentInstructions);

  return sections.join("\n");
}

/**
 * Runs Claude Code CLI with the context file as input.
 * Returns the exit code and any error message.
 */
async function runClaudeCode(allowedTools: string): Promise<{ exitCode: number; error?: string }> {
  try {
    // Read context file to pass as stdin
    const contextContent = await readFile("/tmp/context.txt", "utf-8");

    // Use Bun shell's stdin redirection from a Response object
    const contextBlob = new Response(contextContent);

    // Build the command - use bunx to run Claude Code with stdin redirection
    const result =
      await $`bunx --bun @anthropic-ai/claude-code --allowedTools ${allowedTools} --output-format json --print < ${contextBlob}`
        .quiet()
        .nothrow();

    // Write output to file for metrics extraction
    if (result.stdout) {
      await writeFile("/tmp/claude-output.json", result.stdout.toString());
    }

    if (result.exitCode !== 0 && result.stderr) {
      return {
        exitCode: result.exitCode,
        error: result.stderr.toString(),
      };
    }

    return { exitCode: result.exitCode };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      exitCode: 1,
      error: errorMessage,
    };
  }
}

/**
 * Extracts execution metrics from the Claude output JSON.
 */
async function extractMetrics(): Promise<{
  total_cost_usd?: number;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  session_id?: string;
  is_error?: boolean;
  result?: string;
}> {
  try {
    if (!existsSync("/tmp/claude-output.json")) {
      return { is_error: true };
    }

    const outputContent = await readFile("/tmp/claude-output.json", "utf-8");
    const output = JSON.parse(outputContent);

    return {
      total_cost_usd: output.total_cost_usd,
      num_turns: output.num_turns,
      duration_ms: output.duration_ms,
      duration_api_ms: output.duration_api_ms,
      session_id: output.session_id,
      is_error: output.is_error ?? false,
      result: output.result,
    };
  } catch {
    return { is_error: true };
  }
}
