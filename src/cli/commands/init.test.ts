import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initCommand } from './init';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

describe('initCommand', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await mkdtemp(join(tmpdir(), 'gh-claude-test-'));
    
    // Initialize git repo
    execSync('git init', { cwd: testDir, stdio: 'ignore' });
    execSync('git remote add origin https://github.com/test/repo.git', {
      cwd: testDir,
      stdio: 'ignore',
    });
    
    // Change to test directory
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('should create directory structure', async () => {
    await initCommand({ examples: false });

    const githubDir = join(testDir, '.github');
    const agentsDir = join(githubDir, 'claude-agents');
    const workflowsDir = join(githubDir, 'workflows');

    await expect(access(githubDir)).resolves.toBeUndefined();
    await expect(access(agentsDir)).resolves.toBeUndefined();
    await expect(access(workflowsDir)).resolves.toBeUndefined();
  });

  it('should create configuration file', async () => {
    await initCommand({ examples: false });

    const configFile = join(testDir, '.github', 'claude.yml');
    await expect(access(configFile)).resolves.toBeUndefined();

    const content = await readFile(configFile, 'utf-8');
    expect(content).toContain('claude:');
    expect(content).toContain('model:');
  });

  it('should create example agents when examples option is true', async () => {
    await initCommand({ examples: true });

    const issueTriageFile = join(testDir, '.github', 'claude-agents', 'issue-triage.md');
    const prReviewFile = join(testDir, '.github', 'claude-agents', 'pr-review.md');

    await expect(access(issueTriageFile)).resolves.toBeUndefined();
    await expect(access(prReviewFile)).resolves.toBeUndefined();

    const issueContent = await readFile(issueTriageFile, 'utf-8');
    expect(issueContent).toContain('name: Issue Triage');
  });

  it('should not create examples when examples option is false', async () => {
    await initCommand({ examples: false });

    const issueTriageFile = join(testDir, '.github', 'claude-agents', 'issue-triage.md');
    
    await expect(access(issueTriageFile)).rejects.toThrow();
  });

  it('should not overwrite existing config without force flag', async () => {
    // Run init twice
    await initCommand({ examples: false });
    
    const configFile = join(testDir, '.github', 'claude.yml');
    const originalContent = await readFile(configFile, 'utf-8');
    
    // Modify config
    await Bun.write(configFile, '# Modified content');
    
    // Run init again without force
    await initCommand({ examples: false, force: false });
    
    const newContent = await readFile(configFile, 'utf-8');
    expect(newContent).toBe('# Modified content');
  });

  it('should overwrite existing config with force flag', async () => {
    await initCommand({ examples: false });
    
    const configFile = join(testDir, '.github', 'claude.yml');
    await Bun.write(configFile, '# Modified content');
    
    // Run init again with force
    await initCommand({ examples: false, force: true });
    
    const newContent = await readFile(configFile, 'utf-8');
    expect(newContent).toContain('claude:');
    expect(newContent).not.toBe('# Modified content');
  });

  it('should exit with error if not in git repository', async () => {
    const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-'));
    process.chdir(nonGitDir);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand({ examples: false })).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    await rm(nonGitDir, { recursive: true, force: true });
  });
});

