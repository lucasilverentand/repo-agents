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
      GH_APP_ID: process.env.GH_APP_ID,
      GH_APP_PRIVATE_KEY: process.env.GH_APP_PRIVATE_KEY,
      GH_TOKEN: process.env.GH_TOKEN,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      FALLBACK_TOKEN: process.env.FALLBACK_TOKEN,
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
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    delete process.env.FALLBACK_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
    expect(result.outputs["app-token"]).toBe("test-token");
  });

  test("succeeds when CLAUDE_CODE_OAUTH_TOKEN is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "test-token";

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

  test("uses GITHUB_TOKEN as fallback when no app configured", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "fallback-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["app-token"]).toBe("fallback-token");
    expect(result.outputs["git-user"]).toBe("github-actions[bot]");
    expect(result.outputs["git-email"]).toBe("github-actions[bot]@users.noreply.github.com");
  });

  test("prefers FALLBACK_TOKEN over GITHUB_TOKEN", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.FALLBACK_TOKEN = "preferred-token";
    process.env.GITHUB_TOKEN = "fallback-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["app-token"]).toBe("preferred-token");
  });

  test("returns default git user when no app configured", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["git-user"]).toBe("github-actions[bot]");
    expect(result.outputs["git-email"]).toBe("github-actions[bot]@users.noreply.github.com");
  });

  test("validates both app ID and private key are present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.GH_APP_ID = "123456";
    delete process.env.GH_APP_PRIVATE_KEY; // Missing private key
    delete process.env.FALLBACK_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    // Should fall back to GITHUB_TOKEN
    expect(result.success).toBe(true);
    expect(result.outputs["app-token"]).toBe("test-token");
  });

  test("handles missing GITHUB_TOKEN gracefully", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.FALLBACK_TOKEN;

    const ctx = createContext();
    const result = await runGlobalPreflight(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["app-token"]).toBe("");
  });

  // Note: Testing actual GitHub App JWT generation and API calls would require mocking
  // fetch() and is better suited for integration tests
});
