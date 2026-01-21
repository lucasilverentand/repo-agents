import type { RuntimeContext } from "./base";
import { handler } from "./delete-branch";

describe("DeleteBranchHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: "",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("delete-branch");
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

      expect(skill).toContain("## Skill: Delete Branch");
      expect(skill).toContain("/tmp/outputs/delete-branch.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"branch": "string"');
    });

    it("should mark branch as required", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("branch");
      expect(skill).toContain("(required)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum deletions: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 3 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum deletions: 3");
    });

    it("should include constraints about protected branches", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Cannot delete protected branches");
      expect(skill).toContain("Cannot delete the default branch");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"branch": "feature/old-feature"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("delete-branch-1.json");
      expect(skill).toContain("delete-branch-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("permanently deleted");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "delete-branch*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate branch is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("branch is required");
    });

    it("should prevent deletion of protected branches", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Cannot delete protected branch");
      expect(script).toContain("main|master|develop|staging|production");
    });

    it("should include max constraint check when specified", () => {
      const config = { max: 3 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 3 ]');
      expect(script).toContain("Maximum allowed: 3");
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

    it("should delete branch via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/git/refs/heads/$BRANCH");
      expect(script).toContain("-X DELETE");
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
