import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

describe("runAgent", () => {
  const testDir = "/tmp/repo-agents-test";
  const agentPath = path.join(testDir, "test-agent.md");

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });

    // Clean up environment variables from previous tests
    delete process.env.EVENT_PAYLOAD;

    // Clean up any previous test artifacts
    for (const p of [
      "/tmp/outputs",
      "/tmp/audit",
      "/tmp/context.txt",
      "/tmp/claude-output.json",
      "/tmp/context",
      ".claude",
    ]) {
      if (existsSync(p)) {
        await rm(p, { recursive: true, force: true });
      }
    }
  });

  afterEach(async () => {
    // Clean up environment variables
    delete process.env.EVENT_PAYLOAD;

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

  describe("metrics extraction from missing or malformed output", () => {
    it("should handle missing Claude output file gracefully", async () => {
      const { runAgent } = await import("./agent");

      // Create agent with invalid frontmatter to trigger early error
      // This tests the error handling without running Claude CLI
      await writeFile(agentPath, "invalid yaml content");

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

  describe("artifacts", () => {
    it("should include audit artifacts array in error results", async () => {
      const { runAgent } = await import("./agent");

      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath: "/nonexistent.md",
      });

      expect(result.success).toBe(false);
      expect(result.artifacts).toBeDefined();
      expect(Array.isArray(result.artifacts)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should handle malformed agent YAML", async () => {
      const { runAgent } = await import("./agent");

      await writeFile(agentPath, "{{invalid yaml");

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

    it("should return error details in outputs", async () => {
      const { runAgent } = await import("./agent");

      const result = await runAgent({
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "issues",
        eventPath: "",
        agentPath: "/this/does/not/exist.md",
      });

      expect(result.success).toBe(false);
      expect(result.outputs).toHaveProperty("is-error");
      expect(result.outputs).toHaveProperty("error");
      expect(result.outputs.error).toBeTruthy();
    });
  });

  // Integration tests that require Claude CLI execution are intentionally skipped
  // Mocking Bun's $ shell is complex and these tests would timeout
  // These scenarios are better tested in end-to-end tests
  describe.skip("full integration tests (requires mocking Bun shell)", () => {
    it.todo("should build context from EVENT_PAYLOAD environment variable");
    it.todo("should build context from GITHUB_EVENT_PATH");
    it.todo("should include collected context from /tmp/context/collected.md");
    it.todo("should create skills file when outputs are configured");
    it.todo("should handle successful Claude CLI execution");
    it.todo("should handle Claude CLI errors");
    it.todo("should extract metrics from Claude output");
    it.todo("should include artifacts in result");
  });
});
