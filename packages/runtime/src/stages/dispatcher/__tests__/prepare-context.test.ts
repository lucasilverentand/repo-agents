import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrepareContext } from "../prepare-context";
import type { DispatchContext, DispatcherContext } from "../types";

describe("runPrepareContext", () => {
  let tempEventPath: string;
  let tempContextDir: string;

  beforeEach(async () => {
    tempEventPath = join(tmpdir(), `event-${randomUUID()}.json`);
    tempContextDir = "/tmp/dispatch-context";
    await mkdir(tempContextDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(tempEventPath, { force: true });
      await rm(tempContextDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createContext = (eventName: string, eventAction: string): DispatcherContext => ({
    github: {
      repository: "test/repo",
      runId: "123456",
      runAttempt: "1",
      serverUrl: "https://github.com",
      eventName,
      eventAction,
      ref: "refs/heads/main",
      sha: "abc123def456",
      actor: "testuser",
      eventPath: tempEventPath,
    },
  });

  test("extracts issue data from event payload", async () => {
    const eventPayload = {
      action: "opened",
      issue: {
        number: 42,
        title: "Test Issue",
        body: "Issue body content",
        state: "open",
        html_url: "https://github.com/test/repo/issues/42",
        user: { login: "issueauthor" },
        labels: [{ name: "bug" }, { name: "priority:high" }],
      },
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("issues", "opened");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["run-id"]).toBe("123456");

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.eventName).toBe("issues");
    expect(contextData.eventAction).toBe("opened");
    expect(contextData.issue).toBeDefined();
    expect(contextData.issue?.number).toBe(42);
    expect(contextData.issue?.title).toBe("Test Issue");
    expect(contextData.issue?.body).toBe("Issue body content");
    expect(contextData.issue?.author).toBe("issueauthor");
    expect(contextData.issue?.labels).toEqual(["bug", "priority:high"]);
    expect(contextData.issue?.state).toBe("open");
    expect(contextData.issue?.url).toBe("https://github.com/test/repo/issues/42");
  });

  test("extracts pull request data from event payload", async () => {
    const eventPayload = {
      action: "opened",
      pull_request: {
        number: 123,
        title: "Test PR",
        body: "PR description",
        state: "open",
        html_url: "https://github.com/test/repo/pull/123",
        user: { login: "prauthor" },
        labels: [{ name: "enhancement" }],
        base: { ref: "main" },
        head: { ref: "feature-branch" },
      },
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("pull_request", "opened");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.pullRequest).toBeDefined();
    expect(contextData.pullRequest?.number).toBe(123);
    expect(contextData.pullRequest?.title).toBe("Test PR");
    expect(contextData.pullRequest?.author).toBe("prauthor");
    expect(contextData.pullRequest?.baseBranch).toBe("main");
    expect(contextData.pullRequest?.headBranch).toBe("feature-branch");
    expect(contextData.pullRequest?.labels).toEqual(["enhancement"]);
  });

  test("extracts discussion data from event payload", async () => {
    const eventPayload = {
      action: "created",
      discussion: {
        number: 5,
        title: "Test Discussion",
        body: "Discussion content",
        html_url: "https://github.com/test/repo/discussions/5",
        user: { login: "discussionuser" },
        category: { name: "General" },
      },
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("discussion", "created");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.discussion).toBeDefined();
    expect(contextData.discussion?.number).toBe(5);
    expect(contextData.discussion?.title).toBe("Test Discussion");
    expect(contextData.discussion?.author).toBe("discussionuser");
    expect(contextData.discussion?.category).toBe("General");
  });

  test("extracts schedule data from event payload", async () => {
    const eventPayload = {
      schedule: "0 0 * * *",
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("schedule", "");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.schedule).toBeDefined();
    expect(contextData.schedule?.cron).toBe("0 0 * * *");
  });

  test("extracts repository_dispatch data from event payload", async () => {
    const eventPayload = {
      action: "custom-event",
      client_payload: {
        key1: "value1",
        key2: "value2",
      },
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("repository_dispatch", "custom-event");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.repositoryDispatch).toBeDefined();
    expect(contextData.repositoryDispatch?.eventType).toBe("custom-event");
    expect(contextData.repositoryDispatch?.clientPayload).toEqual({
      key1: "value1",
      key2: "value2",
    });
  });

  test("creates base context fields correctly", async () => {
    const eventPayload = { action: "opened", issue: {} };
    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("issues", "opened");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.dispatchId).toBe("123456-1");
    expect(contextData.dispatcherRunId).toBe("123456");
    expect(contextData.dispatcherRunUrl).toBe("https://github.com/test/repo/actions/runs/123456");
    expect(contextData.repository).toBe("test/repo");
    expect(contextData.ref).toBe("refs/heads/main");
    expect(contextData.sha).toBe("abc123def456");
    expect(contextData.actor).toBe("testuser");
    expect(contextData.dispatchedAt).toBeDefined();
  });

  test("handles missing optional fields gracefully", async () => {
    const eventPayload = {
      action: "opened",
      issue: {
        number: 1,
        title: "Minimal Issue",
        state: "open",
        html_url: "https://github.com/test/repo/issues/1",
        // Missing: body, user, labels
      },
    };

    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("issues", "opened");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextData = JSON.parse(await readFile(contextFile, "utf-8")) as DispatchContext;

    expect(contextData.issue?.number).toBe(1);
    expect(contextData.issue?.body).toBe("");
    expect(contextData.issue?.author).toBe("");
    expect(contextData.issue?.labels).toEqual([]);
  });

  test("handles invalid event path gracefully", async () => {
    const ctx = createContext("issues", "opened");
    ctx.github.eventPath = "/nonexistent/path.json";

    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(false);
    expect(result.outputs).toEqual({});
  });

  test("creates context directory if it doesn't exist", async () => {
    await rm(tempContextDir, { recursive: true, force: true });

    const eventPayload = { action: "opened", issue: {} };
    await writeFile(tempEventPath, JSON.stringify(eventPayload));

    const ctx = createContext("issues", "opened");
    const result = await runPrepareContext(ctx);

    expect(result.success).toBe(true);

    const contextFile = join(tempContextDir, "context.json");
    const contextExists = await readFile(contextFile, "utf-8");
    expect(contextExists).toBeDefined();
  });
});
