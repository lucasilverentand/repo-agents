/**
 * Audit Issues stage - creates or updates GitHub issues for failed agents.
 *
 * This stage runs for each failed agent (via matrix strategy) to:
 * 1. Load the agent's audit manifest
 * 2. Check if issue creation is enabled in agent config
 * 3. Search for existing failure issues
 * 4. Create new issue or add comment to existing one
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { agentParser } from "@repo-agents/parser";
import type { AuditManifest } from "@repo-agents/types";
import { $ } from "bun";

import type { Stage, StageContext, StageResult } from "../types";

/**
 * Audit issues stage: creates/updates GitHub issues for failed agents.
 */
export const runAuditIssues: Stage = async (ctx: StageContext): Promise<StageResult> => {
  console.log("=== Audit Issues Stage ===");

  // Get agent name from context or environment
  const agentName = process.env.MATRIX_AGENT || extractAgentNameFromPath(ctx.agentPath);

  if (!agentName) {
    console.error("No agent name provided");
    return {
      success: false,
      outputs: { error: "No agent name provided" },
    };
  }

  console.log(`Processing issues for agent: ${agentName}`);

  // Convert agent name to slug for file lookup
  const agentSlug = slugifyAgentName(agentName);

  // 1. Load per-agent manifest
  const manifestPath = join("/tmp/audit/per-agent", `${agentSlug}.json`);

  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    return {
      success: false,
      outputs: { error: `Manifest not found for agent: ${agentName}` },
    };
  }

  let manifest: AuditManifest;
  try {
    const content = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(content);
  } catch (error) {
    console.error("Failed to parse manifest:", error);
    return {
      success: false,
      outputs: { error: "Failed to parse agent manifest" },
    };
  }

  // 2. Load agent definition to get audit config
  const { agent, errors } = await agentParser.parseFile(manifest.metadata.agent_path);

  if (!agent) {
    console.warn("Could not load agent definition:", errors);
    // Continue with defaults
  }

  const auditConfig = agent?.audit ?? {};

  // Check if issue creation is enabled (default: true)
  if (auditConfig.create_issues === false) {
    console.log("Issue creation disabled for this agent");
    return {
      success: true,
      outputs: {},
      skipReason: "Issue creation disabled in agent config",
    };
  }

  // 3. Search for existing failure issue
  const labels = auditConfig.labels ?? ["agent-failure"];
  const existingIssue = await findExistingIssue(agentName, labels);

  // 4. Build issue body
  const issueBody = buildIssueBody(manifest, ctx);

  // 5. Create or update issue
  let issueUrl: string | undefined;

  try {
    if (existingIssue) {
      console.log(`Adding comment to existing issue #${existingIssue}`);
      await $`gh issue comment ${existingIssue} --body ${issueBody}`.quiet();

      const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
      issueUrl = `${serverUrl}/${ctx.repository}/issues/${existingIssue}`;
    } else {
      console.log("Creating new failure issue");
      const title = `${agentName}: Agent Execution Failed`;

      const args: string[] = ["issue", "create", "--title", title, "--body", issueBody];

      if (labels.length > 0) {
        args.push("--label", labels.join(","));
      }

      const assignees = auditConfig.assignees ?? [];
      if (assignees.length > 0) {
        args.push("--assignee", assignees.join(","));
      }

      const result = await $`gh ${args}`.quiet().text();
      issueUrl = result.trim();
    }

    if (issueUrl) {
      console.log(`Issue URL: ${issueUrl}`);
    }
  } catch (error) {
    console.error("Failed to create/update issue:", error);
    return {
      success: false,
      outputs: { error: "Failed to create/update GitHub issue" },
    };
  }

  return {
    success: true,
    outputs: {
      ...(issueUrl && { "issue-url": issueUrl }),
      ...(existingIssue && { "existing-issue": String(existingIssue) }),
    },
  };
};

/**
 * Search for an existing open failure issue for this agent.
 */
async function findExistingIssue(agentName: string, labels: string[]): Promise<number | undefined> {
  const searchLabel = labels[0] ?? "agent-failure";
  const searchQuery = `${agentName} failure`;

  try {
    const result =
      await $`gh issue list --state open --label ${searchLabel} --search ${searchQuery} --json number --jq '.[0].number'`
        .quiet()
        .text();

    const issueNumber = Number.parseInt(result.trim(), 10);
    return Number.isNaN(issueNumber) ? undefined : issueNumber;
  } catch {
    return undefined;
  }
}

/**
 * Build the issue body from the audit manifest.
 * Designed to surface the actual error prominently.
 */
function buildIssueBody(manifest: AuditManifest, ctx: StageContext): string {
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const workflowUrl = `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`;

  const lines: string[] = [];

  // Extract the actual error message - this is what matters most
  const errorMessage = extractErrorMessage(manifest);

  // Big prominent error callout at the top
  lines.push("## Error");
  lines.push("");
  lines.push(`> **${errorMessage}**`);
  lines.push("");

  // Remediation if available
  const remediation = extractRemediation(manifest);
  if (remediation) {
    lines.push(`**Fix:** ${remediation}`);
    lines.push("");
  }

  // Compact context line
  lines.push(
    `[View workflow run](${workflowUrl}) · Triggered by @${ctx.actor} via \`${ctx.eventName}\``,
  );
  lines.push("");

  // Tool permission issues are actionable - show them
  if (manifest.execution.tool_usage.permission_issues.length > 0) {
    lines.push("### Tool Permission Issues");
    lines.push("");

    for (const issue of manifest.execution.tool_usage.permission_issues) {
      lines.push(`- **${issue.tool}**: ${issue.message.slice(0, 200)}`);
    }
    lines.push("");
  }

  // Collapsed debug info
  lines.push("<details>");
  lines.push("<summary>Debug info</summary>");
  lines.push("");
  lines.push("```");
  lines.push(`Agent: ${manifest.metadata.agent_name}`);
  lines.push(`Session: ${manifest.execution.session_id ?? "N/A"}`);
  lines.push(`Cost: $${manifest.execution.metrics.total_cost_usd.toFixed(4)}`);
  lines.push(`Duration: ${Math.round(manifest.execution.metrics.duration_ms / 1000)}s`);
  lines.push(`Turns: ${manifest.execution.metrics.num_turns}`);
  lines.push("```");
  lines.push("");
  lines.push("</details>");

  return lines.join("\n");
}

/**
 * Extract the most relevant error message from the manifest.
 * Prioritizes the actual Claude error result over generic messages.
 */
function extractErrorMessage(manifest: AuditManifest): string {
  // 1. Check for Claude's actual result message (most specific)
  if (manifest.execution.result && manifest.execution.result !== "unknown") {
    return manifest.execution.result;
  }

  // 2. Check validation failures
  if (!manifest.validation.passed) {
    const failedChecks = Object.entries(manifest.validation.checks)
      .filter(([, check]) => !check.passed)
      .map(([name, check]) => check.reason || name);

    if (failedChecks.length > 0) {
      return failedChecks[0];
    }
  }

  // 3. Check for specific error in execution
  if (manifest.execution.error?.message) {
    return manifest.execution.error.message;
  }

  // 4. Fall back to first failure reason
  if (manifest.failures.reasons.length > 0) {
    const reason = manifest.failures.reasons[0];
    if (reason.message !== "Agent job failed") {
      return reason.message;
    }
  }

  // 5. Generic fallback
  return "Agent execution failed";
}

/**
 * Extract remediation advice from the manifest.
 */
function extractRemediation(manifest: AuditManifest): string | undefined {
  // Check issues for remediation
  for (const issue of manifest.issues) {
    if (issue.remediation) {
      return issue.remediation;
    }
  }

  // Check for common errors and provide remediation
  const errorMessage = extractErrorMessage(manifest);

  if (errorMessage.toLowerCase().includes("oauth") || errorMessage.toLowerCase().includes("token")) {
    return "Refresh the CLAUDE_CODE_OAUTH_TOKEN secret or configure ANTHROPIC_API_KEY.";
  }

  if (errorMessage.toLowerCase().includes("rate limit")) {
    return "Wait for the rate limit to reset, or increase rate_limit_minutes in the agent config.";
  }

  if (errorMessage.toLowerCase().includes("permission")) {
    return "Check the agent's permissions configuration and GitHub token scopes.";
  }

  return undefined;
}

/**
 * Convert agent name to URL-safe slug.
 */
function slugifyAgentName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract agent name from path like ".github/agents/my-agent.md"
 */
function extractAgentNameFromPath(path: string): string | undefined {
  const match = path.match(/([^/]+)\.md$/);
  if (match) {
    // Convert slug to title case
    return match[1]
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return undefined;
}
