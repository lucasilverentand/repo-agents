import { handler } from './create-issue';
import type { RuntimeContext } from './base';

describe('CreateIssueHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: '',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('create-issue');
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

      expect(skill).toContain('## Skill: Create Issue');
      expect(skill).toContain('/tmp/outputs/create-issue.json');
    });

    it('should include JSON schema with all fields', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"labels": ["string"]');
      expect(skill).toContain('"assignees": ["string"]');
    });

    it('should mark optional fields correctly', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('labels');
      expect(skill).toContain('(optional)');
      expect(skill).toContain('assignees');
    });

    it('should show unlimited constraint when no max specified', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum issues: unlimited');
    });

    it('should show max constraint when specified', () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum issues: 5');
    });

    it('should include example with labels', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('"title":');
      expect(skill).toContain('"body":');
      expect(skill).toContain('enhancement');
      expect(skill).toContain('good first issue');
    });

    it('should include multiple file naming pattern', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('create-issue-1.json');
      expect(skill).toContain('create-issue-2.json');
    });
  });

  describe('generateValidationScript', () => {
    it('should generate validation script', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "create-issue*.json"');
      expect(script).toContain('jq empty');
    });

    it('should validate title is required', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('title is required');
    });

    it('should validate body is required', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('body is required');
    });

    it('should validate title length', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('256');
      expect(script).toContain('title exceeds 256 characters');
    });

    it('should include max constraint check when specified', () => {
      const config = { max: 5 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 5 ]');
      expect(script).toContain('Maximum allowed: 5');
    });

    it('should validate labels exist if provided', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('EXISTING_LABELS');
      expect(script).toContain('Label');
      expect(script).toContain('does not exist in repository');
    });

    it('should use runtime context for repository', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('owner/repo');
    });

    it('should use GitHub API to create issue', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api "repos/owner/repo/issues"');
      expect(script).toContain('--input');
    });

    it('should build payload with all fields', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('PAYLOAD');
      expect(script).toContain('title');
      expect(script).toContain('body');
      expect(script).toContain('labels');
      expect(script).toContain('assignees');
    });

    it('should implement atomic validation', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('Phase 1: Validate all files');
      expect(script).toContain('Phase 2: Execute only if all validations passed');
      expect(script).toContain('VALIDATION_FAILED');
    });
  });
});
