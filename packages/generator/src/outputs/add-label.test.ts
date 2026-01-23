import { handler } from "./add-label";
import type { RuntimeContext } from "./base";

describe("AddLabelHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("add-label");
    });
  });

  describe("getContextScript", () => {
    it("should return labels context script", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).not.toBeNull();
      expect(result).toContain("gh api");
      expect(result).toContain("repos/owner/repo/labels");
      expect(result).toContain("Available Repository Labels");
    });
  });

  describe("generateSkill", () => {
    it("should generate skill documentation", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("## Skill: Add Labels");
      expect(skill).toContain("/tmp/outputs/add-label.json");
      expect(skill).toContain("labels");
    });

    it("should include JSON schema", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"labels": ["string"]');
    });

    it("should reference available labels section", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Available Repository Labels");
      expect(skill).toContain("must already exist in the repository");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"labels":');
      expect(skill).toContain("bug");
      expect(skill).toContain("priority: high");
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("add-label-1.json");
      expect(skill).toContain("add-label-2.json");
    });

    it("should note that operation adds to existing labels", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("adds to existing labels (doesn't replace them)");
    });

    it("should include blocked labels in skill documentation when configured", () => {
      const config = { "blocked-labels": ["approved", "agent-assigned"] };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Blocked labels");
      expect(skill).toContain("`approved`");
      expect(skill).toContain("`agent-assigned`");
      expect(skill).toContain("Cannot add blocked labels");
    });

    it("should not mention blocked labels when none configured", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).not.toContain("Blocked labels");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "add-label*.json"');
      expect(script).toContain("jq empty");
    });

    it("should fetch existing labels from repository", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("EXISTING_LABELS");
      expect(script).toContain('gh api "repos/owner/repo/labels"');
    });

    it("should validate labels is an array", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("labels field must be an array");
    });

    it("should validate labels array is non-empty", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("labels array cannot be empty");
    });

    it("should validate each label exists in repository", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("INVALID_LABELS");
      expect(script).toContain("do not exist in the repository");
    });

    it("should use runtime context for repository", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("owner/repo");
    });

    it("should check for issue/PR number", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("ISSUE_NUMBER");
      expect(script).toContain('if [ -z "$ISSUE_NUMBER" ]');
    });

    it("should merge with existing labels before applying", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("CURRENT_LABELS");
      expect(script).toContain("MERGED_LABELS");
      expect(script).toContain("unique");
    });

    it("should use GitHub API PUT to set labels", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER/labels");
      expect(script).toContain("-X PUT");
    });

    it("should implement atomic validation", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Phase 1: Validate all files");
      expect(script).toContain("Phase 2: Execute only if all validations passed");
      expect(script).toContain("VALIDATION_FAILED");
    });

    it("should check for blocked labels when configured", () => {
      const config = { "blocked-labels": ["approved", "agent-assigned"] };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("BLOCKED_LABELS");
      expect(script).toContain("approved");
      expect(script).toContain("agent-assigned");
      expect(script).toContain("BLOCKED_LABELS_ATTEMPTED");
      expect(script).toContain("labels are blocked and cannot be added");
    });

    it("should filter out blocked labels before applying", () => {
      const config = { "blocked-labels": ["approved"] };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("FILTERED_LABELS");
      expect(script).toContain("select(. as $l | $blocked | index($l) | not)");
    });

    it("should have empty blocked labels array when none configured", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('BLOCKED_LABELS=\'[]\'');
    });
  });
});
