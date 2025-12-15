import { validateCommand } from './validate';
import { agentParser } from '../../parser';
import { fileExists, findMarkdownFiles } from '../utils/files';
import type { ValidationError } from '../../types';

// Mock dependencies
jest.mock('../utils/files');
jest.mock('../../parser');
jest.mock('ora', () => {
  return () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
  });
});

const mockFileExists = fileExists as jest.MockedFunction<typeof fileExists>;
const mockFindMarkdownFiles = findMarkdownFiles as jest.MockedFunction<typeof findMarkdownFiles>;
const mockParseFile = agentParser.parseFile as jest.MockedFunction<typeof agentParser.parseFile>;
const mockValidateAgent = agentParser.validateAgent as jest.MockedFunction<
  typeof agentParser.validateAgent
>;

describe('validateCommand', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit: ${code}`);
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('single file validation', () => {
    it('should validate a valid agent file', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test Agent',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand('test.md', {});

      expect(mockFileExists).toHaveBeenCalledWith('test.md');
      expect(mockParseFile).toHaveBeenCalledWith('test.md');
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail when file does not exist', async () => {
      mockFileExists.mockResolvedValue(false);

      await expect(validateCommand('missing.md', {})).rejects.toThrow('process.exit: 0');

      expect(mockFileExists).toHaveBeenCalledWith('missing.md');
      expect(mockParseFile).not.toHaveBeenCalled();
    });

    it('should fail when parsing fails', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: undefined,
        errors: [{ field: 'name', message: 'Missing name', severity: 'error' }],
      });

      await expect(validateCommand('invalid.md', {})).rejects.toThrow('process.exit: 0');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should fail when validation errors exist', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: { 'update-file': true },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValue([
        {
          field: 'outputs',
          message: 'update-file requires allowed-paths',
          severity: 'error',
        },
      ]);

      await expect(validateCommand('error.md', {})).rejects.toThrow('process.exit: 0');
    });

    it('should succeed with warnings in normal mode', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [{ field: 'markdown', message: 'Empty body', severity: 'warning' }],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand('warning.md', {});

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail with warnings in strict mode', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [{ field: 'markdown', message: 'Empty body', severity: 'warning' }],
      });
      mockValidateAgent.mockReturnValue([]);

      await expect(validateCommand('warning.md', { strict: true })).rejects.toThrow(
        'process.exit: 0'
      );
    });
  });

  describe('bulk validation (--all)', () => {
    it('should validate all files in agents directory', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['agent1.md', 'agent2.md']);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand(undefined, { all: true });

      expect(mockFindMarkdownFiles).toHaveBeenCalled();
      expect(mockParseFile).toHaveBeenCalledTimes(2);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should fail if agents directory does not exist', async () => {
      mockFileExists.mockResolvedValue(false);

      await expect(validateCommand(undefined, { all: true })).rejects.toThrow('process.exit: 1');

      expect(mockFindMarkdownFiles).not.toHaveBeenCalled();
    });

    it('should warn if no agent files found', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue([]);

      await validateCommand(undefined, { all: true });

      expect(processExitSpy).not.toHaveBeenCalled();
    });

    it('should exit with error if any file has errors', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['good.md', 'bad.md']);

      // First file is valid
      mockParseFile.mockResolvedValueOnce({
        agent: {
          name: 'Good',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValueOnce([]);

      // Second file has errors
      mockParseFile.mockResolvedValueOnce({
        agent: undefined,
        errors: [{ field: 'name', message: 'Missing', severity: 'error' }],
      });

      await expect(validateCommand(undefined, { all: true })).rejects.toThrow('process.exit: 1');

      expect(mockParseFile).toHaveBeenCalledTimes(2);
    });

    it('should print summary after validating all files', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['test1.md', 'test2.md']);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand(undefined, { all: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation Summary')
      );
    });
  });

  describe('error handling', () => {
    it('should require either file or --all flag', async () => {
      await expect(validateCommand(undefined, {})).rejects.toThrow('process.exit: 1');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle file system errors gracefully', async () => {
      mockFileExists.mockRejectedValue(new Error('File system error'));

      await expect(validateCommand('test.md', {})).rejects.toThrow();
    });

    it('should display error messages for invalid files', async () => {
      mockFileExists.mockResolvedValue(true);
      mockParseFile.mockResolvedValue({
        agent: undefined,
        errors: [
          { field: 'name', message: 'Name is required', severity: 'error' },
          { field: 'on', message: 'At least one trigger required', severity: 'error' },
        ],
      });

      await expect(validateCommand('bad.md', {})).rejects.toThrow('process.exit: 0');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Name is required'));
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('At least one trigger required')
      );
    });
  });

  describe('strict mode', () => {
    it('should treat warnings as errors in strict mode', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['test.md']);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [{ field: 'test', message: 'Some warning', severity: 'warning' }],
      });
      mockValidateAgent.mockReturnValue([]);

      await expect(validateCommand(undefined, { all: true, strict: true })).rejects.toThrow(
        'process.exit: 1'
      );
    });

    it('should show strict mode message in summary', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['test.md']);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [{ field: 'test', message: 'Warning', severity: 'warning' }],
      });
      mockValidateAgent.mockReturnValue([]);

      await expect(validateCommand(undefined, { all: true, strict: true })).rejects.toThrow(
        'process.exit: 1'
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Strict mode enabled')
      );
    });
  });

  describe('validation summary', () => {
    it('should show count of valid files', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['test1.md', 'test2.md']);
      mockParseFile.mockResolvedValue({
        agent: {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'test',
        },
        errors: [],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand(undefined, { all: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Valid: 2'));
    });

    it('should show count of invalid files', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['good.md', 'bad.md']);

      mockParseFile.mockResolvedValueOnce({
        agent: { name: 'Good', on: { issues: { types: ['opened'] } }, markdown: 'test' },
        errors: [],
      });
      mockValidateAgent.mockReturnValueOnce([]);

      mockParseFile.mockResolvedValueOnce({
        agent: undefined,
        errors: [{ field: 'name', message: 'Missing', severity: 'error' }],
      });

      await expect(validateCommand(undefined, { all: true })).rejects.toThrow('process.exit: 1');

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid: 1'));
    });

    it('should show count of files with warnings', async () => {
      mockFileExists.mockResolvedValue(true);
      mockFindMarkdownFiles.mockResolvedValue(['test.md']);
      mockParseFile.mockResolvedValue({
        agent: { name: 'Test', on: { issues: { types: ['opened'] } }, markdown: 'test' },
        errors: [{ field: 'test', message: 'Warning', severity: 'warning' }],
      });
      mockValidateAgent.mockReturnValue([]);

      await validateCommand(undefined, { all: true });

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('With warnings: 1'));
    });
  });
});

