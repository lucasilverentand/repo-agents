import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { StageContext } from "../types";
import { runSetup } from "./setup";

describe("runSetup", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
      GH_APP_ID: process.env.GH_APP_ID,
      GH_APP_PRIVATE_KEY: process.env.GH_APP_PRIVATE_KEY,
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

  const createContext = (): StageContext => ({
    repository: "test/repo",
    runId: "123456",
    actor: "testuser",
    eventName: "issues",
    eventPath: "/tmp/event.json",
    agentPath: ".github/agents/test.md",
  });

  test("succeeds when ANTHROPIC_API_KEY is present", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("succeeds when CLAUDE_CODE_OAUTH_TOKEN is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("fails when neither Claude auth is present", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(false);
    expect(result.outputs["should-continue"]).toBe("false");
  });

  test("uses GITHUB_TOKEN as fallback when no app configured", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "fallback-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("succeeds regardless of token configuration", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.FALLBACK_TOKEN = "preferred-token";
    process.env.GITHUB_TOKEN = "fallback-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("succeeds when no app configured", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("succeeds when app ID present but private key missing", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.GH_APP_ID = "123456";
    delete process.env.GH_APP_PRIVATE_KEY; // Missing private key
    delete process.env.FALLBACK_TOKEN;
    process.env.GITHUB_TOKEN = "test-token";

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });

  test("handles missing GITHUB_TOKEN gracefully", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    delete process.env.GH_APP_ID;
    delete process.env.GH_APP_PRIVATE_KEY;
    delete process.env.GITHUB_TOKEN;
    delete process.env.FALLBACK_TOKEN;

    const ctx = createContext();
    const result = await runSetup(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-continue"]).toBe("true");
  });
});
