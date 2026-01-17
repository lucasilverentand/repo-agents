import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StageContext } from "../types.js";
import { runContext } from "./context";

// Mock the ghApi function to avoid actual GitHub API calls
const mockGhApi = mock(() => Promise.resolve({}));
mock.module("../utils", () => ({
  ghApi: mockGhApi,
  parseRepository: (repo: string) => {
    const [owner, name] = repo.split("/");
    return { owner, repo: name };
  },
}));

// Create a minimal valid agent definition for testing
const createAgentMd = (options: { context?: Record<string, unknown> } = {}) => {
  const contextSection = options.context
    ? `context:
${Object.entries(options.context)
  .map(([key, value]) => {
    if (typeof value === "object" && value !== null) {
      const nested = Object.entries(value)
        .map(([k, v]) => `      ${k}: ${JSON.stringify(v)}`)
        .join("\n");
      return `  ${key}:\n${nested}`;
    }
    return `  ${key}: ${JSON.stringify(value)}`;
  })
  .join("\n")}`
    : "";

  return `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
${contextSection}
---

You are a test agent that processes collected context.
`;
};

describe("runContext", () => {
  const testDir = "/tmp/repo-agents-context-test";
  const agentPath = path.join(testDir, "test-agent.md");

  beforeEach(async () => {
    // Create test directory
    await mkdir(testDir, { recursive: true });

    // Clean up any previous test artifacts
    if (existsSync("/tmp/context")) {
      await rm("/tmp/context", { recursive: true, force: true });
    }

    // Reset mock
    mockGhApi.mockReset();
  });

  afterEach(async () => {
    // Clean up test directory
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe("agent file parsing", () => {
    it("should return error when agent file does not exist", async () => {
      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath: "/nonexistent/path/agent.md",
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs["has-context"]).toBe("false");
      expect(result.outputs["total-items"]).toBe("0");
    });

    it("should skip when no context is configured", async () => {
      await writeFile(agentPath, createAgentMd());

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("false");
      expect(result.skipReason).toBe("No context configuration in agent definition");
    });
  });

  describe("time filter calculation", () => {
    it("should parse hour duration format", async () => {
      // Create agent with context config
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "12h"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      // Mock API responses
      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      // Should succeed but find no items
      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("false");
    });

    it("should parse day duration format", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "7d"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
    });
  });

  describe("issues collection", () => {
    it("should collect issues and format as markdown", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Test Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [{ name: "bug" }],
          assignees: [],
          body: "Issue body",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve(mockIssues);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("true");
      expect(result.outputs["total-items"]).toBe("1");

      // Verify context file was created
      expect(existsSync("/tmp/context/collected.md")).toBe(true);

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("## Issues");
      expect(content).toContain("Test Issue");
      expect(content).toContain("@testuser");
    });

    it("should filter issues by labels", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  issues:
    labels:
      - bug
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Bug Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [{ name: "bug" }],
          assignees: [],
          body: "Bug body",
        },
        {
          number: 2,
          title: "Feature Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [{ name: "feature" }],
          assignees: [],
          body: "Feature body",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve(mockIssues);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["total-items"]).toBe("1");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Bug Issue");
      expect(content).not.toContain("Feature Issue");
    });

    it("should exclude issues by labels", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  issues:
    exclude_labels:
      - wontfix
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Valid Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [{ name: "bug" }],
          assignees: [],
          body: "Valid body",
        },
        {
          number: 2,
          title: "Wontfix Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [{ name: "wontfix" }],
          assignees: [],
          body: "Wontfix body",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve(mockIssues);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["total-items"]).toBe("1");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Valid Issue");
      expect(content).not.toContain("Wontfix Issue");
    });
  });

  describe("min_items threshold", () => {
    it("should skip execution when below min_items", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  min_items: 5
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Issue 1",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [],
          assignees: [],
          body: "Body",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve(mockIssues);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("false");
      expect(result.outputs["total-items"]).toBe("1");
      expect(result.skipReason).toContain("minimum is 5");
    });

    it("should proceed when at or above min_items", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  min_items: 2
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Issue 1",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [],
          assignees: [],
          body: "Body 1",
        },
        {
          number: 2,
          title: "Issue 2",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [],
          assignees: [],
          body: "Body 2",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve(mockIssues);
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("true");
      expect(result.outputs["total-items"]).toBe("2");
      expect(result.skipReason).toBeUndefined();
    });
  });

  describe("stars and forks collection", () => {
    it("should collect repository stars", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  stars: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "repos/owner/repo") {
          return Promise.resolve({ stargazers_count: 100, forks_count: 20 });
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("true");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Stars: 100");
    });

    it("should collect repository forks", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  forks: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "repos/owner/repo") {
          return Promise.resolve({ stargazers_count: 100, forks_count: 20 });
        }
        return Promise.resolve({});
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["has-context"]).toBe("true");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Forks: 20");
    });
  });

  describe("context file output", () => {
    it("should write context to /tmp/context/collected.md", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  stars: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation(() => {
        return Promise.resolve({ stargazers_count: 50, forks_count: 10 });
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(existsSync("/tmp/context/collected.md")).toBe(true);

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("# Collected Context");
      expect(content).toContain("*Collected at:");
      expect(content).toContain("*Since:");
      expect(content).toContain("*Total items:");
    });

    it("should include artifacts in result", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  stars: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation(() => {
        return Promise.resolve({ stargazers_count: 50, forks_count: 10 });
      });

      const ctx: StageContext = {
        repository: "owner/repo",
        runId: "12345",
        actor: "testuser",
        eventName: "schedule",
        eventPath: "",
        agentPath,
      };

      const result = await runContext(ctx);

      expect(result.success).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts).toHaveLength(1);
      expect(result.artifacts?.[0].name).toBe("context");
      expect(result.artifacts?.[0].path).toBe("/tmp/context/collected.md");
    });
  });
});
