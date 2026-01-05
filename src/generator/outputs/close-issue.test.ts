import { handler } from './close-issue';
import type { RuntimeContext } from './base';

describe('CloseIssueHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: '123',
    prNumber: undefined,
    issueOrPrNumber: '123',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('close-issue');
    });
  });

  describe('getContextScript', () => {
    it('should return null (no dynamic context needed)', () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toBeNull();
    });
  });

  describe('generateSkill', () => {
    it('should generate skill documentation', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('## Skill: Close Issue');
      expect(skill).toContain('/tmp/outputs/close-issue.json');
      expect(skill).toContain('state_reason');
      expect(skill).toContain('completed');
      expect(skill).toContain('not_planned');
    });

    it('should include JSON schema', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"completed" | "not_planned"');
    });

    it('should include example', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('"state_reason": "completed"');
    });

    it('should include important notes', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Important');
      expect(skill).toContain('Use the Write tool');
    });
  });

  describe('generateValidationScript', () => {
    it('should generate validation script', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ -f "/tmp/outputs/close-issue.json" ]');
      expect(script).toContain('jq empty');
      expect(script).toContain('STATE_REASON');
    });

    it('should validate state_reason values', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('completed');
      expect(script).toContain('not_planned');
    });

    it('should use runtime context for repository', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('owner/repo');
    });

    it('should check for issue number', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('ISSUE_NUMBER');
      expect(script).toContain('if [ -z "$ISSUE_NUMBER" ]');
    });

    it('should use GitHub API to close issue', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api');
      expect(script).toContain('/issues/$ISSUE_NUMBER');
      expect(script).toContain('-X PATCH');
      expect(script).toContain('state="closed"');
    });
  });
});
