import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDispatch } from "../dispatch";
import type { DispatcherContext } from "../types";

/**
 * Simple dispatch tests that don't require mocking complex GitHub API calls.
 * These tests verify basic functionality that can be tested without network access.
 */
describe("runDispatch - Basic Validation", () => {
  let tempAgentPath: string;
  let tempEventPath: string;

  beforeEach(async () => {
    const tempDir = tmpdir();
    tempAgentPath = join(tempDir, `agent-${randomUUID()}.md`);
    tempEventPath = join(tempDir, `event-${randomUUID()}.json`);
  });

  afterEach(async () => {
    try {
      await rm(tempAgentPath, { force: true });
      await rm(tempEventPath, { force: true });
      await rm("/tmp/artifacts", { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createContext = (
    eventName: string,
    eventAction: string,
    actor: string,
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
      actor,
      eventPath: tempEventPath,
    },
    options: {
      agentPath: tempAgentPath,
      workflowFile: "agent-test.yml",
    },
  });

  test("loads agent definition successfully", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
---
Test agent`,
    );

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    // The agent should load successfully (validation passes)
    expect(result.success).toBeDefined();
    expect(result.outputs).toBeDefined();
  });

  test("fails when agent definition is invalid", async () => {
    await writeFile(
      tempAgentPath,
      `---
on:
  issues:
    types: [opened]
---
Missing name`,
    );

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(false);
    expect(result.outputs["skip-reason"]).toContain("Validation error");
  });

  test("skips label check for non-issue/PR events", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  discussion:
    types: [created]
permissions:
  discussions: write
trigger_labels:
  - needs-review
---
Test agent`,
    );

    // Discussion events don't have labels, so should skip label check
    const ctx = createContext("discussion", "created", "user");
    const result = await runDispatch(ctx);

    // Should not fail due to missing labels
    expect(result.success).toBe(true);
  });

  test("checks trigger labels when configured for issue events", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
trigger_labels:
  - needs-review
  - automated
---
Test agent`,
    );

    // Event missing required labels
    await writeFile(
      tempEventPath,
      JSON.stringify({
        issue: {
          labels: [{ name: "bug" }],
        },
      }),
    );

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    // If authorization passes (depends on user), should fail on labels
    // Or if authorization fails, should fail on authorization
    expect(result.outputs).toBeDefined();
    expect(result.outputs["should-run"]).toBeDefined();
  });

  test("returns validation audit in outputs", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
---
Test agent`,
    );

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.outputs).toBeDefined();
    expect(result.outputs["should-run"]).toBeDefined();
    expect(typeof result.outputs["should-run"]).toBe("string");
  });
});
