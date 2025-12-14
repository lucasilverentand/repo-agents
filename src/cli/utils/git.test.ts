import { isGitRepository, hasGitHubRemote, getGitHubRepo, hasGitHubDirectory } from './git';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Mock child_process
jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

describe('git utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isGitRepository', () => {
    it('should return true when git rev-parse succeeds', () => {
      mockExecSync.mockReturnValue(Buffer.from('.git'));

      const result = isGitRepository('/path/to/repo');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', {
        cwd: '/path/to/repo',
        stdio: 'ignore',
      });
    });

    it('should return false when git rev-parse fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = isGitRepository('/path/to/non-repo');

      expect(result).toBe(false);
    });

    it('should use current working directory by default', () => {
      mockExecSync.mockReturnValue(Buffer.from('.git'));

      isGitRepository();

      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse --git-dir', {
        cwd: process.cwd(),
        stdio: 'ignore',
      });
    });
  });

  describe('hasGitHubRemote', () => {
    it('should return true for HTTPS GitHub remote', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/owner/repo.git'));

      const result = hasGitHubRemote('/path/to/repo');

      expect(result).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url origin', {
        cwd: '/path/to/repo',
        encoding: 'utf-8',
      });
    });

    it('should return true for SSH GitHub remote', () => {
      mockExecSync.mockReturnValue(Buffer.from('git@github.com:owner/repo.git'));

      const result = hasGitHubRemote('/path/to/repo');

      expect(result).toBe(true);
    });

    it('should return false for non-GitHub remote', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://gitlab.com/owner/repo.git'));

      const result = hasGitHubRemote('/path/to/repo');

      expect(result).toBe(false);
    });

    it('should return false when no remote exists', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No remote found');
      });

      const result = hasGitHubRemote('/path/to/repo');

      expect(result).toBe(false);
    });

    it('should use current working directory by default', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/owner/repo.git'));

      hasGitHubRemote();

      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url origin', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
    });
  });

  describe('getGitHubRepo', () => {
    it('should extract owner and repo from HTTPS URL', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/octocat/hello-world.git\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
      });
    });

    it('should extract owner and repo from HTTPS URL without .git', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/octocat/hello-world\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
      });
    });

    it('should extract owner and repo from SSH URL', () => {
      mockExecSync.mockReturnValue(Buffer.from('git@github.com:octocat/hello-world.git\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
      });
    });

    it('should extract owner and repo from SSH URL without .git', () => {
      mockExecSync.mockReturnValue(Buffer.from('git@github.com:octocat/hello-world\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toEqual({
        owner: 'octocat',
        repo: 'hello-world',
      });
    });

    it('should handle repos with hyphens and underscores', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/my-org/my_repo-name.git\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toEqual({
        owner: 'my-org',
        repo: 'my_repo-name',
      });
    });

    it('should return null for non-GitHub URL', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://gitlab.com/owner/repo.git\n'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toBeNull();
    });

    it('should return null when no remote exists', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('No remote found');
      });

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toBeNull();
    });

    it('should return null for malformed URL', () => {
      mockExecSync.mockReturnValue(Buffer.from('invalid-url'));

      const result = getGitHubRepo('/path/to/repo');

      expect(result).toBeNull();
    });

    it('should use current working directory by default', () => {
      mockExecSync.mockReturnValue(Buffer.from('https://github.com/owner/repo.git'));

      getGitHubRepo();

      expect(mockExecSync).toHaveBeenCalledWith('git remote get-url origin', {
        cwd: process.cwd(),
        encoding: 'utf-8',
      });
    });
  });

  describe('hasGitHubDirectory', () => {
    it('should return true when .github directory exists', () => {
      mockExistsSync.mockReturnValue(true);

      const result = hasGitHubDirectory('/path/to/repo');

      expect(result).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/path/to/repo/.github');
    });

    it('should return false when .github directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      const result = hasGitHubDirectory('/path/to/repo');

      expect(result).toBe(false);
    });

    it('should use current working directory by default', () => {
      mockExistsSync.mockReturnValue(true);

      hasGitHubDirectory();

      expect(mockExistsSync).toHaveBeenCalledWith(process.cwd() + '/.github');
    });
  });

  describe('integration scenarios', () => {
    it('should validate a complete GitHub repository setup', () => {
      // Mock a valid GitHub repository
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd === 'git rev-parse --git-dir') {
          return Buffer.from('.git');
        }
        if (cmd === 'git remote get-url origin') {
          return Buffer.from('https://github.com/owner/repo.git');
        }
        return Buffer.from('');
      });
      mockExistsSync.mockReturnValue(true);

      const cwd = '/path/to/repo';

      expect(isGitRepository(cwd)).toBe(true);
      expect(hasGitHubRemote(cwd)).toBe(true);
      expect(getGitHubRepo(cwd)).toEqual({ owner: 'owner', repo: 'repo' });
      expect(hasGitHubDirectory(cwd)).toBe(true);
    });

    it('should detect invalid repository setup', () => {
      // Mock an invalid setup
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });
      mockExistsSync.mockReturnValue(false);

      const cwd = '/path/to/non-repo';

      expect(isGitRepository(cwd)).toBe(false);
      expect(hasGitHubRemote(cwd)).toBe(false);
      expect(getGitHubRepo(cwd)).toBeNull();
      expect(hasGitHubDirectory(cwd)).toBe(false);
    });
  });
});

