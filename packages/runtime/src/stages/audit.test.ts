import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

  const validAgentMdWithIssues = `---
name: Test Agent with Issues
on:
  issues:
    types: [opened]
audit:
  create_issues: true
  labels:
    - agent-failure
    - critical
  assignees:
    - testuser
---

You are a test agent that creates issues on failure.
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

  describe("output validation failures", () => {
    it("should detect failed output validations", async () => {
      const { runAudit } = await import("./audit");

      // Create outputs directory with failed validation results
      await mkdir("/tmp/audit-data/outputs", { recursive: true });
      await writeFile(
        "/tmp/audit-data/outputs/add-comment.json",
        JSON.stringify({
          outputType: "add-comment",
          success: false,
          error: "Comment body exceeds maximum length",
        }),
      );
      await writeFile(
        "/tmp/audit-data/outputs/create-pr.json",
        JSON.stringify({
          outputType: "create-pr",
          success: false,
          error: "Invalid branch name",
        }),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");

      // Verify report includes output failures
      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("## Output Execution");
      expect(report).toContain("add-comment");
      expect(report).toContain("create-pr");
      expect(report).toContain("Comment body exceeds maximum length");
      expect(report).toContain("Invalid branch name");
    });

    it("should detect successful output validations", async () => {
      const { runAudit } = await import("./audit");

      // Create outputs directory with successful validation results
      await mkdir("/tmp/audit-data/outputs", { recursive: true });
      await writeFile(
        "/tmp/audit-data/outputs/add-comment.json",
        JSON.stringify({
          outputType: "add-comment",
          success: true,
        }),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");

      // Verify report includes successful output
      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("## Output Execution");
      expect(report).toContain("add-comment");
      expect(report).toContain("[OK] Success");
    });

    it("should handle outputs directory with non-JSON files", async () => {
      const { runAudit } = await import("./audit");

      // Create outputs directory with mixed files
      await mkdir("/tmp/audit-data/outputs", { recursive: true });
      await writeFile(
        "/tmp/audit-data/outputs/add-comment.json",
        JSON.stringify({
          outputType: "add-comment",
          success: true,
        }),
      );
      await writeFile("/tmp/audit-data/outputs/readme.txt", "This is not a JSON file");

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      // Should only process the JSON file
      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("add-comment");
    });

    it("should handle malformed JSON in outputs directory", async () => {
      const { runAudit } = await import("./audit");

      // Create outputs directory with invalid JSON
      await mkdir("/tmp/audit-data/outputs", { recursive: true });
      await writeFile("/tmp/audit-data/outputs/bad.json", "{ invalid json }");

      const result = await runAudit(createContext());

      // Should not crash, just skip the malformed file
      expect(result.success).toBe(true);
    });
  });

  describe("complete audit report generation", () => {
    it("should generate complete report with all sections", async () => {
      const { runAudit } = await import("./audit");

      // Create all audit data
      await mkdir("/tmp/audit-data/validation", { recursive: true });
      await mkdir("/tmp/audit-data/metrics", { recursive: true });
      await mkdir("/tmp/audit-data/outputs", { recursive: true });

      await writeFile(
        "/tmp/audit-data/validation/validation-status.json",
        JSON.stringify({
          secrets_check: true,
          user_authorization: false,
          labels_check: true,
          rate_limit_check: true,
        }),
      );

      await writeFile(
        "/tmp/audit-data/validation/permission-issues.json",
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            issue_type: "unauthorized_user",
            severity: "error",
            message: "User is not authorized",
          },
        ]),
      );

      await writeFile(
        "/tmp/audit-data/metrics/metrics.json",
        JSON.stringify({
          total_cost_usd: 0.05,
          num_turns: 3,
          duration_ms: 15000,
          session_id: "test-session-123",
          is_error: false,
        }),
      );

      await writeFile(
        "/tmp/audit-data/outputs/add-comment.json",
        JSON.stringify({
          outputType: "add-comment",
          success: true,
        }),
      );

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "success" as const,
          collectContext: "success" as const,
          executeOutputs: "success" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true"); // Due to permission issue

      // Verify report has all sections
      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("# Agent Execution Audit Report");
      expect(report).toContain("## Job Results");
      expect(report).toContain("## Execution Metrics");
      expect(report).toContain("## Validation Results");
      expect(report).toContain("## Permission Issues");
      expect(report).toContain("## Output Execution");
      expect(report).toContain("## Errors");

      // Verify job results table includes collect-context
      expect(report).toContain("collect-context");
      expect(report).toContain("[OK] success");

      // Verify metrics
      expect(report).toContain("$0.05");
      expect(report).toContain("3");
      expect(report).toContain("15000ms");
      expect(report).toContain("test-session-123");

      // Verify validation results
      expect(report).toContain("[OK] Passed"); // secrets_check
      expect(report).toContain("[FAIL] Failed"); // user_authorization
    });

    it("should generate minimal report with no audit data", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("# Agent Execution Audit Report");
      expect(report).toContain("## Job Results");
      // Should not contain optional sections
      expect(report).not.toContain("## Execution Metrics");
      expect(report).not.toContain("## Validation Results");
      expect(report).not.toContain("## Permission Issues");
      expect(report).not.toContain("## Output Execution");
      expect(report).not.toContain("## Errors");
    });

    it("should format job results correctly", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "success" as const,
          collectContext: "skipped" as const,
          executeOutputs: "cancelled" as const,
        },
      });

      expect(result.success).toBe(true);

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("[OK] success"); // agent
      expect(report).toContain("[SKIP] skipped"); // collectContext
      expect(report).toContain("[FAIL] cancelled"); // executeOutputs
    });

    it("should handle metrics with missing fields", async () => {
      const { runAudit } = await import("./audit");

      await mkdir("/tmp/audit-data/metrics", { recursive: true });
      await writeFile(
        "/tmp/audit-data/metrics/metrics.json",
        JSON.stringify({
          total_cost_usd: 0.02,
          // Missing num_turns, duration_ms, session_id
        }),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("## Execution Metrics");
      expect(report).toContain("$0.02");
      expect(report).toContain("N/A"); // For missing fields
    });

    it("should include workflow run URL in report", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("https://github.com/owner/repo/actions/runs/12345");
    });
  });

  describe("failure scenarios", () => {
    it("should detect multiple failure types simultaneously", async () => {
      const { runAudit } = await import("./audit");

      // Create multiple failure conditions
      await mkdir("/tmp/audit-data/validation", { recursive: true });
      await mkdir("/tmp/audit-data/metrics", { recursive: true });
      await mkdir("/tmp/audit-data/outputs", { recursive: true });

      await writeFile(
        "/tmp/audit-data/validation/permission-issues.json",
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            issue_type: "missing_permission",
            severity: "error",
            message: "Missing write permission",
          },
        ]),
      );

      await writeFile(
        "/tmp/audit-data/metrics/metrics.json",
        JSON.stringify({
          is_error: true,
          total_cost_usd: 0.01,
        }),
      );

      await writeFile(
        "/tmp/audit-data/outputs/create-pr.json",
        JSON.stringify({
          outputType: "create-pr",
          success: false,
          error: "Branch creation failed",
        }),
      );

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
          executeOutputs: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("## Errors");
      expect(report).toContain("Agent execution failed");
      expect(report).toContain("Output execution failed");
      expect(report).toContain("Permission/validation issues detected");
      expect(report).toContain("Claude execution returned an error");
      expect(report).toContain("Output validation failed for: create-pr");
    });

    it("should handle cancelled jobs as failures", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "cancelled" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("Agent execution failed (cancelled)");
    });
  });

  describe("GitHub issue creation", () => {
    it("should skip issue creation when create_issues is false", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
      expect(result.outputs["issue-url"]).toBeUndefined();
    });

    it("should skip issue creation when no failures", async () => {
      const { runAudit } = await import("./audit");

      // Use agent with create_issues: true
      await writeFile(agentPath, validAgentMdWithIssues);

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
      expect(result.outputs["issue-url"]).toBeUndefined();
    });

    it("should create issue when failures occur and create_issues is true", async () => {
      const { runAudit } = await import("./audit");

      // Use agent with create_issues: true
      await writeFile(agentPath, validAgentMdWithIssues);

      // Note: This test verifies the flow but doesn't actually create issues
      // In a real GitHub Actions environment, the gh CLI would be available
      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
      // Issue creation would happen here in a real environment with gh CLI
    });

    it("should handle issue creation with custom labels and assignees", async () => {
      const { runAudit } = await import("./audit");

      const agentWithCustomAudit = `---
name: Test Agent Custom
on:
  issues:
    types: [opened]
audit:
  create_issues: true
  labels:
    - bug
    - high-priority
  assignees:
    - user1
    - user2
---

Test agent.
`;

      await writeFile(agentPath, agentWithCustomAudit);

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });

    it("should handle issue creation errors gracefully", async () => {
      const { runAudit } = await import("./audit");

      await writeFile(agentPath, validAgentMdWithIssues);

      // Even if issue creation fails, audit should succeed
      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");
    });
  });

  describe("edge cases", () => {
    it("should return early for rate-limited runs in detectFailures", async () => {
      const { runAudit } = await import("./audit");

      // Create failure conditions that would normally trigger failures
      await mkdir("/tmp/audit-data/metrics", { recursive: true });
      await writeFile(
        "/tmp/audit-data/metrics/metrics.json",
        JSON.stringify({
          is_error: true,
          total_cost_usd: 0.01,
        }),
      );

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {
          agent: "failure" as const,
          rateLimited: true, // This should override all other failures
        },
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false"); // Rate-limited is not a failure
      expect(result.skipReason).toBe("Rate-limited run");
    });

    it("should handle empty job statuses", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: {},
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
    });

    it("should handle undefined job statuses", async () => {
      const { runAudit } = await import("./audit");

      const result = await runAudit({
        ...createContext(),
        jobStatuses: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
    });

    it("should handle empty outputs directory", async () => {
      const { runAudit } = await import("./audit");

      // Create empty outputs directory
      await mkdir("/tmp/audit-data/outputs", { recursive: true });

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("false");
    });

    it("should handle permission issues with different severities", async () => {
      const { runAudit } = await import("./audit");

      await mkdir("/tmp/audit-data/validation", { recursive: true });
      await writeFile(
        "/tmp/audit-data/validation/permission-issues.json",
        JSON.stringify([
          {
            timestamp: new Date().toISOString(),
            issue_type: "warning",
            severity: "warning",
            message: "This is a warning",
          },
          {
            timestamp: new Date().toISOString(),
            issue_type: "error",
            severity: "error",
            message: "This is an error",
          },
        ]),
      );

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs["has-failures"]).toBe("true");

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("[WARNING]");
      expect(report).toContain("[ERROR]");
    });

    it("should use GITHUB_SERVER_URL environment variable", async () => {
      const { runAudit } = await import("./audit");

      const originalServerUrl = process.env.GITHUB_SERVER_URL;
      process.env.GITHUB_SERVER_URL = "https://github.enterprise.com";

      const result = await runAudit(createContext());

      expect(result.success).toBe(true);

      const report = await readFile("/tmp/audit/report.md", "utf-8");
      expect(report).toContain("https://github.enterprise.com/owner/repo/actions/runs/12345");

      // Restore original value
      if (originalServerUrl) {
        process.env.GITHUB_SERVER_URL = originalServerUrl;
      } else {
        delete process.env.GITHUB_SERVER_URL;
      }
    });

    it("should handle agent parsing with validation warnings", async () => {
      const { runAudit } = await import("./audit");

      const agentWithWarnings = `---
name: Test Agent
on:
  issues:
    types: [opened]
unknown_field: this will cause a warning
---

Test agent.
`;

      await writeFile(agentPath, agentWithWarnings);

      const result = await runAudit(createContext());

      // Should still succeed even with warnings
      expect(result.success).toBe(true);
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
