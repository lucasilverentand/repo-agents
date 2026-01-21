import { handler } from "./add-reaction";
import type { RuntimeContext } from "./base";

describe("AddReactionHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("add-reaction");
    });
  });

  describe("getContextScript", () => {
    it("should return context script with available reactions", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).not.toBeNull();
      expect(result).toContain("Available Reactions");
    });

    it("should list all supported reactions", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("+1");
      expect(result).toContain("-1");
      expect(result).toContain("laugh");
      expect(result).toContain("confused");
      expect(result).toContain("heart");
      expect(result).toContain("hooray");
      expect(result).toContain("rocket");
      expect(result).toContain("eyes");
    });
  });

  describe("generateSkill", () => {
    it("should generate skill documentation", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("## Skill: Add Reaction");
      expect(skill).toContain("/tmp/outputs/add-reaction.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"comment_id": number');
      expect(skill).toContain('"reaction": "string"');
    });

    it("should mark fields as optional correctly", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("comment_id");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("reaction");
      expect(skill).toContain("(required)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum reactions: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum reactions: 5");
    });

    it("should include examples for both issue and comment reactions", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("React to an issue");
      expect(skill).toContain('"issue_number": 123');
      expect(skill).toContain("React to a comment");
      expect(skill).toContain('"comment_id": 456789');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("add-reaction-1.json");
      expect(skill).toContain("add-reaction-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "add-reaction*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate reaction is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("reaction is required");
    });

    it("should validate reaction type", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Invalid reaction");
      expect(script).toContain("+1|-1|laugh|confused|heart|hooray|rocket|eyes");
    });

    it("should validate exactly one target is specified", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Either issue_number or comment_id must be specified");
      expect(script).toContain("Cannot specify both issue_number and comment_id");
    });

    it("should include max constraint check when specified", () => {
      const config = { max: 5 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 5 ]');
      expect(script).toContain("Maximum allowed: 5");
    });

    it("should not include max constraint check when not specified", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).not.toContain('if [ "$FILE_COUNT" -gt');
    });

    it("should use runtime context for repository", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("owner/repo");
    });

    it("should handle issue reactions via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER/reactions");
    });

    it("should handle comment reactions via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("/issues/comments/$COMMENT_ID/reactions");
    });

    it("should implement atomic validation (validate all, then execute)", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Phase 1: Validate all files");
      expect(script).toContain("Phase 2: Execute only if all validations passed");
      expect(script).toContain("VALIDATION_FAILED");
    });
  });
});
