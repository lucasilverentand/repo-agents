import type { RuntimeContext } from "./base";
import { handler } from "./request-review";

describe("RequestReviewHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: "456",
    issueOrPrNumber: "456",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("request-review");
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

      expect(skill).toContain("## Skill: Request Review");
      expect(skill).toContain("/tmp/outputs/request-review.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"pr_number": number');
      expect(skill).toContain('"reviewers": ["string"]');
      expect(skill).toContain('"team_reviewers": ["string"]');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("pr_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("reviewers");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("team_reviewers");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum review requests: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum review requests: 5");
    });

    it("should include constraints about reviewers", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("At least one of");
      expect(skill).toContain("reviewers");
      expect(skill).toContain("or");
      expect(skill).toContain("team_reviewers");
      expect(skill).toContain("Maximum 15 total reviewers per PR");
    });

    it("should include example with both reviewers and team_reviewers", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"pr_number": 123');
      expect(skill).toContain('"reviewers": ["user1", "user2"]');
      expect(skill).toContain('"team_reviewers": ["core-team"]');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("request-review-1.json");
      expect(skill).toContain("request-review-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("repository access");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "request-review*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate pr_number is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("pr_number is required");
    });

    it("should validate pr_number is a number", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("pr_number must be a number");
      expect(script).toContain("grep -qE '^[0-9]+$'");
    });

    it("should validate reviewers is an array", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("reviewers must be an array");
      expect(script).toContain("jq -e 'type == \"array\"'");
    });

    it("should validate team_reviewers is an array", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("team_reviewers must be an array");
      expect(script).toContain("jq -e 'type == \"array\"'");
    });

    it("should validate at least one reviewer is specified", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("At least one reviewer or team_reviewer must be specified");
      expect(script).toContain("TOTAL_REVIEWERS");
      expect(script).toContain('if [ "$TOTAL_REVIEWERS" -eq 0 ]');
    });

    it("should validate maximum 15 total reviewers", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Maximum 15 total reviewers allowed");
      expect(script).toContain('if [ "$TOTAL_REVIEWERS" -gt 15 ]');
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

    it("should default reviewers arrays to empty", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain(".reviewers // []");
      expect(script).toContain(".team_reviewers // []");
    });

    it("should request reviewers via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/pulls/$PR_NUMBER/requested_reviewers");
      expect(script).toContain("-X POST");
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
