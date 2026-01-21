import { handler } from "./assign-issue";
import type { RuntimeContext } from "./base";

describe("AssignIssueHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("assign-issue");
    });
  });

  describe("getContextScript", () => {
    it("should return null (no dynamic context needed)", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toBeNull();
    });
  });

  describe("generateSkill", () => {
    it("should generate skill documentation", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("## Skill: Assign Issue");
      expect(skill).toContain("/tmp/outputs/assign-issue.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"assignees": ["string"]');
    });

    it("should mark all fields as required", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("assignees");
      expect(skill).toContain("(required)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum assignments: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum assignments: 5");
    });

    it("should include GitHub assignee limit constraint", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum 10 assignees per issue/PR");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"issue_number": 123');
      expect(skill).toContain('"assignees": ["user1", "user2"]');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("assign-issue-1.json");
      expect(skill).toContain("assign-issue-2.json");
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

      expect(script).toContain('find /tmp/outputs -name "assign-issue*.json"');
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

    it("should validate assignees is an array", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("assignees must be an array");
      expect(script).toContain("jq -e 'type == \"array\"'");
    });

    it("should validate assignees array is non-empty", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("assignees array cannot be empty");
    });

    it("should validate maximum 10 assignees", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Maximum 10 assignees allowed");
      expect(script).toContain('if [ "$ASSIGNEE_COUNT" -gt 10 ]');
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

    it("should add assignees via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER/assignees");
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
