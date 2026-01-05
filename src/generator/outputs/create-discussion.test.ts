import { handler } from './create-discussion';
import type { RuntimeContext } from './base';

describe('CreateDiscussionHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: '',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('create-discussion');
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

      expect(skill).toContain('## Skill: Create Discussion');
      expect(skill).toContain('/tmp/outputs/create-discussion.json');
      expect(skill).toContain('title');
      expect(skill).toContain('body');
      expect(skill).toContain('category');
    });

    it('should include JSON schema', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"category": "string"');
    });

    it('should show unlimited max by default', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum discussions: unlimited');
    });

    it('should show max constraint when configured', () => {
      const config = { max: 5 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum discussions: 5');
    });

    it('should list common categories', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Common Categories');
      expect(skill).toContain('Announcements');
      expect(skill).toContain('General');
      expect(skill).toContain('Q&A');
    });

    it('should include example', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('Weekly Activity Report');
    });

    it('should support numbered files for multiple discussions', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('create-discussion-1.json');
      expect(skill).toContain('create-discussion-2.json');
    });
  });

  describe('generateValidationScript', () => {
    it('should generate validation script', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "create-discussion*.json"');
      expect(script).toContain('jq empty');
    });

    it('should enforce max constraint when configured', () => {
      const config = { max: 3 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('if [ "$FILE_COUNT" -gt 3 ]');
      expect(script).toContain('Maximum allowed: 3');
    });

    it('should not enforce max when unlimited', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).not.toContain('if [ "$FILE_COUNT" -gt');
    });

    it('should fetch discussion categories', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api graphql');
      expect(script).toContain('discussionCategories');
    });

    it('should validate required fields', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('TITLE');
      expect(script).toContain('BODY');
      expect(script).toContain('CATEGORY');
      expect(script).toContain('title is required');
      expect(script).toContain('body is required');
      expect(script).toContain('category is required');
    });

    it('should validate category exists', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('CATEGORY_ID');
      expect(script).toContain('Category');
      expect(script).toContain('does not exist');
    });

    it('should validate title length', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('256 characters');
    });

    it('should use GraphQL mutation to create discussion', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('createDiscussion');
      expect(script).toContain('mutation');
    });

    it('should append workflow footer to body', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('FOOTER');
      expect(script).toContain('Generated by workflow');
    });

    it('should be atomic (validate all before executing any)', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('VALIDATION_FAILED');
      expect(script).toContain('if [ "$VALIDATION_FAILED" = false ]');
      expect(script).toContain('atomic operation');
    });
  });
});
