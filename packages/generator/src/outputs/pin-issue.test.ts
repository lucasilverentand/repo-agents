import type { RuntimeContext } from "./base";
import { handler } from "./pin-issue";

describe("PinIssueHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("pin-issue");
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

      expect(skill).toContain("## Skill: Pin Issue");
      expect(skill).toContain("/tmp/outputs/pin-issue.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
    });

    it("should mark issue_number as required", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(required)");
    });

    it("should default to max 3 pins when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum pins: 3");
    });

    it("should show custom max constraint when specified", () => {
      const config = { max: 2 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum pins: 2");
    });

    it("should include GitHub limit constraint", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("GitHub allows max 3 pinned issues");
    });

    it("should include constraint about issues only", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Only works on issues, not pull requests");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"issue_number": 123');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("pin-issue-1.json");
      expect(skill).toContain("pin-issue-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("GraphQL API");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "pin-issue*.json"');
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

    it("should always enforce max constraint (defaults to 3)", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 3 ]');
      expect(script).toContain("Maximum allowed: 3");
    });

    it("should use custom max when specified", () => {
      const config = { max: 2 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 2 ]');
      expect(script).toContain("Maximum allowed: 2");
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
      expect(script).toContain("ISSUE_NODE_ID");
      expect(script).toContain("node_id");
    });

    it("should pin issue via GraphQL mutation", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api graphql");
      expect(script).toContain("pinIssue");
      expect(script).toContain("issueId");
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
