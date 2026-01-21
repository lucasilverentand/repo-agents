import type { RuntimeContext } from "./base";
import { handler } from "./set-milestone";

describe("SetMilestoneHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("set-milestone");
    });
  });

  describe("getContextScript", () => {
    it("should return context script for fetching milestones", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).not.toBeNull();
      expect(result).toContain("Available Milestones");
    });

    it("should fetch milestones via GitHub API", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("gh api");
      expect(result).toContain("/milestones");
    });

    it("should use runtime repository", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("owner/repo");
    });
  });

  describe("generateSkill", () => {
    it("should generate skill documentation", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("## Skill: Set Milestone");
      expect(skill).toContain("/tmp/outputs/set-milestone.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"milestone": "string"');
    });

    it("should mark all fields as required", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("milestone");
      expect(skill).toContain("(required)");
      expect(skill).toContain("must match exactly");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum assignments: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 10 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum assignments: 10");
    });

    it("should include constraint about milestone existence", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Milestone must exist in the repository");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"issue_number": 123');
      expect(skill).toContain('"milestone": "v2.0"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("set-milestone-1.json");
      expect(skill).toContain("set-milestone-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("Check available milestones");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "set-milestone*.json"');
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

    it("should validate milestone is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("milestone is required");
    });

    it("should include max constraint check when specified", () => {
      const config = { max: 10 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 10 ]');
      expect(script).toContain("Maximum allowed: 10");
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

    it("should fetch milestones list", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/milestones");
      expect(script).toContain("MILESTONES_JSON");
    });

    it("should find milestone number by title", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("MILESTONE_NUMBER");
      expect(script).toContain("select(.title == ");
    });

    it("should set milestone via GitHub API with PATCH", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER");
      expect(script).toContain("-X PATCH");
      expect(script).toContain('-F milestone="$MILESTONE_NUMBER"');
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
