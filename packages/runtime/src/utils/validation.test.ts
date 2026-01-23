import { describe, expect, it } from "bun:test";
import { checkBotActor, type ValidationContext } from "./validation";
import type { AgentDefinition } from "@repo-agents/types";

describe("checkBotActor", () => {
  const createContext = (actor: string): ValidationContext => ({
    github: {
      actor,
      repository: "owner/repo",
      eventName: "issues",
      eventPath: "/tmp/event.json",
      runId: 12345,
      serverUrl: "https://github.com",
    },
  });

  const createAgent = (allowBotTriggers?: boolean): AgentDefinition => ({
    name: "test-agent",
    on: { issues: { types: ["opened"] } },
    allow_bot_triggers: allowBotTriggers,
    markdown: "# Test Agent",
  });

  describe("blocks bot actors by default", () => {
    it("should block github-actions[bot]", async () => {
      const ctx = createContext("github-actions[bot]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
      expect(result.reason).toContain("github-actions[bot]");
      expect(result.reason).toContain("recursive loops");
    });

    it("should block dependabot[bot]", async () => {
      const ctx = createContext("dependabot[bot]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block renovate[bot]", async () => {
      const ctx = createContext("renovate[bot]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block github-actions actor", async () => {
      const ctx = createContext("github-actions");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block dependabot actor", async () => {
      const ctx = createContext("dependabot");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block renovate actor", async () => {
      const ctx = createContext("renovate");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block snyk-bot actor", async () => {
      const ctx = createContext("snyk-bot");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block any actor ending with [bot]", async () => {
      const ctx = createContext("my-custom-app[bot]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });
  });

  describe("allows human actors", () => {
    it("should allow regular user actors", async () => {
      const ctx = createContext("octocat");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(true);
      expect(result.isBot).toBe(false);
    });

    it("should allow user with 'bot' in username (but not [bot] suffix)", async () => {
      const ctx = createContext("robot-user");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(true);
      expect(result.isBot).toBe(false);
    });

    it("should be case-insensitive for pattern matching", async () => {
      const ctx = createContext("GITHUB-ACTIONS[BOT]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });
  });

  describe("allow_bot_triggers configuration", () => {
    it("should allow bots when allow_bot_triggers is true", async () => {
      const ctx = createContext("github-actions[bot]");
      const agent = createAgent(true);

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(true);
      expect(result.isBot).toBe(false);
    });

    it("should block bots when allow_bot_triggers is false", async () => {
      const ctx = createContext("github-actions[bot]");
      const agent = createAgent(false);

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });

    it("should block bots when allow_bot_triggers is undefined (default)", async () => {
      const ctx = createContext("github-actions[bot]");
      const agent = createAgent(undefined);

      const result = await checkBotActor(ctx, agent);

      expect(result.allowed).toBe(false);
      expect(result.isBot).toBe(true);
    });
  });

  describe("error message", () => {
    it("should suggest setting allow_bot_triggers in error message", async () => {
      const ctx = createContext("dependabot[bot]");
      const agent = createAgent();

      const result = await checkBotActor(ctx, agent);

      expect(result.reason).toContain("allow_bot_triggers: true");
    });
  });
});
