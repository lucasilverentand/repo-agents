import type { RuntimeContext } from "./base";
import { handler } from "./create-branch";

describe("CreateBranchHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: "",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("create-branch");
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

      expect(skill).toContain("## Skill: Create Branch");
      expect(skill).toContain("/tmp/outputs/create-branch.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"branch": "string"');
      expect(skill).toContain('"from_ref": "string"');
      expect(skill).toContain('"from_sha": "string"');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("branch");
      expect(skill).toContain("(required)");
      expect(skill).toContain("from_ref");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("from_sha");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum branches: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum branches: 5");
    });

    it("should include constraints about branch naming", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Branch name must be valid");
      expect(skill).toContain("Branch must not already exist");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"branch": "feature/new-feature"');
      expect(skill).toContain('"from_ref": "main"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("create-branch-1.json");
      expect(skill).toContain("create-branch-2.json");
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

      expect(script).toContain('find /tmp/outputs -name "create-branch*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate branch is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("branch is required");
    });

    it("should validate branch name format", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("Invalid branch name");
      expect(script).toContain("[a-zA-Z0-9][a-zA-Z0-9/_.-]*");
    });

    it("should check if branch already exists", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("git ls-remote");
      expect(script).toContain("Branch '$BRANCH' already exists");
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

    it("should default from_ref to main", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.from_ref // "main"');
    });

    it("should resolve from_ref to SHA", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/git/refs/heads/$FROM_REF");
      expect(script).toContain("TARGET_SHA");
    });

    it("should create branch via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/git/refs");
      expect(script).toContain('-f ref="refs/heads/$BRANCH"');
      expect(script).toContain('-f sha="$TARGET_SHA"');
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
