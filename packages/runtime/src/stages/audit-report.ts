/**
 * Audit Report stage - generates combined audit manifest and GitHub step summary.
 *
 * This stage runs after all agent executions complete to:
 * 1. Download and parse all agent audit artifacts
 * 2. Build AuditManifest JSON for each agent
 * 3. Generate a combined summary markdown
 * 4. Write to GITHUB_STEP_SUMMARY for workflow UI visibility
 * 5. Output failed agents list for audit-issues job
 */

import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  AuditExecutionPhase,
  AuditFailureReason,
  AuditFailureSummary,
  AuditIssue,
  AuditManifest,
  AuditMetadata,
  AuditOutputResult,
  AuditOutputsPhase,
  AuditToolUsageSummary,
  AuditValidationPhase,
  ClaudeExecutionMetrics,
  CombinedAuditManifest,
} from "@repo-agents/types";

import type { JobResult, Stage, StageContext, StageResult } from "../types";

/** Job results from GitHub Actions needs context */
interface JobResults {
  [jobName: string]: {
    result: JobResult;
    outputs?: Record<string, string>;
  };
}

/** Parsed audit data from an agent's audit artifact */
interface AgentAuditData {
  agentSlug: string;
  agentName: string;
  agentPath: string;
  metrics?: ClaudeExecutionMetrics;
  toolUsage?: AuditToolUsageSummary;
  hasConversation: boolean;
  outputResults: AuditOutputResult[];
  jobResult?: JobResult;
}

/**
 * Audit report stage: combines all agent audits into a manifest and summary.
 */
export const runAuditReport: Stage = async (ctx: StageContext): Promise<StageResult> => {
  console.log("=== Audit Report Stage ===");

  const artifacts: Array<{ name: string; path: string }> = [];

  // 1. Parse job results from JOB_RESULTS environment variable
  const jobResultsEnv = process.env.JOB_RESULTS;
  const jobResults: JobResults = jobResultsEnv ? JSON.parse(jobResultsEnv) : {};

  // 2. Scan for downloaded audit artifacts
  const auditsDir = "/tmp/all-audits";
  const agentAudits = await collectAgentAudits(auditsDir, jobResults);

  if (agentAudits.length === 0) {
    console.log("No agent audits found");
    return {
      success: true,
      outputs: {
        "has-failures": "false",
        "failed-agents": "[]",
        "total-agents": "0",
        "total-cost": "0",
      },
    };
  }

  console.log(`Found ${agentAudits.length} agent audits`);

  // 3. Build AuditManifest for each agent
  const manifests: AuditManifest[] = [];
  const failedAgents: string[] = [];

  await mkdir("/tmp/audit/per-agent", { recursive: true });

  for (const auditData of agentAudits) {
    const manifest = buildAgentManifest(auditData, ctx, jobResults);
    manifests.push(manifest);

    // Save per-agent manifest
    const manifestPath = join("/tmp/audit/per-agent", `${auditData.agentSlug}.json`);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    if (manifest.failures.has_failures) {
      failedAgents.push(auditData.agentName);
    }
  }

  // 4. Generate combined summary markdown
  const summary = generateSummaryMarkdown(manifests, ctx);
  await writeFile("/tmp/audit/summary.md", summary);

  // 5. Write to GITHUB_STEP_SUMMARY
  const stepSummaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummaryPath) {
    await appendFile(stepSummaryPath, summary);
    console.log("Wrote summary to GITHUB_STEP_SUMMARY");
  }

  // 6. Save combined manifest
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const combinedManifest: CombinedAuditManifest = {
    schema_version: "1.0.0",
    generated_at: new Date().toISOString(),
    workflow_run_id: ctx.runId,
    workflow_run_url: `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`,
    agents: manifests,
    summary: {
      total_agents: manifests.length,
      successful_agents: manifests.filter((m) => !m.failures.has_failures).length,
      failed_agents: failedAgents.length,
      total_cost_usd: manifests.reduce(
        (sum, m) => sum + (m.execution.metrics.total_cost_usd || 0),
        0,
      ),
      total_duration_ms: manifests.reduce(
        (sum, m) => sum + (m.execution.metrics.duration_ms || 0),
        0,
      ),
    },
  };

  await writeFile("/tmp/audit/manifest.json", JSON.stringify(combinedManifest, null, 2));

  artifacts.push({ name: "audit-manifest", path: "/tmp/audit/" });

  // Log summary
  console.log(`\nAudit Summary:`);
  console.log(`  Total agents: ${manifests.length}`);
  console.log(`  Successful: ${combinedManifest.summary.successful_agents}`);
  console.log(`  Failed: ${failedAgents.length}`);
  console.log(`  Total cost: $${combinedManifest.summary.total_cost_usd.toFixed(4)}`);

  return {
    success: true,
    outputs: {
      "has-failures": failedAgents.length > 0 ? "true" : "false",
      "failed-agents": JSON.stringify(failedAgents),
      "total-agents": String(manifests.length),
      "total-cost": String(combinedManifest.summary.total_cost_usd),
    },
    artifacts,
  };
};

/**
 * Collect audit data from all downloaded agent artifacts.
 */
async function collectAgentAudits(
  auditsDir: string,
  jobResults: JobResults,
): Promise<AgentAuditData[]> {
  const audits: AgentAuditData[] = [];

  if (!existsSync(auditsDir)) {
    return audits;
  }

  try {
    const entries = await readdir(auditsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Artifact names are like: agent-{slug}-audit-{runId}
      const match = entry.name.match(/^agent-(.+)-audit-\d+$/);
      if (!match) continue;

      const agentSlug = match[1];
      const artifactPath = join(auditsDir, entry.name);

      const auditData = await parseAgentAudit(agentSlug, artifactPath, jobResults);
      if (auditData) {
        audits.push(auditData);
      }
    }
  } catch (error) {
    console.error("Failed to collect agent audits:", error);
  }

  return audits;
}

/**
 * Parse audit data from a single agent's artifact directory.
 */
async function parseAgentAudit(
  agentSlug: string,
  artifactPath: string,
  jobResults: JobResults,
): Promise<AgentAuditData | undefined> {
  const metricsPath = join(artifactPath, "metrics.json");
  const toolUsagePath = join(artifactPath, "tool-usage.json");
  const conversationPath = join(artifactPath, "conversation.jsonl");

  // Read metrics
  let metrics: ClaudeExecutionMetrics | undefined;
  if (existsSync(metricsPath)) {
    try {
      const content = await readFile(metricsPath, "utf-8");
      metrics = JSON.parse(content);
    } catch {
      console.warn(`Failed to parse metrics for ${agentSlug}`);
    }
  }

  // Read tool usage
  let toolUsage: AuditToolUsageSummary | undefined;
  if (existsSync(toolUsagePath)) {
    try {
      const content = await readFile(toolUsagePath, "utf-8");
      toolUsage = JSON.parse(content);
    } catch {
      console.warn(`Failed to parse tool usage for ${agentSlug}`);
    }
  }

  // Check for conversation file
  const hasConversation = existsSync(conversationPath);

  // Find agent definition path (best effort)
  const agentPath = `.github/agents/${agentSlug}.md`;

  // Derive agent name from slug (reverse slugification)
  const agentName = agentSlug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Get job result
  const jobResult = jobResults[`agent-${agentSlug}`]?.result;

  return {
    agentSlug,
    agentName,
    agentPath,
    metrics,
    toolUsage,
    hasConversation,
    outputResults: [], // Will be populated from outputs artifact if available
    jobResult,
  };
}

/**
 * Build AuditManifest for a single agent.
 */
function buildAgentManifest(
  auditData: AgentAuditData,
  ctx: StageContext,
  jobResults: JobResults,
): AuditManifest {
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const workflowUrl = `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`;

  // Build metadata
  const metadata: AuditMetadata = {
    agent_name: auditData.agentName,
    agent_path: auditData.agentPath,
    workflow: {
      run_id: ctx.runId,
      run_number: Number(process.env.GITHUB_RUN_NUMBER) || 0,
      run_attempt: Number(process.env.GITHUB_RUN_ATTEMPT) || 1,
      workflow_name: process.env.GITHUB_WORKFLOW || "AI Agents",
      workflow_url: workflowUrl,
      job_name: `agent-${auditData.agentSlug}`,
    },
    trigger: {
      event_name: ctx.eventName,
      actor: ctx.actor,
      repository: ctx.repository,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
    },
    timing: {
      workflow_started_at: process.env.GITHUB_RUN_STARTED_AT || new Date().toISOString(),
      agent_started_at: undefined, // Not tracked currently
      agent_completed_at: undefined, // Not tracked currently
      total_duration_ms: auditData.metrics?.duration_ms || 0,
    },
  };

  // Build validation phase (dispatcher already validated, so assume passed if we got here)
  const validation: AuditValidationPhase = {
    passed: true,
    checks: {
      secrets_check: { passed: true },
      user_authorization: { passed: true },
      trigger_labels: { passed: true },
      rate_limit: { passed: true },
      max_open_prs: { passed: true },
      blocking_issues: { passed: true },
    },
  };

  // Build execution phase
  const execution: AuditExecutionPhase = {
    success: auditData.jobResult === "success" && !auditData.metrics?.is_error,
    session_id: auditData.metrics?.session_id,
    metrics: {
      total_cost_usd: auditData.metrics?.total_cost_usd || 0,
      num_turns: auditData.metrics?.num_turns || 0,
      duration_ms: auditData.metrics?.duration_ms || 0,
      duration_api_ms: auditData.metrics?.duration_api_ms || 0,
    },
    conversation_file: auditData.hasConversation ? "conversation.jsonl" : undefined,
    tool_usage: auditData.toolUsage || {
      total_calls: 0,
      by_tool: {},
      permission_issues: [],
    },
    result: auditData.metrics?.result,
    error:
      auditData.metrics?.is_error || auditData.jobResult === "failure"
        ? { type: "execution_error", message: "Agent execution failed" }
        : undefined,
  };

  // Build outputs phase
  const outputs: AuditOutputsPhase = {
    configured_count: 0,
    executed_count: auditData.outputResults.length,
    results: auditData.outputResults,
  };

  // Build failures summary
  const failures = detectFailures(auditData, execution);

  // Build issues list
  const issues = buildIssuesList(auditData, execution, failures);

  return {
    schema_version: "1.0.0",
    audit_id: `${ctx.runId}-${auditData.agentSlug}`,
    generated_at: new Date().toISOString(),
    metadata,
    validation,
    execution,
    outputs,
    failures,
    issues,
  };
}

/**
 * Detect failures from audit data.
 */
function detectFailures(
  auditData: AgentAuditData,
  execution: AuditExecutionPhase,
): AuditFailureSummary {
  const reasons: AuditFailureReason[] = [];

  // Check job result
  if (auditData.jobResult === "failure") {
    reasons.push({
      category: "execution",
      message: "Agent job failed",
      severity: "error",
    });
  }

  if (auditData.jobResult === "cancelled") {
    reasons.push({
      category: "execution",
      message: "Agent job was cancelled",
      severity: "warning",
    });
  }

  // Check Claude execution error
  if (auditData.metrics?.is_error) {
    reasons.push({
      category: "execution",
      message: "Claude execution returned an error",
      severity: "error",
    });
  }

  // Check for permission issues
  if (execution.tool_usage.permission_issues.length > 0) {
    reasons.push({
      category: "permission",
      message: `${execution.tool_usage.permission_issues.length} tool permission issue(s) detected`,
      severity: "warning",
      details: { issues: execution.tool_usage.permission_issues },
    });
  }

  // Check output failures
  const failedOutputs = auditData.outputResults.filter((r) => !r.execution_succeeded);
  if (failedOutputs.length > 0) {
    reasons.push({
      category: "output",
      message: `${failedOutputs.length} output(s) failed to execute`,
      severity: "error",
      details: { failed_outputs: failedOutputs.map((o) => o.type) },
    });
  }

  // Determine overall severity
  let severity: "none" | "warning" | "error" | "critical" = "none";
  if (reasons.some((r) => r.severity === "critical")) {
    severity = "critical";
  } else if (reasons.some((r) => r.severity === "error")) {
    severity = "error";
  } else if (reasons.some((r) => r.severity === "warning")) {
    severity = "warning";
  }

  return {
    has_failures: reasons.length > 0,
    failure_count: reasons.length,
    reasons,
    severity,
  };
}

/**
 * Build list of audit issues from detected problems.
 */
function buildIssuesList(
  auditData: AgentAuditData,
  execution: AuditExecutionPhase,
  failures: AuditFailureSummary,
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const timestamp = new Date().toISOString();

  // Add permission issues as audit issues
  for (const permIssue of execution.tool_usage.permission_issues) {
    issues.push({
      id: `perm-${permIssue.tool}-${Date.now()}`,
      type: permIssue.issue_type === "not_allowed" ? "tool_not_allowed" : "path_restriction",
      severity: "warning",
      message: permIssue.message,
      timestamp: permIssue.timestamp,
      context: { tool: permIssue.tool },
      remediation: `Check agent configuration to ensure tool "${permIssue.tool}" is allowed.`,
    });
  }

  // Add execution failure as issue
  if (auditData.metrics?.is_error) {
    issues.push({
      id: `exec-error-${Date.now()}`,
      type: "validation_error",
      severity: "error",
      message: "Claude execution returned an error",
      timestamp,
      remediation: "Check the conversation history for details on what went wrong.",
    });
  }

  return issues;
}

/**
 * Generate markdown summary for GitHub Step Summary.
 */
function generateSummaryMarkdown(manifests: AuditManifest[], ctx: StageContext): string {
  const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
  const workflowUrl = `${serverUrl}/${ctx.repository}/actions/runs/${ctx.runId}`;

  const totalCost = manifests.reduce((sum, m) => sum + m.execution.metrics.total_cost_usd, 0);
  const failedCount = manifests.filter((m) => m.failures.has_failures).length;

  const lines: string[] = [
    "# Agent Execution Summary",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Agents Executed | ${manifests.length} |`,
    `| Total Cost | $${totalCost.toFixed(4)} |`,
    `| Failures | ${failedCount} |`,
    "",
    "## Agent Results",
    "",
    "| Agent | Status | Cost | Turns | Duration |",
    "|-------|--------|------|-------|----------|",
  ];

  for (const manifest of manifests) {
    const status = manifest.failures.has_failures ? "FAIL" : "OK";
    const cost = `$${manifest.execution.metrics.total_cost_usd.toFixed(4)}`;
    const turns = manifest.execution.metrics.num_turns;
    const duration = `${Math.round(manifest.execution.metrics.duration_ms / 1000)}s`;

    lines.push(
      `| ${manifest.metadata.agent_name} | ${status} | ${cost} | ${turns} | ${duration} |`,
    );
  }

  // Add failures section if any
  const failedManifests = manifests.filter((m) => m.failures.has_failures);
  if (failedManifests.length > 0) {
    lines.push("");
    lines.push("## Failures");
    lines.push("");

    for (const manifest of failedManifests) {
      lines.push(`### ${manifest.metadata.agent_name}`);
      lines.push("");

      for (const reason of manifest.failures.reasons) {
        lines.push(`- **Category**: ${reason.category}`);
        lines.push(`- **Message**: ${reason.message}`);
        lines.push(`- **Severity**: ${reason.severity}`);
        lines.push("");
      }
    }
  }

  lines.push("");
  lines.push("---");
  lines.push(`[View Workflow Run](${workflowUrl})`);
  lines.push("");

  return lines.join("\n");
}
