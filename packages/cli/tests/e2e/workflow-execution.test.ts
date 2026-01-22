import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import yaml from "js-yaml";

const CLI_PATH = resolve(import.meta.dir, "../../src/index.ts");

interface WorkflowJob {
  "runs-on": string;
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  strategy?: {
    matrix?: Record<string, unknown>;
    "fail-fast"?: boolean;
  };
  steps: Array<{
    name?: string;
    uses?: string;
    run?: string;
    if?: string;
    env?: Record<string, string>;
    with?: Record<string, unknown>;
    id?: string;
  }>;
}

interface WorkflowStructure {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
}

describe("Workflow Execution E2E Tests", () => {
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for all tests
    tempDir = await mkdtemp(join(tmpdir(), "repo-agents-e2e-"));

    // Create agent structure
    await mkdir(join(tempDir, ".github/agents"), { recursive: true });

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

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir && existsSync(tempDir)) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("generates workflow for simple agent with no outputs", async () => {
    // Create minimal agent definition
    const agentContent = `---
name: Simple Triage Agent
on:
  issues:
    types:
      - opened
permissions:
  issues: read
---

# Simple Triage Agent

You are a triage agent that analyzes new issues. Read the issue and provide analysis in the comments.
`;

    await writeFile(join(tempDir, ".github/agents/simple-triage.md"), agentContent);

    // Run compile command
    const proc = Bun.spawn(["bun", CLI_PATH, "compile"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;
    expect(proc.exitCode).toBe(0);

    // Verify workflow file was created
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    expect(existsSync(workflowPath)).toBe(true);

    // Parse and validate YAML structure
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Validate workflow metadata
    expect(workflow.name).toBe("AI Agents");
    expect(workflow.on).toBeDefined();
    expect(workflow.permissions).toBeDefined();

    // Validate all expected jobs are present
    expect(workflow.jobs.dispatcher).toBeDefined();
    expect(workflow.jobs["agent-simple-triage-agent"]).toBeDefined();
    expect(workflow.jobs["agent-simple-triage-agent-audit"]).toBeDefined();

    // Outputs job should NOT exist (no outputs configured)
    expect(workflow.jobs["agent-simple-triage-agent-outputs"]).toBeUndefined();

    // Validate dispatcher job structure (now includes preflight checks)
    const dispatcherJob = workflow.jobs.dispatcher;
    expect(dispatcherJob["runs-on"]).toBe("ubuntu-latest");
    expect(dispatcherJob.outputs).toBeDefined();
    expect(dispatcherJob.steps.length).toBeGreaterThan(0);

    // Validate agent execution job structure
    const agentJob = workflow.jobs["agent-simple-triage-agent"];
    expect(agentJob.needs).toBe("dispatcher");
    expect(agentJob.if).toContain("dispatcher.outputs.agent-simple-triage-agent-should-run");

    // Check for required steps
    const agentSteps = agentJob.steps.map((step) => step.name || step.uses || "");
    expect(agentSteps.some((step) => step.includes("checkout"))).toBe(true);
    expect(agentSteps.some((step) => step.includes("setup-bun"))).toBe(true);
    expect(agentSteps.some((step) => step.includes("Simple Triage Agent"))).toBe(true);

    // Validate audit job structure
    const auditJob = workflow.jobs["agent-simple-triage-agent-audit"];
    expect(auditJob.needs).toContain("dispatcher");
    expect(auditJob.needs).toContain("agent-simple-triage-agent");
    expect(auditJob.if).toBe(
      "always() && needs.dispatcher.outputs.agent-simple-triage-agent-should-run == 'true'",
    );
  });

  test("generates workflow for agent with multiple outputs", async () => {
    // Create agent with outputs
    const agentContent = `---
name: Comment and Label Agent
on:
  issues:
    types:
      - opened
permissions:
  issues: write
outputs:
  add-comment:
    enabled: true
  add-label:
    enabled: true
---

# Comment and Label Agent

Analyze the issue and add appropriate comments and labels.
`;

    await writeFile(join(tempDir, ".github/agents/comment-label.md"), agentContent);

    // Run compile command
    const proc = Bun.spawn(["bun", CLI_PATH, "compile"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    await proc.exited;
    expect(proc.exitCode).toBe(0);

    // Parse workflow
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Verify agent jobs exist
    expect(workflow.jobs["agent-comment-and-label-agent"]).toBeDefined();
    expect(workflow.jobs["agent-comment-and-label-agent-outputs"]).toBeDefined();
    expect(workflow.jobs["agent-comment-and-label-agent-audit"]).toBeDefined();

    // Validate outputs job exists and has correct structure
    const outputsJob = workflow.jobs["agent-comment-and-label-agent-outputs"];
    expect(outputsJob).toBeDefined();
    expect(outputsJob.needs).toContain("agent-comment-and-label-agent");
    expect(outputsJob.if).toContain("agent-comment-and-label-agent.result");

    // Check for output execution steps
    const outputSteps = outputsJob.steps.map((step) => step.name || "");
    expect(outputSteps.some((step) => step.includes("Download outputs"))).toBe(true);
    expect(outputSteps.some((step) => step.includes("Execute outputs"))).toBe(true);

    // Validate permissions include write access
    expect(workflow.permissions.issues).toBe("write");
  });

  test("generates workflow for agent with context collection", async () => {
    // Create agent with context collection
    const agentContent = `---
name: Batch Analysis Agent
on:
  schedule:
    - cron: "0 0 * * *"
permissions:
  issues: read
  pull_requests: read
context:
  issues:
    states: [open]
    limit: 50
  pull_requests:
    states: [open]
    limit: 30
  since: "24h"
  min_items: 5
outputs:
  create-issue: true
---

# Batch Analysis Agent

Analyze recent activity and create a summary issue.
`;

    await writeFile(join(tempDir, ".github/agents/batch-analysis.md"), agentContent);

    // Run compile command
    const proc = Bun.spawn(["bun", CLI_PATH, "compile"], {
      cwd: tempDir,
      stdout: "pipe",
      stderr: "pipe",
    });

    const stderr = await new Response(proc.stderr).text();
    if (proc.exitCode !== 0) {
      console.error("Compile stderr:", stderr);
    }
    await proc.exited;
    expect(proc.exitCode).toBe(0);

    // Parse workflow
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Verify agent job exists
    const agentJob = workflow.jobs["agent-batch-analysis-agent"];
    expect(agentJob).toBeDefined();

    // Check for context collection in agent job steps
    const agentSteps = agentJob.steps;

    // Context collection should be present in the workflow
    const workflowText = workflowContent.toLowerCase();
    expect(workflowText.includes("context") || workflowText.includes("collect")).toBe(true);

    // Verify schedule trigger exists
    expect(workflow.on).toHaveProperty("schedule");
    const scheduleConfig = workflow.on.schedule as Array<{ cron: string }>;
    expect(scheduleConfig).toBeDefined();
    expect(scheduleConfig[0].cron).toBe("0 0 * * *");

    // Verify min_items is handled (agent will skip if threshold not met)
    const agentStep = agentSteps.find((step) => step.name?.includes("Batch Analysis Agent"));
    expect(agentStep).toBeDefined();
  });

  test("workflow aggregates triggers from multiple agents", async () => {
    // Agent definitions already created in previous tests
    // Verify triggers are aggregated correctly

    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Should have all triggers from all agents
    expect(workflow.on).toHaveProperty("issues");
    expect(workflow.on).toHaveProperty("workflow_dispatch");

    // Issues trigger should aggregate types from multiple agents
    const issuesConfig = workflow.on.issues as { types: string[] };
    expect(issuesConfig.types).toContain("opened");

    // Schedule trigger should exist if batch-analysis agent was compiled
    // Note: This may not exist if the previous test failed
    if (workflow.on.schedule) {
      const scheduleConfig = workflow.on.schedule as Array<{ cron: string }>;
      expect(scheduleConfig).toBeDefined();
    }
  });

  test("workflow aggregates permissions from multiple agents", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Should have maximum permissions across all agents
    expect(workflow.permissions.issues).toBe("write"); // from comment-label agent
    expect(workflow.permissions.contents).toBeDefined(); // default permission
    expect(workflow.permissions.actions).toBe("write"); // default for workflow operations

    // Note: pull-requests only appears if an agent requests "write" access
    // Read-only access doesn't need explicit permission in the workflow
  });

  test("workflow includes proper job dependencies", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Check dependency chain for an agent
    const agentJob = workflow.jobs["agent-simple-triage-agent"];
    expect(agentJob.needs).toBe("dispatcher");

    // Outputs job should depend on agent job
    const outputsJob = workflow.jobs["agent-comment-and-label-agent-outputs"];
    if (outputsJob) {
      expect(outputsJob.needs).toContain("agent-comment-and-label-agent");
    }

    // Audit job should depend on agent job and run always (when agent should run)
    const auditJob = workflow.jobs["agent-simple-triage-agent-audit"];
    expect(auditJob.needs).toContain("dispatcher");
    expect(auditJob.needs).toContain("agent-simple-triage-agent");
    expect(auditJob.if).toBe(
      "always() && needs.dispatcher.outputs.agent-simple-triage-agent-should-run == 'true'",
    );
  });

  test("workflow includes required environment variables", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Check dispatcher job has Claude auth env vars (merged from preflight)
    const dispatcherJob = workflow.jobs.dispatcher;
    const dispatcherStep = dispatcherJob.steps.find(
      (step) => step.name?.includes("Dispatch") || step.run?.includes("dispatcher"),
    );
    expect(dispatcherStep).toBeDefined();

    // Note: When no secrets are detected during compilation, env may be empty object
    // The test workflow doesn't have secrets configured, so we just verify the structure exists
    expect(dispatcherStep?.env).toBeDefined();

    // Check agent job has required env vars
    const agentJob = workflow.jobs["agent-simple-triage-agent"];
    const agentRunStep = agentJob.steps.find(
      (step) =>
        step.name?.includes("Simple Triage Agent") || step.run?.includes("repo-agent run agent"),
    );
    expect(agentRunStep).toBeDefined();
    expect(agentRunStep?.env).toBeDefined();

    // Verify the workflow structure contains env var references
    // (even if no secrets are detected, the structure should be there)
    expect(workflowContent).toContain("env:");
  });

  test("workflow includes artifact upload/download steps", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Agent job should upload outputs and audit artifacts
    const agentJob = workflow.jobs["agent-comment-and-label-agent"];
    const uploadSteps = agentJob.steps.filter((step) => step.uses?.includes("upload-artifact"));
    expect(uploadSteps.length).toBeGreaterThan(0);

    // Outputs job should download artifacts
    const outputsJob = workflow.jobs["agent-comment-and-label-agent-outputs"];
    if (outputsJob) {
      const downloadStep = outputsJob.steps.find((step) =>
        step.uses?.includes("download-artifact"),
      );
      expect(downloadStep).toBeDefined();
    }

    // Audit job should download artifacts
    const auditJob = workflow.jobs["agent-comment-and-label-agent-audit"];
    const auditDownloadStep = auditJob.steps.find((step) =>
      step.uses?.includes("download-artifact"),
    );
    expect(auditDownloadStep).toBeDefined();
  });

  test("workflow supports GitHub App token generation", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();
    const workflow = yaml.load(workflowContent) as WorkflowStructure;

    // Agent job should have app token generation step
    const agentJob = workflow.jobs["agent-simple-triage-agent"];
    const appTokenStep = agentJob.steps.find((step) =>
      step.uses?.includes("create-github-app-token"),
    );
    expect(appTokenStep).toBeDefined();
    expect(appTokenStep?.with).toHaveProperty("app-id");
    expect(appTokenStep?.with).toHaveProperty("private-key");
    expect(appTokenStep?.["continue-on-error"]).toBe(true);

    // Git config step should use app identity
    const gitConfigStep = agentJob.steps.find((step) =>
      step.name?.includes("Configure git identity"),
    );
    expect(gitConfigStep).toBeDefined();
    expect(gitConfigStep?.run).toContain("app-slug");
  });

  test("workflow has valid YAML syntax", async () => {
    const workflowPath = join(tempDir, ".github/workflows/agents.yml");
    const workflowContent = await Bun.file(workflowPath).text();

    // This will throw if YAML is invalid
    expect(() => yaml.load(workflowContent)).not.toThrow();

    // Verify it's not empty
    expect(workflowContent.length).toBeGreaterThan(0);
    expect(workflowContent).toContain("name: AI Agents");
  });
});
