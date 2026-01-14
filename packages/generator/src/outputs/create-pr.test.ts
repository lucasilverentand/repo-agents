import { handler } from './create-pr';
import type { RuntimeContext } from './base';

describe('CreatePRHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: '',
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('create-pr');
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

      expect(skill).toContain('## Skill: Create Pull Request');
      expect(skill).toContain('/tmp/outputs/create-pr.json');
    });

    it('should include JSON schema with all fields', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"branch": "string"');
      expect(skill).toContain('"title": "string"');
      expect(skill).toContain('"body": "string"');
      expect(skill).toContain('"base": "string"');
      expect(skill).toContain('"files":');
      expect(skill).toContain('"path": "string"');
      expect(skill).toContain('"content": "string"');
    });

    it('should mark base as optional', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('base');
      expect(skill).toContain('(optional)');
      expect(skill).toContain("Defaults to repository's default branch");
    });

    it('should show unlimited constraint when no max specified', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum PRs: unlimited');
    });

    it('should show max constraint when specified', () => {
      const config = { max: 2 };
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Maximum PRs: 2');
    });

    it('should include sign commits constraint when enabled', () => {
      const config = { sign: true };
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Commits must be signed');
    });

    it('should not include sign commits constraint when disabled', () => {
      const config = { sign: false };
      const skill = handler.generateSkill(config);

      expect(skill).not.toContain('Commits must be signed');
    });

    it('should include example with files array', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('"branch":');
      expect(skill).toContain('"files":');
      expect(skill).toContain('src/validator.ts');
    });

    it('should include multiple PR file naming pattern', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('create-pr-1.json');
      expect(skill).toContain('create-pr-2.json');
    });

    it('should include important notes', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Important');
      expect(skill).toContain('Use the Write tool');
      expect(skill).toContain('complete file content');
    });
  });

  describe('generateValidationScript', () => {
    it('should generate validation script', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('find /tmp/outputs -name "create-pr*.json"');
      expect(script).toContain('jq empty');
    });

    it('should validate branch is required', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('branch is required');
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

    it('should validate files is an array', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('files field must be an array');
    });

    it('should validate files array is non-empty', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('files array cannot be empty');
    });

    it('should validate branch name format', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('branch name contains invalid characters');
      expect(script).toContain('[a-zA-Z0-9/_.-]');
    });

    it('should default to max 10 PRs', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('MAX_PRS=10');
    });

    it('should use custom max when specified', () => {
      const config = { max: 3 };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('MAX_PRS=3');
    });

    it('should configure git identity', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('git config user.name');
      expect(script).toContain('git config user.email');
    });

    it('should check for existing PR on branch', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh pr view');
      expect(script).toContain('PR already exists');
    });

    it('should create and checkout new branch', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('git checkout -b');
    });

    it('should create files using jq', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('mkdir -p');
      expect(script).toContain('jq -r ".files[$i].content"');
    });

    it('should commit changes with title as message', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('git commit -m');
    });

    it('should sign commits when enabled', () => {
      const config = { sign: true };
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('git commit -S');
    });

    it('should push branch to remote', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('git push origin');
    });

    it('should create PR using gh cli', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh pr create');
      expect(script).toContain('--title');
      expect(script).toContain('--body');
      expect(script).toContain('--base');
      expect(script).toContain('--head');
    });
  });
});
