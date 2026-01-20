/**
 * Audit stage - generates reports and optionally creates failure issues.
 *
 * This stage runs at the end of every workflow (even on failure) to:
 * 1. Load the agent definition
 * 2. Collect audit data from previous stages
 * 3. Detect failures from job statuses and metrics
 * 4. Generate a markdown audit report
 * 5. Create a GitHub issue for failures (if configured)
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition, ClaudeExecutionMetrics, PermissionIssue } from "@repo-agents/types";
import { $ } from "bun";

import type { Stage, StageContext, StageResult } from "../types";

/** Paths where audit data is collected from previous stages */
const AUDIT_PATHS = {
  /**
   * Validation data paths (from pre-flight).
   * Note: Pre-flight runs in the dispatcher workflow, so these files are only
   * available if explicitly downloaded from the dispatcher's artifacts.
   */
  validationStatus: "/tmp/audit-data/validation/validation-status.json",
  permissionIssues: "/tmp/audit-data/validation/permission-issues.json",
  /** From agent execution stage */
  metrics: "/tmp/audit-data/metrics/metrics.json",
  /** From outputs stage */
  outputsDir: "/tmp/audit-data/outputs",
} as const;

/** Validation status (from pre-flight, if available) */
interface ValidationStatus {
  secrets_check: boolean;
  user_authorization: boolean;
  labels_check: boolean;
  rate_limit_check: boolean;
}

/** Output validation result from outputs stage */
interface OutputValidationResult {
  outputType: string;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

/** Audit data collected from all stages */
interface AuditData {
  validationStatus?: ValidationStatus;
  permissionIssues: PermissionIssue[];
  metrics?: ClaudeExecutionMetrics;
  outputResults: OutputValidationResult[];
}

/** Failure information for reporting */
interface FailureInfo {
  hasFailures: boolean;
  reasons: string[];
}

/**
 * Safely reads and parses a JSON file, returning undefined if not found.
 */
async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

/**
 * Collects audit data from files written by previous stages.
 */
async function collectAuditData(): Promise<AuditData> {
  const [validationStatus, permissionIssues, metrics] = await Promise.all([
    readJsonFile<ValidationStatus>(AUDIT_PATHS.validationStatus),
    readJsonFile<PermissionIssue[]>(AUDIT_PATHS.permissionIssues),
    readJsonFile<ClaudeExecutionMetrics>(AUDIT_PATHS.metrics),
  ]);

  // Collect output validation results from outputs directory
  const outputResults: OutputValidationResult[] = [];
  try {
    if (existsSync(AUDIT_PATHS.outputsDir)) {
      const files = await readdir(AUDIT_PATHS.outputsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const result = await readJsonFile<OutputValidationResult>(
            join(AUDIT_PATHS.outputsDir, file),
          );
          if (result) {
            outputResults.push(result);
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist or is empty - that's fine
  }

  return {
    validationStatus,
    permissionIssues: permissionIssues ?? [],
    metrics,
    outputResults,
  };
}

/**
 * Detects failures from job statuses and audit data.
 */
function detectFailures(ctx: StageContext, auditData: AuditData): FailureInfo {
  const reasons: string[] = [];
  const { jobStatuses } = ctx;

  // Rate-limited runs are not failures
  if (jobStatuses?.rateLimited) {
    return { hasFailures: false, reasons: [] };
  }

  // Check job results
  // Note: Pre-flight checks run in dispatcher, not in agent workflows
  if (jobStatuses?.agent && jobStatuses.agent !== "success" && jobStatuses.agent !== "skipped") {
    reasons.push(`Agent execution failed (${jobStatuses.agent})`);
  }

  if (
    jobStatuses?.executeOutputs &&
    jobStatuses.executeOutputs !== "success" &&
    jobStatuses.executeOutputs !== "skipped"
  ) {
    reasons.push(`Output execution failed (${jobStatuses.executeOutputs})`);
  }

  // Check for permission issues
  if (auditData.permissionIssues.length > 0) {
    reasons.push(`Permission/validation issues detected (${auditData.permissionIssues.length})`);
  }

  // Check if Claude had an error
  if (auditData.metrics?.is_error) {
    reasons.push("Claude execution returned an error");
  }

  // Check output validation failures
  const failedOutputs = auditData.outputResults.filter((r) => !r.success);
  if (failedOutputs.length > 0) {
    reasons.push(
      `Output validation failed for: ${failedOutputs.map((r) => r.outputType).join(", ")}`,
    );
  }

  return {
    hasFailures: reasons.length > 0,
    reasons,
  };
}

/**
 * Generates a markdown audit report.
 */
function generateAuditReport(
  agent: AgentDefinition,
  ctx: StageContext,
  auditData: AuditData,
  failures: FailureInfo,
): string {
  const timestamp = new Date().toISOString();
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`;

  const lines: string[] = [
    "# Agent Execution Audit Report",
    "",
    `**Agent:** ${agent.name}`,
    `**Workflow Run:** [${ctx.runId}](${runUrl})`,
    `**Triggered by:** @${ctx.actor}`,
    `**Event:** ${ctx.eventName}`,
    `**Timestamp:** ${timestamp}`,
    "",
  ];

  // Job Results section
  lines.push("## Job Results", "");
  lines.push("| Job | Result |");
  lines.push("|-----|--------|");

  const formatJobResult = (result?: string): string => {
    if (!result) return "- N/A";
    if (result === "success") return `[OK] ${result}`;
    if (result === "skipped") return `[SKIP] ${result}`;
    return `[FAIL] ${result}`;
  };

  lines.push(`| agent | ${formatJobResult(ctx.jobStatuses?.agent)} |`);

  if (ctx.jobStatuses?.collectContext) {
    lines.push(`| collect-context | ${formatJobResult(ctx.jobStatuses.collectContext)} |`);
  }

  if (ctx.jobStatuses?.executeOutputs) {
    lines.push(`| execute-outputs | ${formatJobResult(ctx.jobStatuses.executeOutputs)} |`);
  }

  lines.push("");

  // Execution Metrics section
  if (auditData.metrics) {
    const { total_cost_usd, num_turns, duration_ms, session_id } = auditData.metrics;

    lines.push("## Execution Metrics", "");
    lines.push("| Metric | Value |");
    lines.push("|--------|-------|");
    lines.push(`| Cost | $${total_cost_usd ?? "N/A"} |`);
    lines.push(`| Turns | ${num_turns ?? "N/A"} |`);
    lines.push(`| Duration | ${duration_ms ?? "N/A"}ms |`);
    lines.push(`| Session | \`${session_id ?? "N/A"}\` |`);
    lines.push("");
  }

  // Validation Results section
  if (auditData.validationStatus) {
    lines.push("## Validation Results", "");
    lines.push("| Check | Status |");
    lines.push("|-------|--------|");

    const formatCheck = (passed: boolean): string => (passed ? "[OK] Passed" : "[FAIL] Failed");

    lines.push(`| Secrets | ${formatCheck(auditData.validationStatus.secrets_check)} |`);
    lines.push(
      `| User Authorization | ${formatCheck(auditData.validationStatus.user_authorization)} |`,
    );
    lines.push(`| Labels | ${formatCheck(auditData.validationStatus.labels_check)} |`);
    lines.push(`| Rate Limit | ${formatCheck(auditData.validationStatus.rate_limit_check)} |`);
    lines.push("");
  }

  // Permission Issues section
  if (auditData.permissionIssues.length > 0) {
    lines.push("## Permission Issues", "");
    for (const issue of auditData.permissionIssues) {
      lines.push(`- **[${issue.severity.toUpperCase()}]** ${issue.issue_type}: ${issue.message}`);
    }
    lines.push("");
  }

  // Output Execution section
  if (auditData.outputResults.length > 0) {
    lines.push("## Output Execution", "");
    lines.push("| Output Type | Status | Details |");
    lines.push("|-------------|--------|---------|");

    for (const result of auditData.outputResults) {
      const status = result.success ? "[OK] Success" : "[FAIL] Failed";
      const details = result.error ?? "-";
      lines.push(`| ${result.outputType} | ${status} | ${details} |`);
    }
    lines.push("");
  }

  // Errors section (if any failures)
  if (failures.hasFailures) {
    lines.push("## Errors", "");
    for (const reason of failures.reasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Checks if a similar failure issue already exists.
 */
async function findExistingIssue(agentName: string, labels: string[]): Promise<number | undefined> {
  const searchLabel = labels[0] ?? "agent-failure";
  const searchQuery = `${agentName} failure`;

  try {
    const result =
      await $`gh issue list --state open --label ${searchLabel} --search ${searchQuery} --json number --jq '.[0].number'`
        .quiet()
        .text();
    const issueNumber = parseInt(result.trim(), 10);
    return Number.isNaN(issueNumber) ? undefined : issueNumber;
  } catch {
    return undefined;
  }
}

/**
 * Creates a failure issue or adds a comment to an existing one.
 */
async function createOrUpdateFailureIssue(
  agent: AgentDefinition,
  ctx: StageContext,
  report: string,
  failures: FailureInfo,
): Promise<string | undefined> {
  const auditConfig = agent.audit ?? {};
  const labels = auditConfig.labels ?? ["agent-failure"];
  const assignees = auditConfig.assignees ?? [];

  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const runUrl = `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`;
  const timestamp = new Date().toISOString();

  // Build issue body
  const issueBody = `## Agent Failure Report

The **${agent.name}** agent encountered failures during execution.

### Workflow Details
- **Run ID:** [${ctx.runId}](${runUrl})
- **Triggered by:** @${ctx.actor}
- **Event:** ${ctx.eventName}
- **Time:** ${timestamp}

### Failure Summary
${failures.reasons.map((r) => `- ${r}`).join("\n")}

---

<details>
<summary>Full Audit Report</summary>

${report}

</details>

---

*This issue was automatically created by the Repo Agents audit system.*`;

  // Check for existing issue
  const existingIssue = await findExistingIssue(agent.name, labels);

  try {
    if (existingIssue) {
      console.log(`Adding comment to existing issue #${existingIssue}`);
      await $`gh issue comment ${existingIssue} --body ${issueBody}`.quiet();
      return `${serverUrl}/${ctx.repository}/issues/${existingIssue}`;
    } else {
      console.log("Creating new failure issue");
      const title = `${agent.name}: Agent Execution Failed`;

      // Build command arguments
      const args: string[] = ["issue", "create", "--title", title, "--body", issueBody];

      if (labels.length > 0) {
        args.push("--label", labels.join(","));
      }
      if (assignees.length > 0) {
        args.push("--assignee", assignees.join(","));
      }

      // Run gh issue create and capture the URL
      const result = await $`gh ${args}`.quiet().text();

      // gh issue create returns the issue URL
      return result.trim();
    }
  } catch (error) {
    console.error("Failed to create/update failure issue:", error);
    return undefined;
  }
}

/**
 * Audit stage: collects metrics, generates reports, and handles failure notifications.
 */
export const runAudit: Stage = async (ctx: StageContext): Promise<StageResult> => {
  console.log("=== Audit Stage ===");

  const artifacts: Array<{ name: string; path: string }> = [];

  // Load agent definition
  const { agent, errors } = await agentParser.parseFile(ctx.agentPath);

  if (!agent || errors.some((e) => e.severity === "error")) {
    console.error("Failed to parse agent definition:", errors);
    // Still return success - audit stage should not fail the workflow
    return {
      success: true,
      outputs: {
        "has-failures": "true",
        "parse-error": "true",
      },
    };
  }

  // Check for rate-limited runs (not a failure, just skipped)
  if (ctx.jobStatuses?.rateLimited) {
    console.log("Agent run was rate-limited. This is expected behavior, not a failure.");
    return {
      success: true,
      outputs: {
        "has-failures": "false",
      },
      skipReason: "Rate-limited run",
    };
  }

  // Collect audit data from previous stages
  const auditData = await collectAuditData();

  // Detect failures
  const failures = detectFailures(ctx, auditData);

  // Generate audit report
  const report = generateAuditReport(agent, ctx, auditData, failures);

  // Write report to file
  const auditDir = "/tmp/audit";
  await mkdir(auditDir, { recursive: true });
  await writeFile(join(auditDir, "report.md"), report);

  artifacts.push({ name: "audit-report", path: auditDir });

  // Log summary
  if (failures.hasFailures) {
    console.error("Agent execution had failures:");
    for (const reason of failures.reasons) {
      console.error(`  - ${reason}`);
    }
    console.log("\n--- Audit Report ---");
    console.log(report);
  } else {
    console.log("Agent execution completed successfully");
    console.log("View full audit report in workflow artifacts");
  }

  // Create failure issue if configured and there are failures
  let issueUrl: string | undefined;
  const createIssues = agent.audit?.create_issues !== false; // Default true

  if (failures.hasFailures && createIssues) {
    issueUrl = await createOrUpdateFailureIssue(agent, ctx, report, failures);
    if (issueUrl) {
      console.log(`Failure issue: ${issueUrl}`);
    }
  }

  // Audit stage always succeeds (we don't want to fail the workflow just because audit failed)
  return {
    success: true,
    outputs: {
      "has-failures": failures.hasFailures ? "true" : "false",
      ...(issueUrl && { "issue-url": issueUrl }),
    },
    artifacts,
  };
};
