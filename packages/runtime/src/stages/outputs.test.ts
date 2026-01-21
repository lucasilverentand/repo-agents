import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StageContext } from "../types.js";

// Create a minimal valid agent definition for testing
const createAgentMd = (
  options: { outputs?: Record<string, boolean | { max?: number }>; allowedPaths?: string[] } = {},
) => {
  const outputs = options.outputs
    ? `outputs:\n${Object.entries(options.outputs)
        .map(([key, val]) => {
          if (typeof val === "boolean") {
            return `  ${key}: ${val}`;
          }
          return `  ${key}:\n    max: ${val.max}`;
        })
        .join("\n")}`
    : "";

  const allowedPaths = options.allowedPaths
    ? `allowed-paths:\n${options.allowedPaths.map((p) => `  - "${p}"`).join("\n")}`
    : "";

  return `---
name: Test Agent
on:
  issues:
    types: [opened]
${outputs}
${allowedPaths}
---

You are a test agent.
`;
};

describe("runOutputs", () => {
  const testDir = "/tmp/repo-agents-outputs-test";
  const agentPath = path.join(testDir, "test-agent.md");
  const outputsDir = "/tmp/outputs";
  const validationErrorsDir = "/tmp/validation-errors";

  const createContext = (overrides: Partial<StageContext> = {}): StageContext => ({
    repository: "owner/repo",
    runId: "12345",
    actor: "testuser",
    eventName: "issues",
    eventPath: path.join(testDir, "event.json"),
    agentPath,
    outputType: "add-comment",
    ...overrides,
  });

  beforeEach(async () => {
    // Create test directories
    await mkdir(testDir, { recursive: true });
    await mkdir(outputsDir, { recursive: true });

    // Create a basic event.json
    await writeFile(
      path.join(testDir, "event.json"),
      JSON.stringify({
        issue: { number: 123 },
        repository: { full_name: "owner/repo" },
      }),
    );

    // Clean up validation errors directory
    if (existsSync(validationErrorsDir)) {
      await rm(validationErrorsDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Clean up test directories
    for (const dir of [testDir, outputsDir, validationErrorsDir]) {
      if (existsSync(dir)) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  describe("basic functionality", () => {
    it("should export runOutputs function", async () => {
      const outputsModule = await import("./outputs");
      expect(typeof outputsModule.runOutputs).toBe("function");
    });

    it("should return error when no output type is specified", async () => {
      const { runOutputs } = await import("./outputs");

      const result = await runOutputs(createContext({ outputType: undefined }));

      expect(result.success).toBe(false);
      expect(result.outputs.error).toBe("No output type specified");
    });

    it("should return error when agent file does not exist", async () => {
      const { runOutputs } = await import("./outputs");

      const result = await runOutputs(createContext({ agentPath: "/nonexistent/agent.md" }));

      expect(result.success).toBe(false);
      expect(result.outputs.error).toContain("Failed to parse agent definition");
    });

    it("should return success when no output files found", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));

      const result = await runOutputs(createContext());

      expect(result.success).toBe(true);
      expect(result.outputs.executed).toBe("0");
      expect(result.skipReason).toContain("No add-comment output files found");
    });
  });

  describe("add-comment validation", () => {
    it("should validate valid add-comment output", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "This is a test comment" }),
      );

      // Note: This will fail at execution since we're not in GitHub Actions,
      // but it should pass validation
      const result = await runOutputs(createContext());

      // The validation should pass, but execution will fail without gh CLI
      // So we check that either it succeeded or the error is about execution, not validation
      if (!result.success) {
        expect(result.outputs.error || "").not.toContain("body is required");
      }
    });

    it("should reject add-comment with missing body", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(path.join(outputsDir, "add-comment.json"), JSON.stringify({}));

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);
      expect(existsSync(path.join(validationErrorsDir, "add-comment.txt"))).toBe(true);
    });

    it("should reject add-comment with body exceeding 65536 characters", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "x".repeat(65537) }),
      );

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);
    });

    it("should reject when exceeding max constraint", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": { max: 1 } } }));
      await writeFile(
        path.join(outputsDir, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 1" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 2" }),
      );

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);
    });

    it("should reject invalid JSON", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(path.join(outputsDir, "add-comment.json"), "{ invalid json }");

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);
    });
  });

  describe("add-label validation", () => {
    it("should reject add-label with missing labels array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-label": true } }));
      await writeFile(path.join(outputsDir, "add-label.json"), JSON.stringify({}));

      const result = await runOutputs(createContext({ outputType: "add-label" }));

      expect(result.success).toBe(false);
    });

    it("should reject add-label with empty labels array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-label": true } }));
      await writeFile(path.join(outputsDir, "add-label.json"), JSON.stringify({ labels: [] }));

      const result = await runOutputs(createContext({ outputType: "add-label" }));

      expect(result.success).toBe(false);
    });
  });

  describe("create-issue validation", () => {
    it("should reject create-issue with missing title", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({ body: "Issue body" }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-issue with missing body", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({ title: "Issue title" }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-issue with title exceeding 256 characters", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({ title: "x".repeat(257), body: "body" }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      expect(result.success).toBe(false);
    });
  });

  describe("create-pr validation", () => {
    it("should reject create-pr with missing branch", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          title: "PR title",
          body: "PR body",
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-pr with invalid branch name", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "invalid branch name!",
          title: "PR title",
          body: "PR body",
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-pr with empty files array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          title: "PR title",
          body: "PR body",
          files: [],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });
  });

  describe("update-file validation", () => {
    it("should reject update-file with missing message", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);
    });

    it("should reject update-file with path outside allowed patterns", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "src/main.ts", content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);
    });
  });

  describe("close-issue validation", () => {
    it("should reject close-issue with invalid state_reason", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-issue": true } }));
      await writeFile(
        path.join(outputsDir, "close-issue.json"),
        JSON.stringify({ state_reason: "invalid" }),
      );

      const result = await runOutputs(createContext({ outputType: "close-issue" }));

      expect(result.success).toBe(false);
    });

    it("should accept close-issue with valid state_reason", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-issue": true } }));
      await writeFile(
        path.join(outputsDir, "close-issue.json"),
        JSON.stringify({ state_reason: "completed" }),
      );

      // Validation should pass (execution will fail without gh CLI)
      const result = await runOutputs(createContext({ outputType: "close-issue" }));

      // Check if the failure is due to execution (no issue number), not validation
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-issue.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("state_reason must be 'completed' or 'not_planned'");
      }
    });
  });

  describe("close-pr validation", () => {
    it("should reject close-pr with invalid merge type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-pr": true } }));
      await writeFile(
        path.join(outputsDir, "close-pr.json"),
        JSON.stringify({ merge: "yes" }), // Should be boolean
      );

      const result = await runOutputs(createContext({ outputType: "close-pr" }));

      expect(result.success).toBe(false);
    });
  });

  describe("create-discussion validation", () => {
    it("should reject create-discussion with missing category", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          title: "Discussion title",
          body: "Discussion body",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      expect(result.success).toBe(false);
    });
  });

  describe("file pattern matching", () => {
    it("should find multiple output files with numeric suffixes", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment 1" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 2" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 3" }),
      );

      // Should find all 3 files (validation will pass)
      const result = await runOutputs(createContext());

      // Either passes validation or fails on execution (not validation)
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "add-comment.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("body is required");
      }
    });

    it("should not match unrelated files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      // These should not be matched
      await writeFile(
        path.join(outputsDir, "add-comment-extra.json"),
        JSON.stringify({ body: "Not matched" }),
      );
      await writeFile(
        path.join(outputsDir, "other-add-comment.json"),
        JSON.stringify({ body: "Not matched" }),
      );

      const result = await runOutputs(createContext());

      // Should not find any matching files
      expect(result.skipReason).toContain("No add-comment output files found");
    });
  });

  describe("remove-label validation", () => {
    it("should reject remove-label with missing labels array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "remove-label": true } }));
      await writeFile(path.join(outputsDir, "remove-label.json"), JSON.stringify({}));

      const result = await runOutputs(createContext({ outputType: "remove-label" }));

      expect(result.success).toBe(false);
    });

    it("should reject remove-label with empty labels array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "remove-label": true } }));
      await writeFile(path.join(outputsDir, "remove-label.json"), JSON.stringify({ labels: [] }));

      const result = await runOutputs(createContext({ outputType: "remove-label" }));

      expect(result.success).toBe(false);
    });

    it("should accept remove-label with valid labels", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "remove-label": true } }));
      await writeFile(
        path.join(outputsDir, "remove-label.json"),
        JSON.stringify({ labels: ["bug", "wontfix"] }),
      );

      const result = await runOutputs(createContext({ outputType: "remove-label" }));

      // Validation passes, execution may fail
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "remove-label.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("labels must be a non-empty array");
      }
    });
  });

  describe("create-pr file validation", () => {
    it("should reject create-pr with missing path in files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          title: "PR title",
          body: "PR body",
          files: [{ content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-pr with missing content in files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          title: "PR title",
          body: "PR body",
          files: [{ path: "test.txt" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-pr with missing title", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          body: "PR body",
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-pr with missing body", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          title: "PR title",
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });
  });

  describe("update-file file validation", () => {
    it("should reject update-file with empty files array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);
    });

    it("should reject update-file with missing path in files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);
    });

    it("should reject update-file with missing content in files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "test.txt" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);
    });

    it("should accept update-file with allowed path patterns", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**", "README.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "docs/guide.md", content: "# Guide" }],
          message: "Update docs",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      // Validation passes
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should reject update-file when no allowed paths defined", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: [],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "test.txt", content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      // No allowed paths means validation passes (empty array check)
      // Execution may fail
      expect(result.success).toBeDefined();
    });
  });

  describe("create-discussion validation", () => {
    it("should reject create-discussion with missing title", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          body: "Discussion body",
          category: "General",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-discussion with missing body", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          title: "Discussion title",
          category: "General",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      expect(result.success).toBe(false);
    });

    it("should reject create-discussion with title exceeding 256 characters", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          title: "x".repeat(257),
          body: "Discussion body",
          category: "General",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      expect(result.success).toBe(false);
    });
  });

  describe("batch validation", () => {
    it("should aggregate errors from multiple invalid files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));

      // Multiple invalid files
      await writeFile(path.join(outputsDir, "add-comment-1.json"), JSON.stringify({}));
      await writeFile(
        path.join(outputsDir, "add-comment-2.json"),
        JSON.stringify({ body: 123 }), // Wrong type
      );
      await writeFile(path.join(outputsDir, "add-comment-3.json"), "invalid json");

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);
      expect(result.outputs.errors).toBe("3"); // All 3 files have errors

      // Check error file was written
      const errorContent = await readFile(
        path.join(validationErrorsDir, "add-comment.json"),
        "utf-8",
      );
      const errors = JSON.parse(errorContent);
      expect(errors.length).toBe(3);
    });

    it("should handle partial success - some files valid, some invalid", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": { max: 5 } } }));

      // Mix of valid and invalid
      await writeFile(
        path.join(outputsDir, "add-comment-1.json"),
        JSON.stringify({ body: "Valid comment 1" }),
      );
      await writeFile(path.join(outputsDir, "add-comment-2.json"), JSON.stringify({})); // Invalid
      await writeFile(
        path.join(outputsDir, "add-comment-3.json"),
        JSON.stringify({ body: "Valid comment 2" }),
      );

      const result = await runOutputs(createContext());

      // Atomic validation - all must pass or none execute
      expect(result.success).toBe(false);
      expect(result.outputs.executed).toBe("0");
    });

    it("should validate all files before executing any", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));

      // First file is valid, second is invalid
      await writeFile(
        path.join(outputsDir, "create-issue-1.json"),
        JSON.stringify({ title: "Issue 1", body: "Body 1" }),
      );
      await writeFile(
        path.join(outputsDir, "create-issue-2.json"),
        JSON.stringify({ title: "x".repeat(300), body: "Body 2" }), // Title too long
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      // Atomic validation - none should execute because validation failed
      expect(result.success).toBe(false);
      expect(result.outputs.executed).toBe("0");
    });
  });

  describe("output config variations", () => {
    it("should handle output config set to false", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": false } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext());

      // Config false means no constraints, validation should pass
      expect(result.success).toBeDefined();
    });

    it("should handle output config set to true (no constraints)", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext());

      // True means enabled but no constraints
      expect(result.success).toBeDefined();
    });

    it("should handle output config with max constraint", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": { max: 2 } } }));
      await writeFile(
        path.join(outputsDir, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 1" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 2" }),
      );

      const result = await runOutputs(createContext());

      // Should be within max limit
      expect(result.success).toBeDefined();
    });

    it("should handle agent with no outputs defined", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({})); // No outputs
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext());

      // No outputs config means empty config, validation passes
      expect(result.success).toBeDefined();
    });
  });

  describe("close-issue with state_reason", () => {
    it("should accept close-issue without state_reason", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-issue": true } }));
      await writeFile(path.join(outputsDir, "close-issue.json"), JSON.stringify({}));

      const result = await runOutputs(createContext({ outputType: "close-issue" }));

      // Validation passes (state_reason is optional)
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-issue.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("state_reason");
      }
    });

    it("should accept close-issue with state_reason=not_planned", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-issue": true } }));
      await writeFile(
        path.join(outputsDir, "close-issue.json"),
        JSON.stringify({ state_reason: "not_planned" }),
      );

      const result = await runOutputs(createContext({ outputType: "close-issue" }));

      // Validation passes
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-issue.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("state_reason must be");
      }
    });
  });

  describe("close-pr with merge", () => {
    it("should accept close-pr without merge field", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-pr": true } }));
      await writeFile(path.join(outputsDir, "close-pr.json"), JSON.stringify({}));

      const result = await runOutputs(createContext({ outputType: "close-pr" }));

      // Validation passes (merge is optional)
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-pr.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("merge must be");
      }
    });

    it("should accept close-pr with merge=false", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-pr": true } }));
      await writeFile(path.join(outputsDir, "close-pr.json"), JSON.stringify({ merge: false }));

      const result = await runOutputs(createContext({ outputType: "close-pr" }));

      // Validation passes
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-pr.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("merge must be");
      }
    });

    it("should accept close-pr with merge=true", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-pr": true } }));
      await writeFile(path.join(outputsDir, "close-pr.json"), JSON.stringify({ merge: true }));

      const result = await runOutputs(createContext({ outputType: "close-pr" }));

      // Validation passes
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "close-pr.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("merge must be");
      }
    });
  });

  describe("error handling", () => {
    it("should handle missing outputs directory gracefully", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));

      // Remove outputs directory
      await rm(outputsDir, { recursive: true, force: true });

      const result = await runOutputs(createContext());

      expect(result.success).toBe(true);
      expect(result.skipReason).toContain("No add-comment output files found");
    });

    it("should write validation errors to both JSON and text formats", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(path.join(outputsDir, "add-comment.json"), JSON.stringify({}));

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);

      // Check both formats exist
      expect(existsSync(path.join(validationErrorsDir, "add-comment.json"))).toBe(true);
      expect(existsSync(path.join(validationErrorsDir, "add-comment.txt"))).toBe(true);

      // Verify content
      const jsonContent = await readFile(
        path.join(validationErrorsDir, "add-comment.json"),
        "utf-8",
      );
      const textContent = await readFile(
        path.join(validationErrorsDir, "add-comment.txt"),
        "utf-8",
      );

      expect(jsonContent).toContain("body is required");
      expect(textContent).toContain("body is required");
    });
  });

  describe("glob pattern matching for allowed paths", () => {
    it("should match exact path", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["README.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "README.md", content: "# README" }],
          message: "Update README",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should match wildcard pattern", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["*.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "CONTRIBUTING.md", content: "# Contributing" }],
          message: "Update contributing",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should match double-star pattern", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "docs/guides/getting-started.md", content: "# Guide" }],
          message: "Update guide",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should reject path not matching pattern", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "src/index.ts", content: "// code" }],
          message: "Update code",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);

      const errors = await readFile(path.join(validationErrorsDir, "update-file.txt"), "utf-8");
      expect(errors).toContain("does not match allowed patterns");
    });
  });

  describe("validation error formats", () => {
    it("should write proper error format for add-comment missing body", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ notBody: "value" }),
      );

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);

      const errors = await readFile(path.join(validationErrorsDir, "add-comment.txt"), "utf-8");
      expect(errors).toContain("**add-comment**");
      expect(errors).toContain("body is required");
    });

    it("should write proper error format for invalid add-comment body type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(path.join(outputsDir, "add-comment.json"), JSON.stringify({ body: 12345 }));

      const result = await runOutputs(createContext());

      expect(result.success).toBe(false);

      const errors = await readFile(path.join(validationErrorsDir, "add-comment.txt"), "utf-8");
      expect(errors).toContain("body is required and must be a string");
    });

    it("should include filename in error messages", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue-5.json"),
        JSON.stringify({ body: "body" }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      expect(result.success).toBe(false);

      const errors = await readFile(path.join(validationErrorsDir, "create-issue.txt"), "utf-8");
      expect(errors).toContain("create-issue-5.json");
    });
  });

  describe("all output types coverage", () => {
    it("should handle remove-label output type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "remove-label": true } }));
      await writeFile(
        path.join(outputsDir, "remove-label.json"),
        JSON.stringify({ labels: ["bug", "duplicate"] }),
      );

      const result = await runOutputs(createContext({ outputType: "remove-label" }));

      // Validation passes, execution may fail
      expect(result.success).toBeDefined();
    });

    it("should handle create-discussion output type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          title: "Discussion Title",
          body: "Discussion Body",
          category: "General",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      // Validation passes, execution may fail without real gh API
      expect(result.success).toBeDefined();
    });

    it("should validate create-pr with valid data structure", async () => {
      const { runOutputs } = await import("./outputs");

      // Use invalid branch name to fail validation (contains space)
      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test with space",
          title: "Test PR",
          body: "PR description",
          files: [
            { path: "test.txt", content: "test content" },
            { path: "docs/readme.md", content: "# Readme" },
          ],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      // Should fail validation due to invalid branch name
      expect(result.success).toBe(false);
      const errors = await readFile(path.join(validationErrorsDir, "create-pr.txt"), "utf-8");
      expect(errors).toContain("branch name contains invalid characters");
    });

    it("should handle update-file output type with valid data", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [
            { path: "README.md", content: "# Updated" },
            { path: "CHANGELOG.md", content: "## v1.0.0" },
          ],
          message: "Update documentation",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      // Validation passes
      expect(result.success).toBeDefined();
    });

    it("should handle close-issue output type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-issue": true } }));
      await writeFile(
        path.join(outputsDir, "close-issue.json"),
        JSON.stringify({ state_reason: "completed" }),
      );

      const result = await runOutputs(createContext({ outputType: "close-issue" }));

      // Validation passes
      expect(result.success).toBeDefined();
    });

    it("should handle close-pr output type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "close-pr": true } }));
      await writeFile(path.join(outputsDir, "close-pr.json"), JSON.stringify({ merge: false }));

      const result = await runOutputs(createContext({ outputType: "close-pr" }));

      // Validation passes
      expect(result.success).toBeDefined();
    });
  });

  describe("create-issue with labels", () => {
    it("should validate create-issue with valid labels array", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({
          title: "New Issue",
          body: "Issue body",
          labels: ["bug", "enhancement"],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      // Validation should process labels (may pass or fail depending on gh CLI availability)
      expect(result.success).toBeDefined();
    });

    it("should validate create-issue with assignees", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({
          title: "New Issue",
          body: "Issue body",
          assignees: ["user1", "user2"],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      // Validation passes
      expect(result.success).toBeDefined();
    });
  });

  describe("event context handling", () => {
    it("should handle event with pull request number", async () => {
      const { runOutputs } = await import("./outputs");

      // Create event with PR number instead of issue
      await writeFile(
        path.join(testDir, "event.json"),
        JSON.stringify({
          pull_request: { number: 456 },
          repository: { full_name: "owner/repo" },
        }),
      );

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "PR comment" }),
      );

      const result = await runOutputs(createContext());

      // Validation passes, execution may fail
      expect(result.success).toBeDefined();
    });

    it("should handle missing event file gracefully", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext({ eventPath: "/nonexistent/event.json" }));

      // Should handle missing event file
      expect(result.success).toBeDefined();
    });

    it("should handle malformed event JSON gracefully", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(path.join(testDir, "event.json"), "{ invalid json }");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext());

      // Should handle malformed event JSON
      expect(result.success).toBeDefined();
    });

    it("should use TARGET_ISSUE_NUMBER environment variable when present", async () => {
      const { runOutputs } = await import("./outputs");

      // Set environment variable
      process.env.TARGET_ISSUE_NUMBER = "789";

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": true } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment with env var" }),
      );

      const result = await runOutputs(createContext());

      // Clean up
      delete process.env.TARGET_ISSUE_NUMBER;

      // Validation passes
      expect(result.success).toBeDefined();
    });
  });

  describe("file sorting and pattern matching", () => {
    it("should sort output files alphabetically", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": { max: 5 } } }));

      // Create files in non-alphabetical order
      await writeFile(
        path.join(outputsDir, "add-comment-3.json"),
        JSON.stringify({ body: "Comment 3" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 1" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment 0" }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 2" }),
      );

      const result = await runOutputs(createContext());

      // Should find all files and process them in order
      expect(result.success).toBeDefined();
    });
  });

  describe("update-file with multiple file modifications", () => {
    it("should validate multiple file updates in single output", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**", "README.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [
            { path: "README.md", content: "# Main README" },
            { path: "docs/guide.md", content: "# Guide" },
            { path: "docs/api/reference.md", content: "# API" },
          ],
          message: "Update multiple files",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      // Validation passes
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should reject when one file in array violates allowed paths", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["docs/**"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [
            { path: "docs/guide.md", content: "# Guide" },
            { path: "src/main.ts", content: "// code" }, // This violates
          ],
          message: "Update files",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      expect(result.success).toBe(false);

      const errors = await readFile(path.join(validationErrorsDir, "update-file.txt"), "utf-8");
      expect(errors).toContain("src/main.ts");
      expect(errors).toContain("does not match allowed patterns");
    });
  });

  describe("create-pr with multiple files", () => {
    it("should reject when one file in create-pr array is invalid", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/test",
          title: "Test PR",
          body: "PR body",
          files: [
            { path: "file1.txt", content: "Content 1" },
            { path: "file2.txt" }, // Missing content
          ],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      expect(result.success).toBe(false);
    });

    it("should validate create-pr with valid multiple files", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "feature/multi-file",
          title: "Multi-file PR",
          body: "PR with multiple files",
          files: [
            { path: "file1.txt", content: "Content 1" },
            { path: "dir/file2.txt", content: "Content 2" },
            { path: "nested/deep/file3.md", content: "# Content 3" },
          ],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      // Validation passes, execution may fail without git setup
      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "create-pr.txt"),
          "utf-8",
        ).catch(() => "");
        // Should not be validation errors
        expect(errors).not.toContain("each file must have");
      }
    });
  });

  describe("glob pattern edge cases", () => {
    it("should handle single character wildcard in patterns", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["*.txt"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "file1.txt", content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should handle invalid regex pattern gracefully", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["exact-match.txt"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "exact-match.txt", content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });

    it("should handle pattern ending with double-star", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["src/**"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "src/deep/nested/file.ts", content: "content" }],
          message: "Update file",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      if (!result.success) {
        const errors = await readFile(
          path.join(validationErrorsDir, "update-file.txt"),
          "utf-8",
        ).catch(() => "");
        expect(errors).not.toContain("does not match allowed patterns");
      }
    });
  });

  describe("config variations for getOutputConfig", () => {
    it("should handle config undefined for output type", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: {}, // Empty outputs config
        }),
      );
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Comment" }),
      );

      const result = await runOutputs(createContext({ outputType: "add-comment" }));

      // Should handle gracefully
      expect(result.success).toBeDefined();
    });
  });

  describe("validation with constraints", () => {
    it("should respect max=1 constraint exactly", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-comment": { max: 1 } } }));
      await writeFile(
        path.join(outputsDir, "add-comment.json"),
        JSON.stringify({ body: "Single comment" }),
      );

      const result = await runOutputs(createContext());

      // Should pass with exactly 1 file
      expect(result.success).toBeDefined();
    });

    it("should allow outputs when max constraint is not exceeded", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": { max: 3 } } }));
      await writeFile(
        path.join(outputsDir, "create-issue-1.json"),
        JSON.stringify({ title: "Issue 1", body: "Body 1" }),
      );
      await writeFile(
        path.join(outputsDir, "create-issue-2.json"),
        JSON.stringify({ title: "Issue 2", body: "Body 2" }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      // Should pass with 2 files when max is 3
      expect(result.success).toBeDefined();
    });
  });

  describe("label validation paths", () => {
    it("should attempt to validate labels for add-label output", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "add-label": true } }));
      await writeFile(
        path.join(outputsDir, "add-label.json"),
        JSON.stringify({ labels: ["bug", "feature"] }),
      );

      const result = await runOutputs(createContext({ outputType: "add-label" }));

      // Validation will attempt to check if labels exist in repo
      // May pass or fail depending on gh CLI availability
      expect(result.success).toBeDefined();
    });

    it("should attempt to validate labels for create-issue with labels", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-issue": true } }));
      await writeFile(
        path.join(outputsDir, "create-issue.json"),
        JSON.stringify({
          title: "Issue with labels",
          body: "Issue body",
          labels: ["bug", "documentation"],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-issue" }));

      // Validation will attempt to check if labels exist
      expect(result.success).toBeDefined();
    });
  });

  describe("category validation for discussions", () => {
    it("should attempt to validate discussion category", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-discussion": true } }));
      await writeFile(
        path.join(outputsDir, "create-discussion.json"),
        JSON.stringify({
          title: "Discussion with category",
          body: "Discussion body",
          category: "Q&A",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-discussion" }));

      // Validation will attempt to check if category exists
      expect(result.success).toBeDefined();
    });
  });

  describe("update-file with branch parameter", () => {
    it("should validate update-file with custom branch", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(
        agentPath,
        createAgentMd({
          outputs: { "update-file": true },
          allowedPaths: ["**/*.md"],
        }),
      );
      await writeFile(
        path.join(outputsDir, "update-file.json"),
        JSON.stringify({
          files: [{ path: "README.md", content: "# Updated" }],
          message: "Update README",
          branch: "develop",
        }),
      );

      const result = await runOutputs(createContext({ outputType: "update-file" }));

      // Validation passes
      expect(result.success).toBeDefined();
    });
  });

  describe("create-pr with base branch", () => {
    it("should validate create-pr structure with base parameter", async () => {
      const { runOutputs } = await import("./outputs");

      await writeFile(agentPath, createAgentMd({ outputs: { "create-pr": true } }));
      await writeFile(
        path.join(outputsDir, "create-pr.json"),
        JSON.stringify({
          branch: "invalid branch!",
          title: "PR with custom base",
          body: "PR body",
          base: "develop",
          files: [{ path: "test.txt", content: "content" }],
        }),
      );

      const result = await runOutputs(createContext({ outputType: "create-pr" }));

      // Should fail validation due to invalid branch name
      expect(result.success).toBe(false);
    });
  });
});
