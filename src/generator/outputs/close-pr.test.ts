import { handler } from './close-pr';
import type { RuntimeContext } from './base';

describe('ClosePRHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: undefined,
    prNumber: '456',
    issueOrPrNumber: '456',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('close-pr');
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

      expect(skill).toContain('## Skill: Close Pull Request');
      expect(skill).toContain('/tmp/outputs/close-pr.json');
      expect(skill).toContain('merge');
    });

    it('should include JSON schema', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"merge": false');
    });

    it('should explain merge option', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('merge');
      expect(skill).toContain('Set to true to merge instead of just closing');
    });

    it('should include example', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('"merge": false');
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

      expect(script).toContain('if [ -f "/tmp/outputs/close-pr.json" ]');
      expect(script).toContain('jq empty');
      expect(script).toContain('SHOULD_MERGE');
    });

    it('should use runtime context for repository', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('owner/repo');
    });

    it('should check for PR number', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('PR_NUMBER');
      expect(script).toContain('if [ -z "$PR_NUMBER" ]');
    });

    it('should support both close and merge operations', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$SHOULD_MERGE" = "true" ]');
      expect(script).toContain('/pulls/$PR_NUMBER/merge');
      expect(script).toContain('state="closed"');
    });

    it('should use GitHub API', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api');
      expect(script).toContain('-X PUT');
      expect(script).toContain('-X PATCH');
    });
  });
});
