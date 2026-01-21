import type { RuntimeContext } from "./base";
import { handler } from "./convert-to-discussion";

describe("ConvertToDiscussionHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("convert-to-discussion");
    });
  });

  describe("getContextScript", () => {
    it("should return context script for fetching categories", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).not.toBeNull();
      expect(result).toContain("Available Discussion Categories");
    });

    it("should fetch categories via GraphQL", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("gh api graphql");
      expect(result).toContain("discussionCategories");
    });

    it("should use runtime repository for owner and name", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("owner");
      expect(result).toContain("repo");
    });
  });

  describe("generateSkill", () => {
    it("should generate skill documentation", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("## Skill: Convert to Discussion");
      expect(skill).toContain("/tmp/outputs/convert-to-discussion.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"category": "string"');
    });

    it("should mark all fields as required", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("category");
      expect(skill).toContain("(required)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum conversions: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 2 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum conversions: 2");
    });

    it("should include constraints about conversion behavior", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Only works on issues, not pull requests");
      expect(skill).toContain("Original issue will be closed and locked");
      expect(skill).toContain("All comments are preserved");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"issue_number": 123');
      expect(skill).toContain('"category": "Q&A"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("convert-to-discussion-1.json");
      expect(skill).toContain("convert-to-discussion-2.json");
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

      expect(script).toContain('find /tmp/outputs -name "convert-to-discussion*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate issue_number is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("issue_number is required");
    });

    it("should validate issue_number is a number", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("issue_number must be a number");
      expect(script).toContain("grep -qE '^[0-9]+$'");
    });

    it("should validate category is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("category is required");
    });

    it("should include max constraint check when specified", () => {
      const config = { max: 2 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 2 ]');
      expect(script).toContain("Maximum allowed: 2");
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

    it("should fetch issue node ID", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER");
      expect(script).toContain("node_id");
    });

    it("should fetch category ID by name via GraphQL", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api graphql");
      expect(script).toContain("discussionCategories");
      expect(script).toContain("CATEGORY_ID");
    });

    it("should convert via GraphQL mutation", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("convertIssueToDiscussion");
      expect(script).toContain("issueId");
      expect(script).toContain("categoryId");
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
