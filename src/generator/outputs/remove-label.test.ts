import { handler } from './remove-label';
import type { RuntimeContext } from './base';

describe('RemoveLabelHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: '123',
    prNumber: undefined,
    issueOrPrNumber: '123',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('remove-label');
    });
  });

  describe('getContextScript', () => {
    it('should fetch available labels from repository', () => {
      const script = handler.getContextScript(mockRuntime);

      expect(script).not.toBeNull();
      expect(script).toContain('gh api "repos/owner/repo/labels"');
      expect(script).toContain('LABELS_JSON');
      expect(script).toContain('LABELS_LIST');
    });

    it('should append labels to context file', () => {
      const script = handler.getContextScript(mockRuntime);

      expect(script).toContain('cat >> /tmp/context.txt');
      expect(script).toContain('Available Repository Labels');
    });

    it('should handle API errors gracefully', () => {
      const script = handler.getContextScript(mockRuntime);

      expect(script).toContain("|| echo '[]'");
      expect(script).toContain('No labels available');
    });
  });

  describe('generateSkill', () => {
    it('should generate skill documentation', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('## Skill: Remove Labels');
      expect(skill).toContain('/tmp/outputs/remove-label.json');
      expect(skill).toContain('labels');
    });

    it('should reference available labels in context', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Available Repository Labels');
      expect(skill).toContain('See the "Available Repository Labels" section');
    });

    it('should include JSON schema', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"labels": ["string"]');
    });

    it('should document constraints', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Constraints');
      expect(skill).toContain('Labels array must be non-empty');
      expect(skill).toContain('silently ignored');
    });

    it('should include example', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('needs-triage');
      expect(skill).toContain('duplicate');
    });

    it('should clarify behavior', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Only removes specified labels, keeps all others');
    });
  });

  describe('generateValidationScript', () => {
    it('should generate validation script', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ -f "/tmp/outputs/remove-label.json" ]');
      expect(script).toContain('jq empty');
    });

    it('should validate labels is an array', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('LABELS_ARRAY');
      expect(script).toContain('type == "array"');
    });

    it('should validate labels array is not empty', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('length');
      expect(script).toContain('labels array cannot be empty');
    });

    it('should check for issue/PR number', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('ISSUE_NUMBER');
      expect(script).toContain('if [ -z "$ISSUE_NUMBER" ]');
    });

    it('should fetch current labels', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('CURRENT_LABELS');
      expect(script).toContain('gh api "repos/owner/repo/issues/$ISSUE_NUMBER"');
    });

    it('should filter out labels to remove', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('LABELS_TO_REMOVE');
      expect(script).toContain('REMAINING_LABELS');
      expect(script).toContain('select');
      expect(script).toContain('index($label) | not');
    });

    it('should update labels via PUT request', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api "repos/owner/repo/issues/$ISSUE_NUMBER/labels"');
      expect(script).toContain('-X PUT');
    });

    it('should use runtime context', () => {
      const customRuntime: RuntimeContext = {
        repository: 'custom/repo',
        issueNumber: '999',
        prNumber: undefined,
        issueOrPrNumber: '999',
      };
      const config = {};
      const script = handler.generateValidationScript(config, customRuntime);

      expect(script).toContain('custom/repo');
    });
  });
});
