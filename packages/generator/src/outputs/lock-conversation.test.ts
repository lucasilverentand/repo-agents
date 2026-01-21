import type { RuntimeContext } from "./base";
import { handler } from "./lock-conversation";

describe("LockConversationHandler", () => {
  const mockRuntime: RuntimeContext = {
    repository: "owner/repo",
    issueNumber: "123",
    prNumber: undefined,
    issueOrPrNumber: "123",
  };

  describe("handler properties", () => {
    it("should have correct name", () => {
      expect(handler.name).toBe("lock-conversation");
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

      expect(skill).toContain("## Skill: Lock Conversation");
      expect(skill).toContain("/tmp/outputs/lock-conversation.json");
    });

    it("should include JSON schema with all fields", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("JSON Schema");
      expect(skill).toContain('"issue_number": number');
      expect(skill).toContain('"lock_reason":');
      expect(skill).toContain("off-topic");
      expect(skill).toContain("too heated");
      expect(skill).toContain("resolved");
      expect(skill).toContain("spam");
    });

    it("should mark fields correctly as required or optional", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("issue_number");
      expect(skill).toContain("(required)");
      expect(skill).toContain("lock_reason");
      expect(skill).toContain("(optional)");
    });

    it("should show unlimited constraint when no max specified", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum locks: unlimited");
    });

    it("should show max constraint when specified", () => {
      const config = { max: 2 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Maximum locks: 2");
    });

    it("should include constraints about lock reasons", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Only these lock reasons are supported");
    });

    it("should include example", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Example");
      expect(skill).toContain('"issue_number": 123');
      expect(skill).toContain('"lock_reason": "resolved"');
    });

    it("should include multiple file naming pattern", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("lock-conversation-1.json");
      expect(skill).toContain("lock-conversation-2.json");
    });

    it("should include important notes about Write tool", () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain("Important");
      expect(skill).toContain("Use the Write tool");
      expect(skill).toContain("prevents new comments");
    });
  });

  describe("generateValidationScript", () => {
    it("should generate validation script", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "lock-conversation*.json"');
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

    it("should validate lock reason values", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("lock_reason must be one of");
      expect(script).toContain("off-topic|too heated|resolved|spam");
    });

    it("should default lock_reason to resolved", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.lock_reason // "resolved"');
    });

    it("should include max constraint check when specified", () => {
      const config = { max: 2 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 2 ]');
      expect(script).toContain("Maximum allowed: 2");
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

    it("should lock conversation via GitHub API", () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain("gh api");
      expect(script).toContain("/issues/$ISSUE_NUMBER/lock");
      expect(script).toContain("-X PUT");
      expect(script).toContain('-f lock_reason="$LOCK_REASON"');
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
