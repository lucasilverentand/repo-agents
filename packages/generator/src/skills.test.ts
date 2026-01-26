import { describe, expect, test } from "bun:test";
import type { Output } from "@repo-agents/types";
import { generateSkillForOutput, generateSkillsSection } from "./skills";

describe("generateSkillForOutput", () => {
  describe("add-comment output", () => {
    test("should generate skill with basic config", () => {
      const skill = generateSkillForOutput("add-comment", {}, undefined);

      expect(skill).toContain("## Skill: Add Comment");
      expect(skill).toContain("/tmp/outputs/add-comment.json");
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain("Maximum comments: unlimited");
      expect(skill).toContain("Use the Write tool");
    });

    test("should include max constraint when configured", () => {
      const skill = generateSkillForOutput("add-comment", { max: 3 }, undefined);

      expect(skill).toContain("Maximum comments: 3");
    });

    test("should include JSON schema", () => {
      const skill = generateSkillForOutput("add-comment", {}, undefined);

      expect(skill).toContain("**JSON Schema**");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"body": "string"');
    });

    test("should include example usage", () => {
      const skill = generateSkillForOutput("add-comment", {}, undefined);

      expect(skill).toContain("**Example**");
      expect(skill).toContain("add-comment.json");
      expect(skill).toContain("Thank you for reporting");
    });

    test("should document multiple file support", () => {
      const skill = generateSkillForOutput("add-comment", {}, undefined);

      expect(skill).toContain("add-comment-1.json");
      expect(skill).toContain("add-comment-2.json");
    });
  });

  describe("create-pr output", () => {
    test("should generate skill with basic config", () => {
      const skill = generateSkillForOutput("create-pr", {}, undefined);

      expect(skill).toContain("## Skill: Create Pull Request");
      expect(skill).toContain("/tmp/outputs/create-pr.json");
      expect(skill).toContain('"branch": "string"');
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"files": [');
    });

    test("should include max constraint when configured", () => {
      const skill = generateSkillForOutput("create-pr", { max: 2 }, undefined);

      expect(skill).toContain("Maximum PRs: 2");
    });

    test("should include sign commits constraint when enabled", () => {
      const skill = generateSkillForOutput("create-pr", { sign: true }, undefined);

      expect(skill).toContain("Commits must be signed");
      expect(skill).toContain("GPG signature required");
    });

    test("should not mention signing when disabled", () => {
      const skill = generateSkillForOutput("create-pr", { sign: false }, undefined);

      expect(skill).not.toContain("Commits must be signed");
      expect(skill).not.toContain("GPG signature");
    });

    test("should include detailed file structure", () => {
      const skill = generateSkillForOutput("create-pr", {}, undefined);

      expect(skill).toContain('"path": "string"');
      expect(skill).toContain('"content": "string"');
      expect(skill).toContain("Complete file content");
    });

    test("should include example with multiple files", () => {
      const skill = generateSkillForOutput("create-pr", {}, undefined);

      expect(skill).toContain("src/validator.ts");
      expect(skill).toContain("src/validator.test.ts");
    });

    test("should document multiple PR support", () => {
      const skill = generateSkillForOutput("create-pr", {}, undefined);

      expect(skill).toContain("create-pr-1.json");
      expect(skill).toContain("create-pr-2.json");
    });
  });

  describe("update-file output", () => {
    test("should generate skill with basic config", () => {
      const skill = generateSkillForOutput("update-file", {}, undefined);

      expect(skill).toContain("## Skill: Update Files");
      expect(skill).toContain("/tmp/outputs/update-file.json");
      expect(skill).toContain('"files": [');
      expect(skill).toContain('"message": "string"');
      expect(skill).toContain('"branch": "string"');
    });

    test("should include sign commits constraint when enabled", () => {
      const skill = generateSkillForOutput("update-file", { sign: true }, undefined);

      expect(skill).toContain("Commits must be signed");
    });

    test("should reference allowed paths", () => {
      const skill = generateSkillForOutput("update-file", {}, undefined);

      expect(skill).toContain("Allowed File Paths");
      expect(skill).toContain("File paths must match allowed patterns");
    });

    test("should include complete file content instruction", () => {
      const skill = generateSkillForOutput("update-file", {}, undefined);

      expect(skill).toContain("Provide complete file content");
      expect(skill).toContain("not just changes");
    });

    test("should include example with files array", () => {
      const skill = generateSkillForOutput("update-file", {}, undefined);

      expect(skill).toContain("src/config.ts");
      expect(skill).toContain("export const config");
    });
  });

  describe("add-label output", () => {
    test("should generate skill with labels array", () => {
      const skill = generateSkillForOutput("add-label", {}, undefined);

      expect(skill).toContain("## Skill: Add Labels");
      expect(skill).toContain("/tmp/outputs/add-label.json");
      expect(skill).toContain('"labels": ["string"]');
    });

    test("should reference available labels section", () => {
      const skill = generateSkillForOutput("add-label", {}, undefined);

      expect(skill).toContain("Available Repository Labels");
      expect(skill).toContain("Labels must already exist");
    });

    test("should include example with multiple labels", () => {
      const skill = generateSkillForOutput("add-label", {}, undefined);

      expect(skill).toContain('["bug", "priority: high"]');
    });

    test("should document numbered file support", () => {
      const skill = generateSkillForOutput("add-label", {}, undefined);

      expect(skill).toContain("add-label-1.json");
      expect(skill).toContain("add-label-2.json");
    });

    test("should clarify additive behavior", () => {
      const skill = generateSkillForOutput("add-label", {}, undefined);

      expect(skill).toContain("adds to existing labels");
      expect(skill).toContain("doesn't replace");
    });
  });

  describe("remove-label output", () => {
    test("should generate skill for removing labels", () => {
      const skill = generateSkillForOutput("remove-label", {}, undefined);

      expect(skill).toContain("## Skill: Remove Labels");
      expect(skill).toContain("/tmp/outputs/remove-label.json");
      expect(skill).toContain('"labels": ["string"]');
    });

    test("should reference available labels", () => {
      const skill = generateSkillForOutput("remove-label", {}, undefined);

      expect(skill).toContain("Available Repository Labels");
    });
  });

  describe("create-issue output", () => {
    test("should generate skill with all fields", () => {
      const skill = generateSkillForOutput("create-issue", {}, undefined);

      expect(skill).toContain("## Skill: Create Issue");
      expect(skill).toContain("/tmp/outputs/create-issue.json");
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"labels": ["string"] (optional)');
      expect(skill).toContain('"assignees": ["string"] (optional)');
    });

    test("should include max constraint when configured", () => {
      const skill = generateSkillForOutput("create-issue", { max: 5 }, undefined);

      expect(skill).toContain("Maximum issues: 5");
    });

    test("should include example with labels", () => {
      const skill = generateSkillForOutput("create-issue", {}, undefined);

      expect(skill).toContain("Add support for custom configurations");
      expect(skill).toContain("Acceptance Criteria");
      expect(skill).toContain('"labels": ["enhancement"]');
    });

    test("should document multiple issue support", () => {
      const skill = generateSkillForOutput("create-issue", {}, undefined);

      expect(skill).toContain("create-issue-1.json");
      expect(skill).toContain("create-issue-2.json");
    });
  });

  describe("create-discussion output", () => {
    test("should generate skill with required fields", () => {
      const skill = generateSkillForOutput("create-discussion", {}, undefined);

      expect(skill).toContain("## Skill: Create Discussion");
      expect(skill).toContain("/tmp/outputs/create-discussion.json");
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"category": "string"');
    });

    test("should include max constraint when configured", () => {
      const skill = generateSkillForOutput("create-discussion", { max: 1 }, undefined);

      expect(skill).toContain("Maximum discussions: 1");
    });
  });

  describe("close-issue output", () => {
    test("should generate skill for closing issues", () => {
      const skill = generateSkillForOutput("close-issue", {}, undefined);

      expect(skill).toContain("## Skill: Close Issue");
      expect(skill).toContain("/tmp/outputs/close-issue.json");
      expect(skill).toContain('"state_reason"');
    });

    test("should document valid close reasons", () => {
      const skill = generateSkillForOutput("close-issue", {}, undefined);

      expect(skill).toContain("completed");
      expect(skill).toContain("not_planned");
    });
  });

  describe("close-pr output", () => {
    test("should generate skill for closing PRs", () => {
      const skill = generateSkillForOutput("close-pr", {}, undefined);

      expect(skill).toContain("## Skill: Close Pull Request");
      expect(skill).toContain("/tmp/outputs/close-pr.json");
    });
  });

  describe("assign-issue output", () => {
    test("should generate skill for assigning issues", () => {
      const skill = generateSkillForOutput("assign-issue", {}, undefined);

      expect(skill).toContain("## Skill: Assign Issue");
      expect(skill).toContain("/tmp/outputs/assign-issue.json");
      expect(skill).toContain('"assignees": ["string"]');
    });

    test("should include max assignees constraint", () => {
      const skill = generateSkillForOutput("assign-issue", {}, undefined);

      expect(skill).toContain("Maximum 10 assignees");
    });
  });

  describe("request-review output", () => {
    test("should generate skill for requesting reviews", () => {
      const skill = generateSkillForOutput("request-review", {}, undefined);

      expect(skill).toContain("## Skill: Request Review");
      expect(skill).toContain("/tmp/outputs/request-review.json");
      expect(skill).toContain('"reviewers": ["string"]');
    });
  });

  describe("merge-pr output", () => {
    test("should generate skill for merging PRs", () => {
      const skill = generateSkillForOutput("merge-pr", {}, undefined);

      expect(skill).toContain("## Skill: Merge Pull Request");
      expect(skill).toContain("/tmp/outputs/merge-pr.json");
    });

    test("should document merge methods", () => {
      const skill = generateSkillForOutput("merge-pr", {}, undefined);

      expect(skill).toContain("merge");
      expect(skill).toContain("squash");
      expect(skill).toContain("rebase");
    });
  });

  describe("approve-pr output", () => {
    test("should generate skill for approving PRs", () => {
      const skill = generateSkillForOutput("approve-pr", {}, undefined);

      expect(skill).toContain("## Skill: Approve Pull Request");
      expect(skill).toContain("/tmp/outputs/approve-pr.json");
    });
  });

  describe("create-release output", () => {
    test("should generate skill with release fields", () => {
      const skill = generateSkillForOutput("create-release", {}, undefined);

      expect(skill).toContain("## Skill: Create Release");
      expect(skill).toContain("/tmp/outputs/create-release.json");
      expect(skill).toContain('"tag_name": "string"');
      expect(skill).toContain('"name": "string"');
      expect(skill).toContain('"body": "string"');
    });

    test("should document prerelease and draft options", () => {
      const skill = generateSkillForOutput("create-release", {}, undefined);

      expect(skill).toContain("prerelease");
      expect(skill).toContain("draft");
    });
  });

  describe("delete-branch output", () => {
    test("should generate skill for deleting branches", () => {
      const skill = generateSkillForOutput("delete-branch", {}, undefined);

      expect(skill).toContain("## Skill: Delete Branch");
      expect(skill).toContain("/tmp/outputs/delete-branch.json");
      expect(skill).toContain('"branch": "string"');
    });
  });

  describe("lock-conversation output", () => {
    test("should generate skill for locking conversations", () => {
      const skill = generateSkillForOutput("lock-conversation", {}, undefined);

      expect(skill).toContain("## Skill: Lock Conversation");
      expect(skill).toContain("/tmp/outputs/lock-conversation.json");
    });

    test("should document lock reasons", () => {
      const skill = generateSkillForOutput("lock-conversation", {}, undefined);

      expect(skill).toContain("off-topic");
      expect(skill).toContain("too heated");
      expect(skill).toContain("resolved");
      expect(skill).toContain("spam");
    });
  });

  describe("pin-issue output", () => {
    test("should generate skill for pinning issues", () => {
      const skill = generateSkillForOutput("pin-issue", {}, undefined);

      expect(skill).toContain("## Skill: Pin Issue");
      expect(skill).toContain("/tmp/outputs/pin-issue.json");
    });
  });

  describe("convert-to-discussion output", () => {
    test("should generate skill for converting to discussion", () => {
      const skill = generateSkillForOutput("convert-to-discussion", {}, undefined);

      expect(skill).toContain("## Skill: Convert to Discussion");
      expect(skill).toContain("/tmp/outputs/convert-to-discussion.json");
      expect(skill).toContain('"category": "string"');
    });
  });

  describe("edit-issue output", () => {
    test("should generate skill for editing issues", () => {
      const skill = generateSkillForOutput("edit-issue", {}, undefined);

      expect(skill).toContain("## Skill: Edit Issue");
      expect(skill).toContain("/tmp/outputs/edit-issue.json");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain("(optional): New title");
    });
  });

  describe("reopen-issue output", () => {
    test("should generate skill for reopening issues", () => {
      const skill = generateSkillForOutput("reopen-issue", {}, undefined);

      expect(skill).toContain("## Skill: Reopen Issue");
      expect(skill).toContain("/tmp/outputs/reopen-issue.json");
    });
  });

  describe("set-milestone output", () => {
    test("should generate skill for setting milestones", () => {
      const skill = generateSkillForOutput("set-milestone", {}, undefined);

      expect(skill).toContain("## Skill: Set Milestone");
      expect(skill).toContain("/tmp/outputs/set-milestone.json");
      expect(skill).toContain('"milestone": "string"');
    });
  });

  describe("trigger-workflow output", () => {
    test("should generate skill for triggering workflows", () => {
      const skill = generateSkillForOutput("trigger-workflow", {}, undefined);

      expect(skill).toContain("## Skill: Trigger Workflow");
      expect(skill).toContain("/tmp/outputs/trigger-workflow.json");
      expect(skill).toContain('"workflow": "string"');
    });

    test("should document workflow inputs", () => {
      const skill = generateSkillForOutput("trigger-workflow", {}, undefined);

      expect(skill).toContain('"inputs": {');
      expect(skill).toContain('"key": "value"');
    });
  });

  describe("add-reaction output", () => {
    test("should generate skill for adding reactions", () => {
      const skill = generateSkillForOutput("add-reaction", {}, undefined);

      expect(skill).toContain("## Skill: Add Reaction");
      expect(skill).toContain("/tmp/outputs/add-reaction.json");
      expect(skill).toContain('"reaction": "string"');
    });

    test("should list valid reactions", () => {
      const skill = generateSkillForOutput("add-reaction", {}, undefined);

      expect(skill).toContain("+1");
      expect(skill).toContain("-1");
      expect(skill).toContain("laugh");
      expect(skill).toContain("hooray");
      expect(skill).toContain("confused");
      expect(skill).toContain("heart");
      expect(skill).toContain("rocket");
      expect(skill).toContain("eyes");
    });
  });

  describe("create-branch output", () => {
    test("should generate skill for creating branches", () => {
      const skill = generateSkillForOutput("create-branch", {}, undefined);

      expect(skill).toContain("## Skill: Create Branch");
      expect(skill).toContain("/tmp/outputs/create-branch.json");
      expect(skill).toContain('"branch": "string"');
    });

    test("should document base branch option", () => {
      const skill = generateSkillForOutput("create-branch", {}, undefined);

      expect(skill).toContain('"from_ref"');
      expect(skill).toContain('"from_sha"');
    });
  });

  describe("error handling", () => {
    test("should return empty string for invalid output type", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      const skill = generateSkillForOutput("invalid-output" as Output, {}, undefined);

      expect(skill).toBe("");

      // Restore console.error
      console.error = originalError;
    });

    test("should handle missing handler gracefully", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = () => {};

      // This test verifies that the error handling in generateSkillForOutput works
      const skill = generateSkillForOutput("nonexistent" as Output, {}, undefined);

      expect(skill).toBe("");

      // Restore console.error
      console.error = originalError;
    });
  });
});

describe("generateSkillsSection", () => {
  test("should return empty string when no outputs", () => {
    const section = generateSkillsSection(undefined, undefined);

    expect(section).toBe("");
  });

  test("should return empty string for empty outputs object", () => {
    const section = generateSkillsSection({}, undefined);

    expect(section).toBe("");
  });

  test("should generate section header", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
      },
      undefined,
    );

    expect(section).toContain("---");
    expect(section).toContain("# Available Operations");
    expect(section).toContain("authorized to perform the following operations");
  });

  test("should include single output skill", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
      },
      undefined,
    );

    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("/tmp/outputs/add-comment.json");
  });

  test("should include multiple output skills", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
        "add-label": true,
        "create-pr": { max: 2 },
      },
      undefined,
    );

    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("## Skill: Add Labels");
    expect(section).toContain("## Skill: Create Pull Request");
  });

  test("should pass through output config objects", () => {
    const section = generateSkillsSection(
      {
        "create-pr": { max: 3, sign: true },
      },
      undefined,
    );

    expect(section).toContain("Maximum PRs: 3");
    expect(section).toContain("Commits must be signed");
  });

  test("should handle boolean config as empty object", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
      },
      undefined,
    );

    expect(section).toContain("Maximum comments: unlimited");
  });

  test("should handle mixed config types", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
        "create-pr": { max: 1 },
        "update-file": { sign: true },
      },
      undefined,
    );

    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("## Skill: Create Pull Request");
    expect(section).toContain("## Skill: Update Files");
  });

  test("should pass allowed paths to outputs", () => {
    const section = generateSkillsSection(
      {
        "update-file": true,
      },
      ["src/**/*.ts", "docs/**/*.md"],
    );

    expect(section).toContain("## Skill: Update Files");
    // The allowed paths reference is in the skill itself
    expect(section).toContain("Allowed File Paths");
  });

  test("should separate skills with double newlines", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
        "add-label": true,
      },
      undefined,
    );

    // Skills should be separated by exactly two newlines
    const skills = section.split("\n\n");
    expect(skills.length).toBeGreaterThan(2);
  });

  test("should handle all output types", () => {
    const allOutputs: Record<string, boolean> = {
      "add-comment": true,
      "add-label": true,
      "remove-label": true,
      "create-issue": true,
      "create-discussion": true,
      "create-pr": true,
      "update-file": true,
      "close-issue": true,
      "close-pr": true,
      "assign-issue": true,
      "request-review": true,
      "merge-pr": true,
      "approve-pr": true,
      "create-release": true,
      "delete-branch": true,
      "lock-conversation": true,
      "pin-issue": true,
      "convert-to-discussion": true,
      "edit-issue": true,
      "reopen-issue": true,
      "set-milestone": true,
      "trigger-workflow": true,
      "add-reaction": true,
      "create-branch": true,
    };

    const section = generateSkillsSection(allOutputs, undefined);

    expect(section).toContain("# Available Operations");
    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("## Skill: Create Pull Request");
    expect(section).toContain("## Skill: Update Files");
    expect(section).toContain("## Skill: Add Labels");
    expect(section).toContain("## Skill: Create Issue");
  });

  test("should handle empty config object", () => {
    const section = generateSkillsSection(
      {
        "add-comment": {},
      },
      undefined,
    );

    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("Maximum comments: unlimited");
  });

  test("should maintain proper markdown formatting", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
        "create-pr": true,
      },
      undefined,
    );

    // Check for proper markdown headers
    expect(section).toMatch(/^---$/m);
    expect(section).toMatch(/^# Available Operations$/m);
    expect(section).toMatch(/^## Skill:/m);

    // Check for proper code blocks
    expect(section).toContain("```json");
    expect(section).toContain("```");

    // Check for proper field formatting
    expect(section).toContain("**File to create**");
    expect(section).toContain("**JSON Schema**");
    expect(section).toContain("**Example**");
    expect(section).toContain("**Important**");
  });

  test("should include Write tool instruction", () => {
    const section = generateSkillsSection(
      {
        "add-comment": true,
      },
      undefined,
    );

    expect(section).toContain("Use the Write tool");
  });

  test("should skip outputs that fail to generate", () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    // This test verifies that if one output fails, others still work
    const section = generateSkillsSection(
      {
        "add-comment": true,
        "invalid-output": true,
        "create-pr": true,
      } as Record<string, boolean>,
      undefined,
    );

    expect(section).toContain("## Skill: Add Comment");
    expect(section).toContain("## Skill: Create Pull Request");
    // Invalid output should be skipped (empty string)

    // Restore console.error
    console.error = originalError;
  });

  test("should handle max constraints across outputs", () => {
    const section = generateSkillsSection(
      {
        "add-comment": { max: 5 },
        "create-issue": { max: 10 },
        "create-pr": { max: 2 },
      },
      undefined,
    );

    expect(section).toContain("Maximum comments: 5");
    expect(section).toContain("Maximum issues: 10");
    expect(section).toContain("Maximum PRs: 2");
  });

  test("should handle sign constraints for code outputs", () => {
    const section = generateSkillsSection(
      {
        "create-pr": { sign: true },
        "update-file": { sign: false },
      },
      undefined,
    );

    // create-pr should mention signing
    const prSection = section.split("## Skill: Update Files")[0];
    expect(prSection).toContain("Commits must be signed");

    // update-file should not mention signing when false
    const updateSection = section.split("## Skill: Update Files")[1];
    expect(updateSection).not.toContain("Commits must be signed");
  });
});
