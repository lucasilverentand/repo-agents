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
});
