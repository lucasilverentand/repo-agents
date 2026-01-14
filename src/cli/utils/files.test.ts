import { toKebabCase, agentNameToWorkflowName, findMarkdownFiles } from './files';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('files utils', () => {
  describe('toKebabCase', () => {
    it('should convert spaces to hyphens', () => {
      expect(toKebabCase('Hello World')).toBe('hello-world');
    });

    it('should convert to lowercase', () => {
      expect(toKebabCase('UPPERCASE')).toBe('uppercase');
    });

    it('should remove special characters', () => {
      expect(toKebabCase('Hello@World!')).toBe('helloworld');
    });

    it('should handle multiple spaces', () => {
      expect(toKebabCase('Hello   World')).toBe('hello-world');
    });

    it('should handle mixed case and spaces', () => {
      expect(toKebabCase('My Agent Name')).toBe('my-agent-name');
    });

    it('should handle already kebab-case', () => {
      expect(toKebabCase('already-kebab')).toBe('already-kebab');
    });
  });

  describe('agentNameToWorkflowName', () => {
    it('should prefix with agent-', () => {
      expect(agentNameToWorkflowName('Test Agent')).toBe('agent-test-agent');
    });

    it('should handle complex names', () => {
      expect(agentNameToWorkflowName('My Complex Agent Name')).toBe('agent-my-complex-agent-name');
    });

    it('should remove special characters', () => {
      expect(agentNameToWorkflowName('Test@Agent!')).toBe('agent-testagent');
    });
  });

  describe('findMarkdownFiles', () => {
    it('should find markdown files', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'repo-agents-test-'));
      writeFileSync(join(tempDir, 'file1.md'), 'test');
      writeFileSync(join(tempDir, 'file2.md'), 'test');
      writeFileSync(join(tempDir, 'file3.txt'), 'test');

      const files = await findMarkdownFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files[0]).toContain('file1.md');
      expect(files[1]).toContain('file2.md');
    });

    it('should return empty array for non-existent directory', async () => {
      const files = await findMarkdownFiles('/non/existent/path');
      expect(files).toEqual([]);
    });

    it('should return sorted files', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'repo-agents-test-'));
      writeFileSync(join(tempDir, 'zebra.md'), 'test');
      writeFileSync(join(tempDir, 'alpha.md'), 'test');

      const files = await findMarkdownFiles(tempDir);

      expect(files[0]).toContain('alpha.md');
      expect(files[1]).toContain('zebra.md');
    });
  });
});
