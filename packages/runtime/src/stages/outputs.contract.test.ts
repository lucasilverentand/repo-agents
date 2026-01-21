import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { StageContext } from "../types";
import { runOutputs } from "./outputs";

/**
 * Contract tests for output file format validation.
 *
 * These tests verify that:
 * 1. We correctly validate output file formats (our contract with Claude)
 * 2. We enforce constraints (max length, required fields, etc.)
 * 3. We provide clear validation error messages
 * 4. Changes to output schemas are caught immediately
 *
 * Note: These tests focus on validation logic and file parsing,
 * not actual GitHub API interactions. They ensure our contract
 * with Claude (output file format) is correct and validated before
 * attempting any GitHub operations.
 *
 * ## Test Coverage Summary
 *
 * ### Output Types Tested
 * - **add-comment**: body field validation, type checking, length constraints
 * - **add-label**: labels array validation, type checking, empty array checks
 * - **remove-label**: labels array validation
 * - **create-issue**: title/body required fields, length constraints
 * - **create-discussion**: title/body/category required fields, length constraints
 * - **create-pr**: branch/title/body required fields, files array validation, branch name format
 * - **update-file**: files array validation, message field, allowed-paths enforcement
 * - **close-issue**: state_reason enum validation
 * - **close-pr**: merge field type validation
 *
 * ### Validation Scenarios
 * - Required field enforcement
 * - Type validation (string vs number, array vs string, etc.)
 * - Length constraints (title max 256, body max 65536)
 * - Format validation (branch names, file paths)
 * - JSON parsing errors
 * - Multiple output files
 * - Max output count enforcement
 * - Path pattern matching (allowed-paths)
 * - Empty output file handling
 *
 * ### What These Tests Protect Against
 * 1. **Breaking changes to output format**: If output schemas change, tests will fail
 * 2. **Validation bypasses**: Ensures all constraints are enforced before GitHub API calls
 * 3. **Inconsistent error messages**: Validates error messages are clear and helpful
 * 4. **Type coercion bugs**: Catches cases where wrong types are accepted
 * 5. **Edge cases**: Empty arrays, missing fields, overly long strings, malformed JSON
 *
 * These tests DO NOT test actual GitHub API interactions. They verify that
 * we catch errors early (at validation) before attempting any API calls,
 * which saves time, reduces rate limiting, and provides better error messages.
 */

const OUTPUTS_DIR = "/tmp/outputs";
const VALIDATION_ERRORS_DIR = "/tmp/validation-errors";
const TEST_AGENT_PATH = ".github/agents/test-agent.md";

describe("Output Format Contract Tests", () => {
  beforeEach(async () => {
    // Clean up directories
    await rm(OUTPUTS_DIR, { recursive: true, force: true });
    await rm(VALIDATION_ERRORS_DIR, { recursive: true, force: true });
    await rm(TEST_AGENT_PATH, { force: true });
    await mkdir(OUTPUTS_DIR, { recursive: true });

    // Create test agent definition
    const agentContent = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
  contents: write
  pull_requests: write
  discussions: write
outputs:
  add-comment: true
  add-label: true
  remove-label: true
  create-issue: true
  create-pr: true
  update-file: true
  close-issue: true
  close-pr: true
  create-discussion: true
allowed-paths:
  - "**/*"
---

Test agent instructions.
`;
    await writeFile(TEST_AGENT_PATH, agentContent, "utf-8");
  });

  /**
   * Helper to create a stage context for testing.
   */
  function createContext(outputType: string): StageContext {
    return {
      agentPath: TEST_AGENT_PATH,
      repository: "owner/repo",
      eventPath: "/tmp/event.json",
      outputType,
    };
  }

  /**
   * Helper to create an event file with issue/PR context.
   */
  async function createEventFile(issueNumber?: number, prNumber?: number) {
    const event: Record<string, unknown> = {};
    if (issueNumber) {
      event.issue = { number: issueNumber };
    }
    if (prNumber) {
      event.pull_request = { number: prNumber };
    }
    await writeFile("/tmp/event.json", JSON.stringify(event), "utf-8");
  }

  describe("add-comment - Output Format Contract", () => {
    test("validates required body field", async () => {
      await createEventFile(123);

      const outputFile = {};
      await writeFile(join(OUTPUTS_DIR, "add-comment.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body is required");
    });

    test("validates body is string type", async () => {
      await createEventFile(123);

      const outputFile = {
        body: 12345, // Wrong type
      };
      await writeFile(join(OUTPUTS_DIR, "add-comment.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body is required and must be a string");
    });

    test("validates body length constraint (max 65536 chars)", async () => {
      await createEventFile(123);

      const longBody = "A".repeat(65537);
      const outputFile = {
        body: longBody,
      };
      await writeFile(join(OUTPUTS_DIR, "add-comment.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body exceeds 65536 characters");
    });

    test("detects missing issue/PR number", async () => {
      // No event file - no issue number

      const outputFile = {
        body: "Test comment",
      };
      await writeFile(join(OUTPUTS_DIR, "add-comment.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      // This will fail at execution, not validation
    });
  });

  describe("add-label - Output Format Contract", () => {
    test("validates required labels array", async () => {
      await createEventFile(123);

      const outputFile = {};
      await writeFile(join(OUTPUTS_DIR, "add-label.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-label");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-label.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("labels must be a non-empty array");
    });

    test("validates labels is array type", async () => {
      await createEventFile(123);

      const outputFile = {
        labels: "bug", // Wrong type - should be array
      };
      await writeFile(join(OUTPUTS_DIR, "add-label.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-label");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-label.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("labels must be a non-empty array");
    });

    test("validates labels array is not empty", async () => {
      await createEventFile(123);

      const outputFile = {
        labels: [], // Empty array
      };
      await writeFile(join(OUTPUTS_DIR, "add-label.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("add-label");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-label.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("labels must be a non-empty array");
    });
  });

  describe("remove-label - Output Format Contract", () => {
    test("validates required labels array", async () => {
      await createEventFile(123);

      const outputFile = {};
      await writeFile(join(OUTPUTS_DIR, "remove-label.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("remove-label");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "remove-label.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("labels must be a non-empty array");
    });
  });

  describe("create-issue - Output Format Contract", () => {
    test("validates required title field", async () => {
      const outputFile = {
        body: "Test body",
        labels: [],
        assignees: [],
      };
      await writeFile(join(OUTPUTS_DIR, "create-issue.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-issue");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-issue.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("title is required");
    });

    test("validates required body field", async () => {
      const outputFile = {
        title: "Test Issue",
        labels: [],
        assignees: [],
      };
      await writeFile(join(OUTPUTS_DIR, "create-issue.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-issue");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-issue.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body is required");
    });

    test("validates title length constraint (max 256 chars)", async () => {
      const longTitle = "A".repeat(257);
      const outputFile = {
        title: longTitle,
        body: "Test body",
        labels: [],
        assignees: [],
      };
      await writeFile(join(OUTPUTS_DIR, "create-issue.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-issue");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-issue.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("title exceeds 256 characters");
    });
  });

  describe("create-discussion - Output Format Contract", () => {
    test("validates required title field", async () => {
      const outputFile = {
        body: "Discussion body",
        category: "General",
      };
      await writeFile(
        join(OUTPUTS_DIR, "create-discussion.json"),
        JSON.stringify(outputFile),
        "utf-8",
      );

      const ctx = createContext("create-discussion");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-discussion.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("title is required");
    });

    test("validates required body field", async () => {
      const outputFile = {
        title: "Discussion Title",
        category: "General",
      };
      await writeFile(
        join(OUTPUTS_DIR, "create-discussion.json"),
        JSON.stringify(outputFile),
        "utf-8",
      );

      const ctx = createContext("create-discussion");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-discussion.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body is required");
    });

    test("validates required category field", async () => {
      const outputFile = {
        title: "Discussion Title",
        body: "Discussion body",
      };
      await writeFile(
        join(OUTPUTS_DIR, "create-discussion.json"),
        JSON.stringify(outputFile),
        "utf-8",
      );

      const ctx = createContext("create-discussion");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-discussion.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("category is required");
    });

    test("validates title length constraint (max 256 chars)", async () => {
      const longTitle = "A".repeat(257);
      const outputFile = {
        title: longTitle,
        body: "Discussion body",
        category: "General",
      };
      await writeFile(
        join(OUTPUTS_DIR, "create-discussion.json"),
        JSON.stringify(outputFile),
        "utf-8",
      );

      const ctx = createContext("create-discussion");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-discussion.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("title exceeds 256 characters");
    });
  });

  describe("create-pr - Output Format Contract", () => {
    test("validates required branch field", async () => {
      const outputFile = {
        title: "Test PR",
        body: "PR body",
        files: [{ path: "test.txt", content: "content" }],
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("branch is required");
    });

    test("validates branch name format", async () => {
      const outputFile = {
        branch: "invalid branch!", // Contains invalid characters
        title: "Test PR",
        body: "PR body",
        files: [{ path: "test.txt", content: "content" }],
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("branch name contains invalid characters");
    });

    test("validates required title field", async () => {
      const outputFile = {
        branch: "feature/test",
        body: "PR body",
        files: [{ path: "test.txt", content: "content" }],
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("title is required");
    });

    test("validates required body field", async () => {
      const outputFile = {
        branch: "feature/test",
        title: "Test PR",
        files: [{ path: "test.txt", content: "content" }],
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("body is required");
    });

    test("validates files array is not empty", async () => {
      const outputFile = {
        branch: "feature/test",
        title: "Test PR",
        body: "PR body",
        files: [],
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("files must be a non-empty array");
    });

    test("validates each file has path field", async () => {
      const outputFile = {
        branch: "feature/test",
        title: "Test PR",
        body: "PR body",
        files: [{ content: "content" }], // Missing path
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("each file must have a 'path' string");
    });

    test("validates each file has content field", async () => {
      const outputFile = {
        branch: "feature/test",
        title: "Test PR",
        body: "PR body",
        files: [{ path: "test.txt" }], // Missing content
      };
      await writeFile(join(OUTPUTS_DIR, "create-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("create-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "create-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("each file must have a 'content' string");
    });
  });

  describe("update-file - Output Format Contract", () => {
    test("validates files array is not empty", async () => {
      const outputFile = {
        files: [],
        message: "Update files",
      };
      await writeFile(join(OUTPUTS_DIR, "update-file.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("update-file");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "update-file.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("files must be a non-empty array");
    });

    test("validates required message field", async () => {
      const outputFile = {
        files: [{ path: "test.txt", content: "content" }],
      };
      await writeFile(join(OUTPUTS_DIR, "update-file.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("update-file");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(Number(result.outputs?.errors || 0)).toBeGreaterThan(0);

      const errorFile = join(VALIDATION_ERRORS_DIR, "update-file.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("message is required");
    });

    test("validates file path against allowed_paths", async () => {
      // Create agent with restricted allowed-paths
      const restrictedAgentContent = `---
name: Restricted Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
allowed-paths:
  - "docs/**"
  - "README.md"
---

Restricted agent.
`;
      await writeFile(TEST_AGENT_PATH, restrictedAgentContent, "utf-8");

      const outputFile = {
        files: [{ path: "forbidden/file.txt", content: "content" }],
        message: "Try to update forbidden file",
      };
      await writeFile(join(OUTPUTS_DIR, "update-file.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("update-file");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "update-file.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("forbidden/file.txt");
      expect(errorText).toContain("does not match allowed patterns");
    });

    test("allows file path matching allowed_paths pattern", async () => {
      // Create agent with restricted allowed-paths
      const restrictedAgentContent = `---
name: Restricted Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
allowed-paths:
  - "docs/**"
  - "README.md"
---

Restricted agent.
`;
      await writeFile(TEST_AGENT_PATH, restrictedAgentContent, "utf-8");

      const outputFile = {
        files: [{ path: "docs/guide.md", content: "content" }],
        message: "Update docs",
      };
      await writeFile(join(OUTPUTS_DIR, "update-file.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("update-file");
      const result = await runOutputs(ctx);

      // May fail at execution, but should pass validation
      if (!result.success) {
        const errorFile = join(VALIDATION_ERRORS_DIR, "update-file.txt");
        if (existsSync(errorFile)) {
          const errorText = await readFile(errorFile, "utf-8");
          // Should not be validation errors about allowed paths
          expect(errorText).not.toContain("does not match allowed patterns");
        }
      }
    });
  });

  describe("close-issue - Output Format Contract", () => {
    test("validates state_reason enum values", async () => {
      await createEventFile(123);

      const outputFile = {
        state_reason: "invalid_reason",
      };
      await writeFile(join(OUTPUTS_DIR, "close-issue.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("close-issue");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "close-issue.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("state_reason must be 'completed' or 'not_planned'");
    });

    test("accepts valid state_reason values", async () => {
      await createEventFile(123);

      for (const reason of ["completed", "not_planned"]) {
        const outputFile = {
          state_reason: reason,
        };
        await writeFile(join(OUTPUTS_DIR, "close-issue.json"), JSON.stringify(outputFile), "utf-8");

        const ctx = createContext("close-issue");
        const result = await runOutputs(ctx);

        // May fail at execution, but should pass validation
        if (!result.success) {
          const errorFile = join(VALIDATION_ERRORS_DIR, "close-issue.txt");
          if (existsSync(errorFile)) {
            const errorText = await readFile(errorFile, "utf-8");
            expect(errorText).not.toContain("state_reason must be");
          }
        }
      }
    });
  });

  describe("close-pr - Output Format Contract", () => {
    test("validates merge field is boolean", async () => {
      await createEventFile(undefined, 456);

      const outputFile = {
        merge: "true", // Wrong type - should be boolean
      };
      await writeFile(join(OUTPUTS_DIR, "close-pr.json"), JSON.stringify(outputFile), "utf-8");

      const ctx = createContext("close-pr");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "close-pr.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("merge must be a boolean");
    });
  });

  describe("JSON parsing - Contract Tests", () => {
    test("detects invalid JSON format", async () => {
      // Write invalid JSON
      await writeFile(join(OUTPUTS_DIR, "add-comment.json"), "not valid json{", "utf-8");

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("Invalid JSON format");
    });
  });

  describe("Multiple output files - Contract Tests", () => {
    test("enforces max constraint on output files", async () => {
      await createEventFile(123);

      // Create agent with max constraint
      const constrainedAgentContent = `---
name: Constrained Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment:
    max: 2
---

Constrained agent.
`;
      await writeFile(TEST_AGENT_PATH, constrainedAgentContent, "utf-8");

      // Create 3 files (exceeds max)
      await writeFile(
        join(OUTPUTS_DIR, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 1" }),
        "utf-8",
      );
      await writeFile(
        join(OUTPUTS_DIR, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 2" }),
        "utf-8",
      );
      await writeFile(
        join(OUTPUTS_DIR, "add-comment-3.json"),
        JSON.stringify({ body: "Comment 3" }),
        "utf-8",
      );

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs?.errors).toBe("1");

      const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
      expect(existsSync(errorFile)).toBe(true);
      const errorText = await readFile(errorFile, "utf-8");
      expect(errorText).toContain("Too many output files");
      expect(errorText).toContain("Maximum allowed: 2");
    });

    test("processes multiple valid output files", async () => {
      await createEventFile(123);

      // Create multiple valid comment files
      await writeFile(
        join(OUTPUTS_DIR, "add-comment-1.json"),
        JSON.stringify({ body: "Comment 1" }),
        "utf-8",
      );
      await writeFile(
        join(OUTPUTS_DIR, "add-comment-2.json"),
        JSON.stringify({ body: "Comment 2" }),
        "utf-8",
      );

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      // Will fail at execution, but should detect multiple files
      if (!result.success) {
        const errorFile = join(VALIDATION_ERRORS_DIR, "add-comment.txt");
        if (existsSync(errorFile)) {
          const errorText = await readFile(errorFile, "utf-8");
          // Should not be validation errors about format
          expect(errorText).not.toContain("body is required");
        }
      }
    });
  });

  describe("No output files - Contract Tests", () => {
    test("skips when no output files found", async () => {
      // Don't create any output files

      const ctx = createContext("add-comment");
      const result = await runOutputs(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs?.skipped).toBe("true");
      expect(result.skipReason).toContain("No add-comment output files found");
    });
  });
});
