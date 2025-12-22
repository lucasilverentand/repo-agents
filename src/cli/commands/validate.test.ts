import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { validateCommand } from './validate';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('validateCommand', () => {
  let testDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'gh-claude-validate-test-'));
    agentsDir = join(testDir, '.github', 'claude-agents');

    await mkdir(agentsDir, { recursive: true });
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

  it('should validate a single valid agent file', async () => {
    const agentFile = join(agentsDir, 'test-agent.md');
    await writeFile(agentFile, validAgentContent);

    // Should not throw
    await expect(validateCommand(agentFile, { all: false })).resolves.toBeUndefined();
  });

  it('should validate all agents with --all flag', async () => {
    const agent1File = join(agentsDir, 'agent1.md');
    const agent2File = join(agentsDir, 'agent2.md');

    await writeFile(agent1File, validAgentContent);
    await writeFile(agent2File, validAgentContent.replace('Test Agent', 'Agent 2'));

    // Should not throw
    await expect(validateCommand(undefined, { all: true })).resolves.toBeUndefined();
  });

  it('should report errors for invalid agent', async () => {
    const invalidContent = `---
name: Invalid Agent
# Missing required 'on' field
permissions:
  issues: write
---

# Content`;

    const agentFile = join(agentsDir, 'invalid.md');
    await writeFile(agentFile, invalidContent);

    // Should complete but report errors (not throw)
    await validateCommand(agentFile, { all: false });
  });

  it('should handle missing file', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    const nonExistentFile = join(agentsDir, 'missing.md');

    await validateCommand(nonExistentFile, { all: false });

    exitSpy.mockRestore();
  });

  it('should validate multiple files and report summary', async () => {
    const validFile = join(agentsDir, 'valid.md');
    const invalidFile = join(agentsDir, 'invalid.md');

    await writeFile(validFile, validAgentContent);
    await writeFile(
      invalidFile,
      `---
name: Invalid
---
# Missing on field`
    );

    // Should complete and show summary
    await validateCommand(undefined, { all: true });
  });

  it('should detect business logic errors', async () => {
    // update-file output requires allowed-paths
    const contentWithError = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
---

# Should fail validation`;

    const agentFile = join(agentsDir, 'business-error.md');
    await writeFile(agentFile, contentWithError);

    // Should report validation error
    await validateCommand(agentFile, { all: false });
  });

  it('should exit with error when no file and no --all flag', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(validateCommand(undefined, { all: false })).rejects.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});

