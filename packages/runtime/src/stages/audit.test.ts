import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

describe("runAudit", () => {
  const testDir = "/tmp/repo-agents-audit-test";
  const agentPath = join(testDir, "test-agent.md");

  const validAgentMd = `---
name: Test Agent
on:
  issues:
    types: [opened]
audit:
  create_issues: false
---

You are a test agent. Please analyze the issue and provide a helpful response.
`;

  const createContext = (overrides = {}) => ({
    repository: "owner/repo",
    runId: "12345",
    actor: "testuser",
    eventName: "issues",
    eventPath: "",
    agentPath,
    jobStatuses: {
      agent: "success" as const,
    },
    ...overrides,
  });

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });

    // Write valid agent file
    await writeFile(agentPath, validAgentMd);

    // Clean up any previous test artifacts
    for (const p of ["/tmp/audit", "/tmp/audit-data"]) {
      if (existsSync(p)) {
        await rm(p, { recursive: true, force: true });
      }
    }
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    // Clean up audit directories
    for (const p of ["/tmp/audit", "/tmp/audit-data"]) {
      if (existsSync(p)) {
        await rm(p, { recursive: true, force: true });
      }
    }
  });

  describe("agent file parsing", () => {
    it("should return parse-error when agent file does not exist", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        agentPath: "/nonexistent/path/agent.md",
      });

      // Audit stage always succeeds
      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
      expect(result.outputs["parse-error"]).toBe("true");
    });
  });

  describe("rate-limited runs", () => {
    it("should skip audit for rate-limited runs", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "skipped" as const,
          rateLimited: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
      expect(result.skipReason).toBe("Rate-limited run");
    });
  });

  describe("failure detection", () => {
    // Note: Pre-flight checks now run in the dispatcher, not in agent workflows.
    // The agent workflow audit stage only tracks the agent and execute-outputs jobs.

    it("should detect agent failures", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });

    it("should detect execute-outputs failures", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "success" as const,
          executeOutputs: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });

    it("should not count skipped jobs as failures", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "skipped" as const,
          executeOutputs: "skipped" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
    });
  });

  describe("audit data collection", () => {
    it("should detect failures from metrics.json is_error", async () => {
      const { runAudit } = await import("./audit");

      // Create audit data directories
      await mkdir("/tmp/audit-data/metrics", { recursive: true });
      await writeFile(
        "/tmp/audit-data/metrics/metrics.json",
        JSON.stringify({ is_error: true, total_cost_usd: 0.01 }),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });

    it("should detect permission issues", async () => {
      const { runAudit } = await import("./audit");

      // Create audit data directories
      await mkdir("/tmp/audit-data/validation", { recursive: true });
      await writeFile(
        "/tmp/audit-data/validation/permission-issues.json",
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            issue_type: "missing_permission",
            severity: "error",
            message: "Test permission issue",
          },
        ]),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });
  });

  describe("report generation", () => {
    it("should generate audit report file", async () => {
      const { runAudit } = await import("./audit");

      await runAudit(createContext());

      expect(existsSync("/tmp/audit/report.md")).toBe(true);
    });

    it("should include artifacts in result", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit(createContext());

      expect(result.artifacts).toBeDefined();
      expect(result.artifacts?.length).toBeGreaterThan(0);
      expect(result.artifacts?.[0].name).toBe("audit-report");
    });
  });

  describe("module integration", () => {
    it("should export runAudit function", async () => {
      const auditModule = await import("./audit");
      expect(typeof auditModule.runAudit).toBe("function");
    });

    it("should conform to Stage type signature", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit(createContext());

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("outputs");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.outputs).toBe("object");
    });
  });
});
