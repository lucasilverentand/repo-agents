import type { RuntimeContext } from "./base";
import { handler } from "./merge-pr";

describe("MergePRHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: "456",
    issueOrPrNumber: "456",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("merge-pr");
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

      expect(skill).toContain("## Skill: Merge Pull Request");
      expect(skill).toContain("/tmp/outputs/merge-pr.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"pr_number": number');
      expect(skill).toContain('"merge_method":');
      expect(skill).toContain("merge");
      expect(skill).toContain("squash");
      expect(skill).toContain("rebase");
      expect(skill).toContain('"commit_title": "string"');
      expect(skill).toContain('"commit_message": "string"');
      expect(skill).toContain('"delete_branch": boolean');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("pr_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("merge_method");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("delete_branch");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum merges: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 3 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum merges: 3");
    });

    it("should include constraints about mergeability", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("PR must be mergeable");
      expect(skill).toContain("Merge method must be allowed");
    });

    it("should include example with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"pr_number": 123');
      expect(skill).toContain('"merge_method": "squash"');
      expect(skill).toContain('"commit_title":');
      expect(skill).toContain('"commit_message":');
      expect(skill).toContain('"delete_branch": true');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("merge-pr-1.json");
      expect(skill).toContain("merge-pr-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("merged immediately");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "merge-pr*.json"');
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

    it("should validate merge_method values", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("merge_method must be");
      expect(script).toContain("merge|squash|rebase");
    });

    it("should default merge_method to merge", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.merge_method // "merge"');
    });

    it("should check if PR is open", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/pulls/$PR_NUMBER");
      expect(script).toContain("PR_STATE");
      expect(script).toContain('if [ "$PR_STATE" != "open" ]');
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

    it("should default delete_branch to true", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain(".delete_branch // true");
    });

    it("should merge PR via gh CLI with options", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh pr merge");
      expect(script).toContain("--$MERGE_METHOD");
      expect(script).toContain("--subject");
      expect(script).toContain("--body");
      expect(script).toContain("--delete-branch");
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
