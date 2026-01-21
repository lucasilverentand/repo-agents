import type { RuntimeContext } from "./base";
import { handler } from "./create-release";

describe("CreateReleaseHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: "",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("create-release");
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

      expect(skill).toContain("## Skill: Create Release");
      expect(skill).toContain("/tmp/outputs/create-release.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"tag_name": "string"');
      expect(skill).toContain('"name": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"draft": boolean');
      expect(skill).toContain('"prerelease": boolean');
      expect(skill).toContain('"generate_release_notes": boolean');
      expect(skill).toContain('"target_commitish": "string"');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("tag_name");
      expect(skill).toContain("(required)");
      expect(skill).toContain("name");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("draft");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum releases: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 3 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum releases: 3");
    });

    it("should include constraints about tag existence", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Tag must not already exist");
    });

    it("should include example with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"tag_name": "v1.2.3"');
      expect(skill).toContain('"name": "Release v1.2.3"');
      expect(skill).toContain('"body":');
      expect(skill).toContain('"draft": false');
      expect(skill).toContain('"prerelease": false');
      expect(skill).toContain('"generate_release_notes": true');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("create-release-1.json");
      expect(skill).toContain("create-release-2.json");
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

      expect(script).toContain('find /tmp/outputs -name "create-release*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate tag_name is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("tag_name is required");
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

    it("should default name to tag_name", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain(".name // .tag_name");
    });

    it("should default optional fields", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain(".draft // false");
      expect(script).toContain(".prerelease // false");
      expect(script).toContain(".generate_release_notes // false");
      expect(script).toContain('.target_commitish // "main"');
    });

    it("should build gh release create command with flags", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh release create");
      expect(script).toContain("--title");
      expect(script).toContain("--target");
      expect(script).toContain("--draft");
      expect(script).toContain("--prerelease");
      expect(script).toContain("--generate-notes");
      expect(script).toContain("--notes");
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
