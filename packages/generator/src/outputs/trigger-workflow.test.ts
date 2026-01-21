import type { RuntimeContext } from "./base";
import { handler } from "./trigger-workflow";

describe("TriggerWorkflowHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: "",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("trigger-workflow");
    });
  });

  describe("getContextScript", () => {
    it("should return context script for fetching workflows", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).not.toBeNull();
      expect(result).toContain("Available Workflows");
    });

    it("should fetch workflows via GitHub API", () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toContain("gh api");
      expect(result).toContain("/actions/workflows");
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

      expect(skill).toContain("## Skill: Trigger Workflow");
      expect(skill).toContain("/tmp/outputs/trigger-workflow.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"workflow": "string"');
      expect(skill).toContain('"ref": "string"');
      expect(skill).toContain('"inputs":');
      expect(skill).toContain('"key": "value"');
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("workflow");
      expect(skill).toContain("(required)");
      expect(skill).toContain("ref");
      expect(skill).toContain("(optional)");
      expect(skill).toContain("inputs");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum dispatches: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum dispatches: 5");
    });

    it("should include constraints about workflow_dispatch", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("workflow_dispatch");
      expect(skill).toContain("Inputs must match workflow's input schema");
    });

    it("should include example with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"workflow": "deploy.yml"');
      expect(skill).toContain('"ref": "main"');
      expect(skill).toContain('"inputs":');
      expect(skill).toContain('"environment": "staging"');
      expect(skill).toContain('"version": "1.2.3"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("trigger-workflow-1.json");
      expect(skill).toContain("trigger-workflow-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("Check available workflows");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "trigger-workflow*.json"');
      expect(script).toContain("jq empty");
    });

    it("should validate workflow is required", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("workflow is required");
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

    it("should default ref to main", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.ref // "main"');
    });

    it("should default inputs to empty object", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain(".inputs // {}");
    });

    it("should build request body with ref and inputs", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("REQUEST_BODY");
      expect(script).toContain("jq -n");
      expect(script).toContain("--arg ref");
      expect(script).toContain("--argjson inputs");
    });

    it("should trigger workflow via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/actions/workflows/$WORKFLOW/dispatches");
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
