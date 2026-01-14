import { handler } from './update-file';
import type { RuntimeContext } from './base';

describe('UpdateFileHandler', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: undefined,
    prNumber: undefined,
    issueOrPrNumber: '',
  };

  const mockRuntimeWithPaths: RuntimeContext = {
    ...mockRuntime,
    allowedPaths: ['src/**/*.ts', 'docs/**/*.md'],
  };

  describe('handler properties', () => {
    it('should have correct name', () => {
      expect(handler.name).toBe('update-file');
    });
  });

  describe('getContextScript', () => {
    it('should return null when no allowed paths specified', () => {
      const result = handler.getContextScript(mockRuntime);
      expect(result).toBeNull();
    });

    it('should return null when allowed paths is empty array', () => {
      const runtime = { ...mockRuntime, allowedPaths: [] };
      const result = handler.getContextScript(runtime);
      expect(result).toBeNull();
    });

    it('should return allowed paths context when paths specified', () => {
      const result = handler.getContextScript(mockRuntimeWithPaths);
      expect(result).not.toBeNull();
      expect(result).toContain('Allowed File Paths');
      expect(result).toContain('src/**/*.ts');
      expect(result).toContain('docs/**/*.md');
    });

    it('should include warning about path restrictions', () => {
      const result = handler.getContextScript(mockRuntimeWithPaths);
      expect(result).toContain('Attempts to modify files outside these patterns will fail');
    });
  });

  describe('generateSkill', () => {
    it('should generate skill documentation', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('## Skill: Update Files');
      expect(skill).toContain('/tmp/outputs/update-file.json');
    });

    it('should include JSON schema with all fields', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('JSON Schema');
      expect(skill).toContain('"files":');
      expect(skill).toContain('"path": "string"');
      expect(skill).toContain('"content": "string"');
      expect(skill).toContain('"message": "string"');
      expect(skill).toContain('"branch": "string"');
    });

    it('should mark branch as optional', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('branch');
      expect(skill).toContain('(optional)');
      expect(skill).toContain("Defaults to repository's default branch");
    });

    it('should include constraint about allowed patterns', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('File paths must match allowed patterns');
      expect(skill).toContain('Allowed File Paths');
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

    it('should include example', () => {
      const config = {};
      const skill = handler.generateSkill(config);

      expect(skill).toContain('Example');
      expect(skill).toContain('"files":');
      expect(skill).toContain('"message":');
      expect(skill).toContain('src/config.ts');
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

      expect(script).toContain('if [ -f "/tmp/outputs/update-file.json" ]');
      expect(script).toContain('jq empty');
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

    it('should validate message is required', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('message is required');
    });

    it('should default branch to main', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('.branch // "main"');
    });

    it('should include allowed patterns in validation', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntimeWithPaths);

      expect(script).toContain('ALLOWED_PATTERNS');
      expect(script).toContain('src/**/*.ts');
      expect(script).toContain('docs/**/*.md');
    });

    it('should validate file paths against allowed patterns', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntimeWithPaths);

      expect(script).toContain('does not match allowed patterns');
      expect(script).toContain('MATCHED');
    });

    it('should use runtime context for repository', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('owner/repo');
    });

    it('should get current file SHA for updates', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('FILE_SHA');
      expect(script).toContain('gh api');
      expect(script).toContain('/contents/$FILE_PATH');
    });

    it('should handle both create and update cases', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('File exists - update it');
      expect(script).toContain("File doesn't exist - create it");
    });

    it('should base64 encode file content', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('base64');
    });

    it('should use GitHub Contents API with PUT', () => {
      const config = {};
      const script = handler.generateValidationScript(config, mockRuntime);

      expect(script).toContain('gh api');
      expect(script).toContain('-X PUT');
      expect(script).toContain('--input');
    });
  });
});
