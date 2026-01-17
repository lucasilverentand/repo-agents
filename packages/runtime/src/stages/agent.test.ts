import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// We need to test the internal functions, but they're not exported.
// For now, we'll test the module by reading what it creates.
// In a more complete test suite, we'd refactor to export testable units.

// Create a minimal valid agent definition for testing
// TODO: Use this helper in expanded test coverage
const _createAgentMd = (options: { outputs?: boolean } = {}) => {
  const outputs = options.outputs
    ? `outputs:
  add-comment: true
  add-label: true`
    : "";

  return `---
name: Test Agent
on:
  issues:
    types: [opened]
${outputs}
---

You are a test agent. Please analyze the issue and provide a helpful response.
`;
};

describe("runAgent", () => {
  const testDir = "/tmp/repo-agents-test";
  const agentPath = path.join(testDir, "test-agent.md");

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });

    // Clean up any previous test artifacts
    for (const p of [
      "/tmp/outputs",
      "/tmp/audit",
      "/tmp/context.txt",
      "/tmp/claude-output.json",
      "/tmp/context",
    ]) {
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
  });

  describe("agent file parsing", () => {
    it("should return error when agent file does not exist", async () => {
      const { runAgent } = await import("./agent");

      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath: "/nonexistent/path/agent.md",
      });

      expect(result.success).toBe(false);
      expect(result.outputs["is-error"]).toBe("true");
      expect(result.outputs.error).toContain("Failed to");
    });

    it("should return error when agent YAML is invalid", async () => {
      const { runAgent } = await import("./agent");

      // Write invalid YAML
      await writeFile(agentPath, "invalid: yaml: content: [");

      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath,
      });

      expect(result.success).toBe(false);
      expect(result.outputs["is-error"]).toBe("true");
    });

    it("should return error when agent is missing required fields", async () => {
      const { runAgent } = await import("./agent");

      // Write agent without name
      await writeFile(
        agentPath,
        `---
on:
  issues:
    types: [opened]
---
Instructions here
`,
      );

      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath,
      });

      expect(result.success).toBe(false);
      expect(result.outputs["is-error"]).toBe("true");
    });
  });

  // Note: The following tests would require mocking the Claude CLI execution
  // or extracting the buildContextFile function for unit testing.
  // For now, we test the error paths which don't require Claude execution.

  describe("module integration", () => {
    it("should export runAgent function", async () => {
      const agentModule = await import("./agent");
      expect(typeof agentModule.runAgent).toBe("function");
    });

    it("should conform to Stage type signature", async () => {
      const agentModule = await import("./agent");
      const { runAgent } = agentModule;

      // Verify the function accepts StageContext and returns Promise<StageResult>
      // by checking it handles the error case correctly
      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath: "/nonexistent.md",
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("outputs");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.outputs).toBe("object");
    });
  });
});
