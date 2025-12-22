import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { compileCommand } from './compile';
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('compileCommand', () => {
  let testDir: string;
  let agentsDir: string;
  let workflowsDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'gh-claude-compile-test-'));
    agentsDir = join(testDir, '.github', 'claude-agents');
    workflowsDir = join(testDir, '.github', 'workflows');

    await mkdir(agentsDir, { recursive: true });
    await mkdir(workflowsDir, { recursive: true });

    process.chdir(testDir);
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  const validAgentContent = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
---

# Test Agent

This is a test agent.`;

  it('should compile a single valid agent file', async () => {
    const agentFile = join(agentsDir, 'test-agent.md');
    await writeFile(agentFile, validAgentContent);

    await compileCommand(agentFile, { dryRun: false });

    const workflowFile = join(workflowsDir, 'claude-test-agent.yml');
    await expect(access(workflowFile)).resolves.toBeUndefined();

    const content = await readFile(workflowFile, 'utf-8');
    expect(content).toContain('name: Test Agent');
    expect(content).toContain('issues:');
  });

  it('should compile all agents with --all flag', async () => {
    const agent1File = join(agentsDir, 'agent1.md');
    const agent2File = join(agentsDir, 'agent2.md');

    const agent1Content = validAgentContent.replace('Test Agent', 'Agent 1');
    const agent2Content = validAgentContent.replace('Test Agent', 'Agent 2');

    await writeFile(agent1File, agent1Content);
    await writeFile(agent2File, agent2Content);

    await compileCommand(undefined, { all: true, dryRun: false });

    const workflow1 = join(workflowsDir, 'claude-agent-1.yml');
    const workflow2 = join(workflowsDir, 'claude-agent-2.yml');

    await expect(access(workflow1)).resolves.toBeUndefined();
    await expect(access(workflow2)).resolves.toBeUndefined();
  });

  it('should not write files in dry-run mode', async () => {
    const agentFile = join(agentsDir, 'test-agent.md');
    await writeFile(agentFile, validAgentContent);

    await compileCommand(agentFile, { dryRun: true });

    const workflowFile = join(workflowsDir, 'claude-test-agent.yml');
    await expect(access(workflowFile)).rejects.toThrow();
  });

  it('should handle missing agent file', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const nonExistentFile = join(agentsDir, 'missing.md');

    // Should not throw but handle gracefully
    await compileCommand(nonExistentFile, { dryRun: false });

    exitSpy.mockRestore();
  });

  it('should handle invalid agent frontmatter', async () => {
    const invalidContent = `---
name: Invalid Agent
# Missing 'on' field
---

# Content`;

    const agentFile = join(agentsDir, 'invalid.md');
    await writeFile(agentFile, invalidContent);

    // Should handle validation errors gracefully
    await compileCommand(agentFile, { dryRun: false });

    // Workflow should not be created
    const workflowFile = join(workflowsDir, 'claude-invalid-agent.yml');
    await expect(access(workflowFile)).rejects.toThrow();
  });

  it('should use custom output directory when specified', async () => {
    const customOutputDir = join(testDir, 'custom-workflows');
    await mkdir(customOutputDir, { recursive: true });

    const agentFile = join(agentsDir, 'test-agent.md');
    await writeFile(agentFile, validAgentContent);

    await compileCommand(agentFile, {
      dryRun: false,
      outputDir: customOutputDir,
    });

    const workflowFile = join(customOutputDir, 'claude-test-agent.yml');
    await expect(access(workflowFile)).resolves.toBeUndefined();
  });

  it('should exit with error when no file specified and no --all flag', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(compileCommand(undefined, { dryRun: false })).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});

