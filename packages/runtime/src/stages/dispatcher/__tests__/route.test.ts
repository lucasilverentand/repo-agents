import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRoute } from "../route";
import type { DispatcherContext } from "../types";

describe("runRoute", () => {
  const createTestContext = (
    eventName: string,
    eventAction: string,
    agentsDir?: string,
  ): DispatcherContext => ({
    github: {
      repository: "test/repo",
      runId: "123456",
      runAttempt: "1",
      serverUrl: "https://github.com",
      eventName,
      eventAction,
      ref: "refs/heads/main",
      sha: "abc123",
      actor: "testuser",
      eventPath: "/tmp/event.json",
    },
    options: {
      agentsDir,
    },
  });

  test("discovers agents from filesystem", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    // Create test agent
    await writeFile(
      join(tempDir, "test-agent.md"),
      `---
name: test-agent
on:
  issues:
    types: [opened]
---
Test agent`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    expect(result.success).toBe(true);
    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("test-agent");
  });

  test("matches issue event to correct agent", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "issue-agent.md"),
      `---
name: issue-agent
on:
  issues:
    types: [opened, labeled]
---
Issue agent`,
    );

    await writeFile(
      join(tempDir, "pr-agent.md"),
      `---
name: pr-agent
on:
  pull_request:
    types: [opened]
---
PR agent`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("issue-agent");
  });

  test("matches pull request event to correct agent", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "pr-agent.md"),
      `---
name: pr-agent
on:
  pull_request:
    types: [opened, synchronize]
---
PR agent`,
    );

    const ctx = createTestContext("pull_request", "synchronize", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("pr-agent");
  });

  test("matches multiple agents for same event", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "agent1.md"),
      `---
name: agent1
on:
  issues:
    types: [opened]
---
Agent 1`,
    );

    await writeFile(
      join(tempDir, "agent2.md"),
      `---
name: agent2
on:
  issues:
    types: [opened, closed]
---
Agent 2`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(2);
    expect(matchingAgents.map((a: { agentName: string }) => a.agentName).sort()).toEqual([
      "agent1",
      "agent2",
    ]);
  });

  test("returns empty array when no agents match", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "pr-agent.md"),
      `---
name: pr-agent
on:
  pull_request:
    types: [opened]
---
PR agent`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(0);
  });

  test("handles workflow_dispatch with specific agent", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "agent1.md"),
      `---
name: agent1
on:
  workflow_dispatch: {}
---
Agent 1`,
    );

    await writeFile(
      join(tempDir, "agent2.md"),
      `---
name: agent2
on:
  workflow_dispatch: {}
---
Agent 2`,
    );

    // Set env var for specific agent selection
    process.env.WORKFLOW_DISPATCH_AGENT = "agent1";

    const ctx = createTestContext("workflow_dispatch", "", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("agent1");

    delete process.env.WORKFLOW_DISPATCH_AGENT;
  });

  test("handles discussion events", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "discussion-agent.md"),
      `---
name: discussion-agent
on:
  discussion:
    types: [created, answered]
---
Discussion agent`,
    );

    const ctx = createTestContext("discussion", "created", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("discussion-agent");
  });

  test("generates correct workflow filenames", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "my-custom-agent.md"),
      `---
name: my-custom-agent
on:
  issues:
    types: [opened]
---
Custom agent`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents[0].workflowFile).toBe("agent-my-custom-agent.yml");
  });

  test("skips invalid agent files", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    // Invalid agent (missing name)
    await writeFile(
      join(tempDir, "invalid.md"),
      `---
on:
  issues:
    types: [opened]
---
Invalid`,
    );

    // Valid agent
    await writeFile(
      join(tempDir, "valid.md"),
      `---
name: valid
on:
  issues:
    types: [opened]
---
Valid`,
    );

    const ctx = createTestContext("issues", "opened", tempDir);
    const result = await runRoute(ctx);

    const matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
    expect(matchingAgents[0].agentName).toBe("valid");
  });

  test("handles multi-trigger agents", async () => {
    const tempDir = join(tmpdir(), `test-agents-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    await writeFile(
      join(tempDir, "multi-trigger.md"),
      `---
name: multi-trigger
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]
  discussion:
    types: [created]
---
Multi-trigger agent`,
    );

    // Test with issue event
    let ctx = createTestContext("issues", "opened", tempDir);
    let result = await runRoute(ctx);
    let matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);

    // Test with PR event
    ctx = createTestContext("pull_request", "opened", tempDir);
    result = await runRoute(ctx);
    matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);

    // Test with discussion event
    ctx = createTestContext("discussion", "created", tempDir);
    result = await runRoute(ctx);
    matchingAgents = JSON.parse(result.outputs["matching-agents"] ?? "[]");
    expect(matchingAgents).toHaveLength(1);
  });
});
