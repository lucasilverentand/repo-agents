import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runGlobalPreflight } from "../global-preflight";
import type { DispatcherContext } from "../types";

describe("runGlobalPreflight", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      GH_TOKEN: process.env.GH_TOKEN,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    };
  });

  afterEach(() => {
    // Restore original environment
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const createContext = (): DispatcherContext => ({
    github: {
      repository: "test/repo",
      runId: "123456",
      runAttempt: "1",
      serverUrl: "https://github.com",
      eventName: "issues",
      eventAction: "opened",
      ref: "refs/heads/main",
      sha: "abc123",
      actor: "testuser",
      eventPath: "/tmp/event.json",
    },
  });

  test("succeeds when ANTHROPIC_API_KEY is present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("succeeds when CLAUDE_CODE_OAUTH_TOKEN is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("fails when neither Claude auth is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(false);
    expect(result.outputs["should-continue"]).toBe("false");
  });

  test("succeeds when both auth methods are present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });
});
