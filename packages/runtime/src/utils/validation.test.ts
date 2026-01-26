import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDefinition } from "@repo-agents/types";
import {
  checkBotActor,
  checkSkipLabels,
  checkTriggerLabels,
  type ValidationContext,
} from "./validation";

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

describe("checkTriggerLabels", () => {
  let tempDir: string;
  let eventPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "trigger-labels-test-"));
    eventPath = join(tempDir, "event.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createContext = (eventName: string, eventPathOverride?: string): ValidationContext => ({
    github: {
      actor: "octocat",
      repository: "owner/repo",
      eventName,
      eventPath: eventPathOverride ?? eventPath,
      runId: 12345,
      serverUrl: "https://github.com",
    },
  });

  const createAgent = (triggerLabels?: string[]): AgentDefinition => ({
    name: "test-agent",
    on: { issues: { types: ["opened", "labeled"] } },
    trigger_labels: triggerLabels,
    markdown: "# Test Agent",
  });

  describe("no trigger_labels configured", () => {
    it("should always be valid when no trigger_labels specified", async () => {
      const ctx = createContext("issues");
      const agent = createAgent(undefined);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should always be valid with empty trigger_labels array", async () => {
      const ctx = createContext("issues");
      const agent = createAgent([]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("OR logic for trigger_labels", () => {
    it("should be valid when first trigger label is present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "approved" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved", "agent-assigned"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should be valid when second trigger label is present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "agent-assigned" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved", "agent-assigned"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should be valid when both trigger labels are present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "approved" }, { name: "agent-assigned" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved", "agent-assigned"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should be invalid when no trigger labels are present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "bug" }, { name: "enhancement" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved", "agent-assigned"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("approved");
      expect(result.reason).toContain("agent-assigned");
    });

    it("should be invalid when issue has no labels at all", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(false);
    });
  });

  describe("non-issue events", () => {
    it("should always be valid for pull_request events", async () => {
      const ctx = createContext("pull_request");
      const agent = createAgent(["approved"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should always be valid for schedule events", async () => {
      const ctx = createContext("schedule");
      const agent = createAgent(["approved"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should always be valid for workflow_dispatch events", async () => {
      const ctx = createContext("workflow_dispatch");
      const agent = createAgent(["approved"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("returns present labels for debugging", () => {
    it("should include presentLabels in result", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "bug" }, { name: "approved" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["approved"]);

      const result = await checkTriggerLabels(ctx, agent);

      expect(result.valid).toBe(true);
      expect(result.presentLabels).toContain("bug");
      expect(result.presentLabels).toContain("approved");
    });
  });
});

describe("checkSkipLabels", () => {
  let tempDir: string;
  let eventPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "skip-labels-test-"));
    eventPath = join(tempDir, "event.json");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const createContext = (eventName: string, eventPathOverride?: string): ValidationContext => ({
    github: {
      actor: "octocat",
      repository: "owner/repo",
      eventName,
      eventPath: eventPathOverride ?? eventPath,
      runId: 12345,
      serverUrl: "https://github.com",
    },
  });

  const createAgent = (skipLabels?: string[]): AgentDefinition => ({
    name: "test-agent",
    on: { issues: { types: ["opened", "labeled"] } },
    skip_labels: skipLabels,
    markdown: "# Test Agent",
  });

  describe("no skip_labels configured", () => {
    it("should always be valid when no skip_labels specified", async () => {
      const ctx = createContext("issues");
      const agent = createAgent(undefined);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should always be valid with empty skip_labels array", async () => {
      const ctx = createContext("issues");
      const agent = createAgent([]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("OR logic for skip_labels (any match skips)", () => {
    it("should be invalid when first skip label is present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "agent-failure" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure", "wontfix"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("agent-failure");
      expect(result.matchedLabels).toContain("agent-failure");
    });

    it("should be invalid when second skip label is present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "wontfix" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure", "wontfix"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("wontfix");
      expect(result.matchedLabels).toContain("wontfix");
    });

    it("should be invalid when both skip labels are present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "agent-failure" }, { name: "wontfix" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure", "wontfix"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.matchedLabels).toContain("agent-failure");
      expect(result.matchedLabels).toContain("wontfix");
    });

    it("should be valid when no skip labels are present", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "bug" }, { name: "enhancement" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure", "wontfix"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should be valid when issue has no labels at all", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("pull_request events", () => {
    it("should check labels on pull_request events", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          pull_request: { labels: [{ name: "agent-failure" }] },
        }),
      );

      const ctx = createContext("pull_request");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.matchedLabels).toContain("agent-failure");
    });

    it("should be valid when pull_request has no skip labels", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          pull_request: { labels: [{ name: "ready" }] },
        }),
      );

      const ctx = createContext("pull_request");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("non-label events", () => {
    it("should always be valid for schedule events", async () => {
      const ctx = createContext("schedule");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });

    it("should always be valid for workflow_dispatch events", async () => {
      const ctx = createContext("workflow_dispatch");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(true);
    });
  });

  describe("returns labels for debugging", () => {
    it("should include presentLabels in result", async () => {
      await writeFile(
        eventPath,
        JSON.stringify({
          issue: { labels: [{ name: "bug" }, { name: "agent-failure" }] },
        }),
      );

      const ctx = createContext("issues");
      const agent = createAgent(["agent-failure"]);

      const result = await checkSkipLabels(ctx, agent);

      expect(result.valid).toBe(false);
      expect(result.presentLabels).toContain("bug");
      expect(result.presentLabels).toContain("agent-failure");
      expect(result.matchedLabels).toContain("agent-failure");
      expect(result.matchedLabels).not.toContain("bug");
    });
  });
});

describe("Deduplication utilities", () => {
  const {
    parseTimeWindow,
    initDeduplicationState,
    cleanupDeduplicationState,
    createDeduplicationRecord,
    checkEventDeduplication,
    checkActionDeduplication,
  } = require("./validation");

  describe("parseTimeWindow", () => {
    it("should parse hours correctly", () => {
      expect(parseTimeWindow("1h")).toBe(60 * 60 * 1000);
      expect(parseTimeWindow("24h")).toBe(24 * 60 * 60 * 1000);
    });

    it("should parse days correctly", () => {
      expect(parseTimeWindow("1d")).toBe(24 * 60 * 60 * 1000);
      expect(parseTimeWindow("7d")).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should parse weeks correctly", () => {
      expect(parseTimeWindow("1w")).toBe(7 * 24 * 60 * 60 * 1000);
      expect(parseTimeWindow("2w")).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it("should parse months correctly", () => {
      expect(parseTimeWindow("1m")).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it("should return default for invalid format", () => {
      expect(parseTimeWindow("invalid")).toBe(24 * 60 * 60 * 1000);
      expect(parseTimeWindow("")).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("initDeduplicationState", () => {
    it("should create empty state with current timestamp", () => {
      const state = initDeduplicationState();
      expect(state.schema_version).toBe("1.0.0");
      expect(state.records).toEqual([]);
      expect(state.last_cleanup).toBeDefined();
    });
  });

  describe("cleanupDeduplicationState", () => {
    it("should remove old records", () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

      const state = {
        schema_version: "1.0.0" as const,
        records: [
          { key: "old", timestamp: oldDate, agent_name: "test" },
          { key: "recent", timestamp: recentDate, agent_name: "test" },
        ],
        last_cleanup: oldDate,
      };

      const cleaned = cleanupDeduplicationState(state);
      expect(cleaned.records).toHaveLength(1);
      expect(cleaned.records[0].key).toBe("recent");
    });

    it("should update last_cleanup timestamp", () => {
      const state = {
        schema_version: "1.0.0" as const,
        records: [],
        last_cleanup: "2020-01-01T00:00:00.000Z",
      };

      const cleaned = cleanupDeduplicationState(state);
      expect(new Date(cleaned.last_cleanup).getTime()).toBeGreaterThan(
        new Date("2020-01-01").getTime(),
      );
    });
  });

  describe("createDeduplicationRecord", () => {
    it("should create a record with all fields", () => {
      const agent = { name: "test-agent", on: {}, markdown: "" };
      const record = createDeduplicationRecord(agent, "test-key", {
        actionType: "add-comment",
        eventType: "issues",
        issueNumber: 123,
        details: { body: "test" },
      });

      expect(record.key).toBe("test-key");
      expect(record.agent_name).toBe("test-agent");
      expect(record.action_type).toBe("add-comment");
      expect(record.event_type).toBe("issues");
      expect(record.issue_number).toBe(123);
      expect(record.details).toEqual({ body: "test" });
      expect(record.timestamp).toBeDefined();
    });
  });

  describe("checkEventDeduplication", () => {
    let eventPath: string;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "dedup-test-"));
      eventPath = join(tempDir, "event.json");
      await writeFile(eventPath, JSON.stringify({ issue: { number: 123 }, action: "opened" }));
    });

    afterEach(async () => {
      await rm(tempDir, { recursive: true });
    });

    it("should allow when deduplication not configured", async () => {
      const ctx = {
        github: {
          actor: "testuser",
          repository: "owner/repo",
          eventName: "issues",
          eventPath,
          runId: 12345,
          serverUrl: "https://github.com",
        },
      };
      const agent = { name: "test", on: {}, markdown: "" };

      const result = await checkEventDeduplication(ctx, agent, null);
      expect(result.allowed).toBe(true);
    });

    it("should allow when deduplication explicitly disabled", async () => {
      const ctx = {
        github: {
          actor: "testuser",
          repository: "owner/repo",
          eventName: "issues",
          eventPath,
          runId: 12345,
          serverUrl: "https://github.com",
        },
      };
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { events: { enabled: false } },
      };

      const result = await checkEventDeduplication(ctx, agent, null);
      expect(result.allowed).toBe(true);
    });

    it("should allow first occurrence of an event", async () => {
      const ctx = {
        github: {
          actor: "testuser",
          repository: "owner/repo",
          eventName: "issues",
          eventPath,
          runId: 12345,
          serverUrl: "https://github.com",
        },
      };
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { events: { enabled: true, window: "1h" } },
      };

      const result = await checkEventDeduplication(ctx, agent, initDeduplicationState());
      expect(result.allowed).toBe(true);
      expect(result.key).toBeDefined();
    });

    it("should block duplicate event within window", async () => {
      const ctx = {
        github: {
          actor: "testuser",
          repository: "owner/repo",
          eventName: "issues",
          eventPath,
          runId: 12345,
          serverUrl: "https://github.com",
        },
      };
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { events: { enabled: true, window: "1h" } },
      };

      const state = {
        schema_version: "1.0.0" as const,
        records: [
          {
            key: "test:event:issues:issue:123:action:opened",
            timestamp: new Date().toISOString(),
            agent_name: "test",
            event_type: "issues",
          },
        ],
        last_cleanup: new Date().toISOString(),
      };

      const result = await checkEventDeduplication(ctx, agent, state);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already processed");
    });
  });

  describe("checkActionDeduplication", () => {
    it("should allow when deduplication not configured", async () => {
      const agent = { name: "test", on: {}, markdown: "" };
      const result = await checkActionDeduplication(agent, "add-comment", { body: "test" }, null);
      expect(result.allowed).toBe(true);
    });

    it("should allow first occurrence of an action", async () => {
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { actions: { enabled: true, window: "24h" } },
      };
      const result = await checkActionDeduplication(
        agent,
        "add-comment",
        { body: "test" },
        initDeduplicationState(),
      );
      expect(result.allowed).toBe(true);
    });

    it("should block duplicate exact action within window", async () => {
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { actions: { enabled: true, window: "24h", match: "exact" } },
      };
      const state = {
        schema_version: "1.0.0" as const,
        records: [
          {
            key: "test:action:add-comment",
            timestamp: new Date().toISOString(),
            agent_name: "test",
            action_type: "add-comment",
            details: { body: "test" },
          },
        ],
        last_cleanup: new Date().toISOString(),
      };

      const result = await checkActionDeduplication(agent, "add-comment", { body: "test" }, state);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("already performed");
    });

    it("should allow different action details with exact match", async () => {
      const agent = {
        name: "test",
        on: {},
        markdown: "",
        deduplication: { actions: { enabled: true, window: "24h", match: "exact" } },
      };
      const state = {
        schema_version: "1.0.0" as const,
        records: [
          {
            key: "test:action:add-comment",
            timestamp: new Date().toISOString(),
            agent_name: "test",
            action_type: "add-comment",
            details: { body: "different text" },
          },
        ],
        last_cleanup: new Date().toISOString(),
      };

      const result = await checkActionDeduplication(agent, "add-comment", { body: "test" }, state);
      expect(result.allowed).toBe(true);
    });
  });
});
