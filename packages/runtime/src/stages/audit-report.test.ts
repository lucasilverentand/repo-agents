import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { StageContext } from "../types";
import { runAuditReport } from "./audit-report";

// Test fixtures
const createMockContext = (overrides?: Partial<StageContext>): StageContext => ({
  agentPath: "",
  eventPath: "/tmp/event.json",
  eventName: "issues",
  actor: "testuser",
  repository: "owner/repo",
  runId: "12345",
  ...overrides,
});

const createMockMetrics = (overrides?: Record<string, unknown>) => ({
  total_cost_usd: 0.0015,
  num_turns: 5,
  duration_ms: 30000,
  duration_api_ms: 25000,
  session_id: "test-session-123",
  is_error: false,
  ...overrides,
});

const createMockToolUsage = (overrides?: Record<string, unknown>) => ({
  total_calls: 10,
  by_tool: {
    Read: { calls: 5, successes: 5, failures: 0 },
    Write: { calls: 3, successes: 2, failures: 1 },
    Bash: { calls: 2, successes: 2, failures: 0 },
  },
  permission_issues: [],
  ...overrides,
});

describe("runAuditReport", () => {
  const testDir = "/tmp/all-audits";
  const auditOutputDir = "/tmp/audit";

  beforeEach(() => {
    // Clean up test directories
    rmSync(testDir, { recursive: true, force: true });
    rmSync(auditOutputDir, { recursive: true, force: true });
    mkdirSync(testDir, { recursive: true });

    // Mock environment variables
    process.env.GITHUB_SERVER_URL = "https://github.com";
    process.env.GITHUB_RUN_NUMBER = "42";
    process.env.GITHUB_RUN_ATTEMPT = "1";
    process.env.GITHUB_WORKFLOW = "AI Agents";
    process.env.GITHUB_REF = "refs/heads/main";
    process.env.GITHUB_SHA = "abc123";
    delete process.env.GITHUB_STEP_SUMMARY;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
    rmSync(auditOutputDir, { recursive: true, force: true });
  });

  test("returns empty results when no audits found", async () => {
    const ctx = createMockContext();
    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["has-failures"]).toBe("false");
    expect(result.outputs?.["total-agents"]).toBe("0");
  });

  test("processes single agent audit", async () => {
    const agentDir = join(testDir, "agent-test-agent-audit-12345");
    mkdirSync(agentDir, { recursive: true });

    writeFileSync(join(agentDir, "metrics.json"), JSON.stringify(createMockMetrics()));
    writeFileSync(join(agentDir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));

    const ctx = createMockContext({
      jobStatuses: {
        agent: "success",
      },
    });

    process.env.JOB_RESULTS = JSON.stringify({
      "agent-test-agent": { result: "success" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["has-failures"]).toBe("false");
    expect(result.outputs?.["total-agents"]).toBe("1");
    expect(result.outputs?.["total-cost"]).toBe("0.0015");
  });

  test("detects failures from job results", async () => {
    const agentDir = join(testDir, "agent-failing-agent-audit-12345");
    mkdirSync(agentDir, { recursive: true });

    writeFileSync(
      join(agentDir, "metrics.json"),
      JSON.stringify(createMockMetrics({ is_error: true })),
    );
    writeFileSync(join(agentDir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-failing-agent": { result: "failure" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["has-failures"]).toBe("true");
    expect(JSON.parse(result.outputs?.["failed-agents"] ?? "[]")).toContain("Failing Agent");
  });

  test("generates comprehensive markdown report", async () => {
    const agent1Dir = join(testDir, "agent-agent-one-audit-12345");
    const agent2Dir = join(testDir, "agent-agent-two-audit-12345");
    mkdirSync(agent1Dir, { recursive: true });
    mkdirSync(agent2Dir, { recursive: true });

    // Agent 1: successful
    writeFileSync(
      join(agent1Dir, "metrics.json"),
      JSON.stringify(createMockMetrics({ total_cost_usd: 0.002, num_turns: 8 })),
    );
    writeFileSync(join(agent1Dir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));

    // Agent 2: failed with permission issues
    writeFileSync(
      join(agent2Dir, "metrics.json"),
      JSON.stringify(createMockMetrics({ total_cost_usd: 0.001, is_error: true })),
    );
    writeFileSync(
      join(agent2Dir, "tool-usage.json"),
      JSON.stringify(
        createMockToolUsage({
          permission_issues: [
            {
              tool: "Write",
              issue_type: "restricted",
              message: "Path not in allowed-paths",
              timestamp: new Date().toISOString(),
            },
          ],
        }),
      ),
    );

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-agent-one": { result: "success" },
      "agent-agent-two": { result: "failure" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);

    // Check artifacts
    expect(result.artifacts).toBeDefined();
    expect(result.artifacts?.length).toBeGreaterThan(0);
  });

  test("generates report with all sections", async () => {
    const agentDir = join(testDir, "agent-full-agent-audit-12345");
    mkdirSync(agentDir, { recursive: true });

    writeFileSync(
      join(agentDir, "metrics.json"),
      JSON.stringify(
        createMockMetrics({
          input_tokens: 1500,
          output_tokens: 500,
        }),
      ),
    );
    writeFileSync(join(agentDir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-full-agent": { result: "success" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["has-failures"]).toBe("false");
  });

  test("handles multiple agents with mixed results", async () => {
    // Create 3 agents: 2 success, 1 failure
    const agents = ["success-one", "success-two", "failure-one"];

    for (const agent of agents) {
      const dir = join(testDir, `agent-${agent}-audit-12345`);
      mkdirSync(dir, { recursive: true });

      const isFailed = agent.startsWith("failure");
      writeFileSync(
        join(dir, "metrics.json"),
        JSON.stringify(createMockMetrics({ is_error: isFailed })),
      );
      writeFileSync(join(dir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));
    }

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-success-one": { result: "success" },
      "agent-success-two": { result: "success" },
      "agent-failure-one": { result: "failure" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["has-failures"]).toBe("true");
    expect(result.outputs?.["total-agents"]).toBe("3");

    const failedAgents = JSON.parse(result.outputs?.["failed-agents"] ?? "[]");
    expect(failedAgents.length).toBe(1);
  });

  test("handles missing metrics gracefully", async () => {
    const agentDir = join(testDir, "agent-no-metrics-audit-12345");
    mkdirSync(agentDir, { recursive: true });

    // Only write tool-usage, no metrics
    writeFileSync(join(agentDir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-no-metrics": { result: "success" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
  });

  test("calculates correct totals across all agents", async () => {
    const agents = [
      { slug: "agent-a", cost: 0.001, turns: 3 },
      { slug: "agent-b", cost: 0.002, turns: 5 },
      { slug: "agent-c", cost: 0.0015, turns: 4 },
    ];

    for (const agent of agents) {
      const dir = join(testDir, `agent-${agent.slug}-audit-12345`);
      mkdirSync(dir, { recursive: true });

      writeFileSync(
        join(dir, "metrics.json"),
        JSON.stringify(createMockMetrics({ total_cost_usd: agent.cost, num_turns: agent.turns })),
      );
      writeFileSync(join(dir, "tool-usage.json"), JSON.stringify(createMockToolUsage()));
    }

    const ctx = createMockContext();
    process.env.JOB_RESULTS = JSON.stringify({
      "agent-agent-a": { result: "success" },
      "agent-agent-b": { result: "success" },
      "agent-agent-c": { result: "success" },
    });

    const result = await runAuditReport(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs?.["total-agents"]).toBe("3");
    // Total cost: 0.001 + 0.002 + 0.0015 = 0.0045
    expect(parseFloat(result.outputs?.["total-cost"] ?? "0")).toBeCloseTo(0.0045);
  });
});
