import type { RuntimeContext } from "./base";
import { handler } from "./copy-project";

describe("CopyProjectHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: "",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("copy-project");
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

      expect(skill).toContain("## Skill: Copy Project");
      expect(skill).toContain("/tmp/outputs/copy-project.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"source_project_number": number');
      expect(skill).toContain('"source_owner": "string"');
      expect(skill).toContain('"target_owner": "string"');
      expect(skill).toContain('"new_title": "string"');
      expect(skill).toContain('"new_description": "string"');
      expect(skill).toContain('"include_items": boolean');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("source_project_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("new_title");
      expect(skill).toContain("(required)");
      expect(skill).toContain("source_owner");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum copy operations: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 3 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum copy operations: 3");
    });

    it("should include example with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"source_project_number": 1');
      expect(skill).toContain('"source_owner": "@me"');
      expect(skill).toContain('"target_owner": "myorg"');
      expect(skill).toContain('"new_title": "Q2 2026 Roadmap"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("copy-project-1.json");
      expect(skill).toContain("copy-project-2.json");
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

      expect(script).toContain('find /tmp/outputs -name "copy-project*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate source_project_number is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("source_project_number is required");
    });

    it("should validate new_title is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("new_title is required");
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

    it("should default optional fields", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.source_owner // "@me"');
      expect(script).toContain('.target_owner // "@me"');
    });

    it("should build gh project copy command with flags", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh project copy");
      expect(script).toContain("--source-owner");
      expect(script).toContain("--target-owner");
      expect(script).toContain("--title");
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
