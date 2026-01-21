import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dir, "../../src/index.ts");
const PROJECT_ROOT = resolve(import.meta.dir, "../../../..");
const EXAMPLE_AGENT = join(PROJECT_ROOT, ".github/agents/issue-lifecycle/issue-analyzer.md");

describe("Compile Command", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), "repo-agents-test-"));

    // Create agent structure
    await mkdir(join(tempDir, ".github/agents/issue-lifecycle"), {
      recursive: true,
    });

    // Copy example agent
    await cp(EXAMPLE_AGENT, join(tempDir, ".github/agents/issue-lifecycle/issue-analyzer.md"));

    // Initialize git repo (required for repo-agents)
    const initGit = Bun.spawn(["git", "init"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await initGit.exited;

    // Add remote (required for some features)
    const addRemote = Bun.spawn(
      ["git", "remote", "add", "origin", "https://github.com/test/test-repo.git"],
      {
        cwd: tempDir,
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    await addRemote.exited;
  });

  afterEach(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("compile with dry-run shows what would be generated", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, "compile", "--dry-run"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    await proc.exited;

    expect(proc.exitCode).toBe(0);
    expect(output).toContain("AI Agents");
    expect(output).toContain("global-preflight");
    expect(output).toContain("dispatcher");

    // Should not create actual files in dry-run
    const workflowsDir = join(tempDir, ".github/workflows");
    expect(existsSync(workflowsDir)).toBe(false);
  });

  test("compile generates unified workflow file", async () => {
    const proc = Bun.spawn(["bun", CLI_PATH, "compile"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    expect(proc.exitCode).toBe(0);

    // Check unified workflow was created
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    expect(existsSync(workflowPath)).toBe(true);

    // Verify workflow contains expected content
    const workflowContent = await Bun.file(workflowPath).text();
    expect(workflowContent).toContain("name: AI Agents");
    expect(workflowContent).toContain("global-preflight:");
    expect(workflowContent).toContain("dispatcher:");
    expect(workflowContent).toContain("agent-issue-analyzer:");
    expect(workflowContent).toContain("agent-issue-analyzer-outputs:");
    expect(workflowContent).toContain("agent-issue-analyzer-audit:");
    expect(workflowContent).toContain("workflow_dispatch");
  });

  test("compile with custom output directory", async () => {
    const customDir = join(tempDir, "custom-workflows");

    const proc = Bun.spawn(["bun", CLI_PATH, "compile", "--output-dir", customDir], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;

    expect(proc.exitCode).toBe(0);

    // Check unified workflow was created in custom directory
    const workflowPath = join(customDir, "agents.yml");
    expect(existsSync(workflowPath)).toBe(true);
  });
});
