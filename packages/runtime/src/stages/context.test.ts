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

  describe("normalizeState edge cases", () => {
    it("should handle mixed states in pull requests", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    states:
      - open
      - closed
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "Open PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
    });

    it("should handle all state in issues", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  issues:
    states:
      - all
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
          labels: [],
          assignees: [],
          body: null,
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

    it("should filter issues by assignees", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  issues:
    assignees:
      - specificuser
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockIssues = [
        {
          number: 1,
          title: "Assigned Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/1",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [],
          assignees: [{ login: "specificuser" }],
          body: null,
        },
        {
          number: 2,
          title: "Unassigned Issue",
          state: "open",
          user: { login: "testuser" },
          html_url: "https://github.com/owner/repo/issues/2",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          labels: [],
          assignees: [],
          body: null,
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
      expect(content).toContain("Assigned Issue");
      expect(content).not.toContain("Unassigned Issue");
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

  describe("time filter calculation - last-run", () => {
    it("should use last successful workflow run timestamp", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "last-run"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const lastRunDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/actions/runs")) {
          return Promise.resolve({
            workflow_runs: [
              {
                status: "completed",
                conclusion: "success",
                created_at: lastRunDate.toISOString(),
              },
            ],
          });
        }
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
      expect(mockGhApi).toHaveBeenCalledWith(expect.stringContaining("/actions/runs"));
    });

    it("should default to 24h when last-run not found", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "last-run"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/actions/runs")) {
          return Promise.resolve({ workflow_runs: [] });
        }
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

    it("should handle errors fetching last run", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "last-run"
  issues:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/actions/runs")) {
          throw new Error("API error");
        }
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

    it("should handle invalid since format", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "invalid-format"
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

  describe("pull requests collection", () => {
    it("should collect pull requests and format as markdown", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "Test PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [{ name: "enhancement" }],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature-branch" },
          body: "PR description",
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("## Pull Requests");
      expect(content).toContain("Test PR");
      expect(content).toContain("feature-branch -> main");
    });

    it("should filter merged PRs", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    states:
      - merged
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "Merged PR",
          state: "closed",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: new Date().toISOString(),
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature" },
          body: null,
        },
        {
          number: 11,
          title: "Closed but not merged",
          state: "closed",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "other" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("Merged PR");
      expect(content).not.toContain("Closed but not merged");
    });

    it("should filter PRs by labels", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    labels:
      - enhancement
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "Enhancement PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [{ name: "enhancement" }],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature" },
          body: null,
        },
        {
          number: 11,
          title: "Bug Fix PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [{ name: "bug" }],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "bugfix" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("Enhancement PR");
      expect(content).not.toContain("Bug Fix PR");
    });

    it("should exclude PRs by labels", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    exclude_labels:
      - wip
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "Ready PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [{ name: "ready" }],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature" },
          body: null,
        },
        {
          number: 11,
          title: "WIP PR",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [{ name: "wip" }],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "wip-feature" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("Ready PR");
      expect(content).not.toContain("WIP PR");
    });

    it("should filter PRs by reviewers", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    reviewers:
      - reviewer1
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "PR with reviewer",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [{ login: "reviewer1" }],
          base: { ref: "main" },
          head: { ref: "feature" },
          body: null,
        },
        {
          number: 11,
          title: "PR without reviewer",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "other" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("PR with reviewer");
      expect(content).not.toContain("PR without reviewer");
    });

    it("should filter PRs by head branch", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    head_branch: "feature-x"
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "PR from feature-x",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature-x" },
          body: null,
        },
        {
          number: 11,
          title: "PR from feature-y",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "feature-y" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("PR from feature-x");
      expect(content).not.toContain("PR from feature-y");
    });

    it("should filter PRs by base branch", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  pull_requests:
    base_branch: "develop"
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const mockPRs = [
        {
          number: 10,
          title: "PR to develop",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/10",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "develop" },
          head: { ref: "feature" },
          body: null,
        },
        {
          number: 11,
          title: "PR to main",
          state: "open",
          user: { login: "contributor" },
          html_url: "https://github.com/owner/repo/pull/11",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          merged_at: null,
          labels: [],
          assignees: [],
          requested_reviewers: [],
          base: { ref: "main" },
          head: { ref: "other" },
          body: null,
        },
      ];

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve(mockPRs);
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
      expect(content).toContain("PR to develop");
      expect(content).not.toContain("PR to main");
    });
  });

  describe("discussions collection", () => {
    it("should collect discussions via GraphQL", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  discussions:
    limit: 10
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "graphql") {
          return Promise.resolve({
            data: {
              repository: {
                discussions: {
                  nodes: [
                    {
                      number: 5,
                      title: "Test Discussion",
                      author: { login: "user1" },
                      url: "https://github.com/owner/repo/discussions/5",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "General" },
                      answer: null,
                      labels: { nodes: [] },
                      body: "Discussion content",
                    },
                  ],
                },
              },
            },
          });
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
      expect(content).toContain("## Discussions");
      expect(content).toContain("Test Discussion");
      expect(content).toContain("Unanswered");
    });

    it("should filter unanswered discussions", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  discussions:
    unanswered: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "graphql") {
          return Promise.resolve({
            data: {
              repository: {
                discussions: {
                  nodes: [
                    {
                      number: 5,
                      title: "Answered Discussion",
                      author: { login: "user1" },
                      url: "https://github.com/owner/repo/discussions/5",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "Q&A" },
                      answer: { isAnswer: true },
                      labels: { nodes: [] },
                      body: "Question",
                    },
                    {
                      number: 6,
                      title: "Unanswered Discussion",
                      author: { login: "user2" },
                      url: "https://github.com/owner/repo/discussions/6",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "Q&A" },
                      answer: null,
                      labels: { nodes: [] },
                      body: "Question 2",
                    },
                  ],
                },
              },
            },
          });
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
      expect(content).not.toContain("Answered Discussion");
      expect(content).toContain("Unanswered Discussion");
    });

    it("should filter discussions by categories", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  discussions:
    categories:
      - "Q&A"
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "graphql") {
          return Promise.resolve({
            data: {
              repository: {
                discussions: {
                  nodes: [
                    {
                      number: 5,
                      title: "Q&A Discussion",
                      author: { login: "user1" },
                      url: "https://github.com/owner/repo/discussions/5",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "Q&A" },
                      answer: null,
                      labels: { nodes: [] },
                      body: "Question",
                    },
                    {
                      number: 6,
                      title: "General Discussion",
                      author: { login: "user2" },
                      url: "https://github.com/owner/repo/discussions/6",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "General" },
                      answer: null,
                      labels: { nodes: [] },
                      body: "General topic",
                    },
                  ],
                },
              },
            },
          });
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
      expect(content).toContain("Q&A Discussion");
      expect(content).not.toContain("General Discussion");
    });

    it("should filter answered discussions", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  discussions:
    answered: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "graphql") {
          return Promise.resolve({
            data: {
              repository: {
                discussions: {
                  nodes: [
                    {
                      number: 5,
                      title: "Answered Discussion",
                      author: { login: "user1" },
                      url: "https://github.com/owner/repo/discussions/5",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "Q&A" },
                      answer: { isAnswer: true },
                      labels: { nodes: [] },
                      body: "Question",
                    },
                    {
                      number: 6,
                      title: "Unanswered Discussion",
                      author: { login: "user2" },
                      url: "https://github.com/owner/repo/discussions/6",
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      category: { name: "Q&A" },
                      answer: null,
                      labels: { nodes: [] },
                      body: "Question 2",
                    },
                  ],
                },
              },
            },
          });
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
      expect(content).toContain("Answered Discussion");
      expect(content).not.toContain("Unanswered Discussion");
    });

    it("should handle discussions API errors gracefully", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  discussions:
    limit: 10
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint === "graphql") {
          throw new Error("GraphQL error");
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
    });
  });

  describe("commits collection", () => {
    it("should collect commits from configured branches", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  commits:
    branches:
      - main
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches/main")) {
          return Promise.resolve({ name: "main" });
        }
        if (endpoint.includes("/commits")) {
          return Promise.resolve([
            {
              sha: "abc123def456",
              commit: {
                message: "Fix bug in parser",
                author: {
                  name: "Developer",
                  date: new Date().toISOString(),
                },
              },
              html_url: "https://github.com/owner/repo/commit/abc123def456",
            },
          ]);
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
      expect(content).toContain("## Commits");
      expect(content).toContain("abc123d");
      expect(content).toContain("Fix bug in parser");
    });

    it("should filter commits by author", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  commits:
    branches:
      - main
    authors:
      - SpecificDev
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches/main")) {
          return Promise.resolve({ name: "main" });
        }
        if (endpoint.includes("/commits")) {
          return Promise.resolve([
            {
              sha: "abc123def456",
              commit: {
                message: "Commit by target author",
                author: {
                  name: "SpecificDev",
                  date: new Date().toISOString(),
                },
              },
              html_url: "https://github.com/owner/repo/commit/abc123def456",
            },
            {
              sha: "def456abc123",
              commit: {
                message: "Commit by other author",
                author: {
                  name: "OtherDev",
                  date: new Date().toISOString(),
                },
              },
              html_url: "https://github.com/owner/repo/commit/def456abc123",
            },
          ]);
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
      expect(content).toContain("Commit by target author");
      expect(content).not.toContain("Commit by other author");
    });

    it("should exclude commits by author", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  commits:
    branches:
      - main
    exclude_authors:
      - BotUser
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches/main")) {
          return Promise.resolve({ name: "main" });
        }
        if (endpoint.includes("/commits")) {
          return Promise.resolve([
            {
              sha: "abc123def456",
              commit: {
                message: "Human commit",
                author: {
                  name: "Developer",
                  date: new Date().toISOString(),
                },
              },
              html_url: "https://github.com/owner/repo/commit/abc123def456",
            },
            {
              sha: "def456abc123",
              commit: {
                message: "Bot commit",
                author: {
                  name: "BotUser",
                  date: new Date().toISOString(),
                },
              },
              html_url: "https://github.com/owner/repo/commit/def456abc123",
            },
          ]);
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
      expect(content).toContain("Human commit");
      expect(content).not.toContain("Bot commit");
    });

    it("should handle branch not existing", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  commits:
    branches:
      - nonexistent
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches/nonexistent")) {
          throw new Error("Branch not found");
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
    });
  });

  describe("releases collection", () => {
    it("should collect releases", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  releases:
    limit: 5
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/releases")) {
          return Promise.resolve([
            {
              tag_name: "v1.0.0",
              name: "Version 1.0.0",
              author: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
              created_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              prerelease: false,
              draft: false,
              body: "Release notes",
            },
          ]);
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
      expect(content).toContain("## Releases");
      expect(content).toContain("v1.0.0");
      expect(content).toContain("Version 1.0.0");
    });

    it("should filter out drafts", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  releases:
    draft: false
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/releases")) {
          return Promise.resolve([
            {
              tag_name: "v1.0.0",
              name: "Published Release",
              author: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
              created_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              prerelease: false,
              draft: false,
              body: null,
            },
            {
              tag_name: "v1.1.0",
              name: "Draft Release",
              author: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/releases/tag/v1.1.0",
              created_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              prerelease: false,
              draft: true,
              body: null,
            },
          ]);
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
      expect(content).toContain("Published Release");
      expect(content).not.toContain("Draft Release");
    });

    it("should filter out prereleases", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  releases:
    prerelease: false
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/releases")) {
          return Promise.resolve([
            {
              tag_name: "v1.0.0",
              name: "Stable Release",
              author: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
              created_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              prerelease: false,
              draft: false,
              body: null,
            },
            {
              tag_name: "v1.1.0-beta",
              name: "Beta Release",
              author: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/releases/tag/v1.1.0-beta",
              created_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
              prerelease: true,
              draft: false,
              body: null,
            },
          ]);
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
      expect(content).toContain("Stable Release");
      expect(content).not.toContain("Beta Release");
    });
  });

  describe("workflow runs collection", () => {
    it("should collect failed workflow runs", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  workflow_runs:
    status:
      - failure
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/actions/runs")) {
          return Promise.resolve({
            workflow_runs: [
              {
                id: 123456,
                name: "CI",
                status: "completed",
                conclusion: "failure",
                html_url: "https://github.com/owner/repo/actions/runs/123456",
                head_branch: "main",
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                actor: { login: "developer" },
              },
            ],
          });
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
      expect(content).toContain("## Workflow Runs");
      expect(content).toContain("CI");
      expect(content).toContain("failure");
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

  describe("security alerts collection", () => {
    it("should collect security alerts", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  security_alerts:
    severity:
      - high
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/dependabot/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "lodash",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-1234-5678-9012",
                cve_id: "CVE-2021-1234",
                summary: "Prototype Pollution",
                description: "Vulnerability description",
                severity: "high",
                cvss: {
                  score: 7.5,
                  vector_string: null,
                },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: {
                  ecosystem: "npm",
                  name: "lodash",
                },
                severity: "high",
                vulnerable_version_range: "< 4.17.21",
                first_patched_version: {
                  identifier: "4.17.21",
                },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/1",
              html_url: "https://github.com/owner/repo/security/dependabot/1",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
            },
          ]);
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
      expect(content).toContain("## Security Alerts");
      expect(content).toContain("Prototype Pollution");
      expect(content).toContain("lodash");
    });

    it("should filter security alerts by dismissed state", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  security_alerts:
    state:
      - dismissed
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/dependabot/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "package1",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-1234-5678-9012",
                cve_id: null,
                summary: "Open Alert",
                description: "Description",
                severity: "high",
                cvss: { score: 7.5, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "package1" },
                severity: "high",
                vulnerable_version_range: "< 1.0.0",
                first_patched_version: { identifier: "1.0.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/1",
              html_url: "https://github.com/owner/repo/security/dependabot/1",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
            },
            {
              number: 3,
              state: "dismissed",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "package3",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-3456-7890-1234",
                cve_id: null,
                summary: "Dismissed Alert",
                description: "Description",
                severity: "low",
                cvss: { score: 3.0, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "package3" },
                severity: "low",
                vulnerable_version_range: "< 3.0.0",
                first_patched_version: { identifier: "3.0.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/3",
              html_url: "https://github.com/owner/repo/security/dependabot/3",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: new Date().toISOString(),
              dismissed_by: { login: "admin" },
              dismissed_reason: "false_positive",
              dismissed_comment: null,
              fixed_at: null,
            },
          ]);
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
      expect(content).not.toContain("Open Alert");
      expect(content).toContain("Dismissed Alert");
    });

    it("should filter security alerts by state", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  security_alerts:
    state:
      - open
      - fixed
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/dependabot/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "package1",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-1234-5678-9012",
                cve_id: null,
                summary: "Open Alert",
                description: "Description",
                severity: "high",
                cvss: { score: 7.5, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "package1" },
                severity: "high",
                vulnerable_version_range: "< 1.0.0",
                first_patched_version: { identifier: "1.0.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/1",
              html_url: "https://github.com/owner/repo/security/dependabot/1",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
            },
            {
              number: 2,
              state: "fixed",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "package2",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-2345-6789-0123",
                cve_id: null,
                summary: "Fixed Alert",
                description: "Description",
                severity: "medium",
                cvss: { score: 5.0, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "package2" },
                severity: "medium",
                vulnerable_version_range: "< 2.0.0",
                first_patched_version: { identifier: "2.0.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/2",
              html_url: "https://github.com/owner/repo/security/dependabot/2",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: new Date().toISOString(),
            },
            {
              number: 3,
              state: "dismissed",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "package3",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-3456-7890-1234",
                cve_id: null,
                summary: "Dismissed Alert",
                description: "Description",
                severity: "low",
                cvss: { score: 3.0, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "package3" },
                severity: "low",
                vulnerable_version_range: "< 3.0.0",
                first_patched_version: { identifier: "3.0.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/3",
              html_url: "https://github.com/owner/repo/security/dependabot/3",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: new Date().toISOString(),
              dismissed_by: { login: "admin" },
              dismissed_reason: "false_positive",
              dismissed_comment: null,
              fixed_at: null,
            },
          ]);
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
      expect(result.outputs["total-items"]).toBe("2");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Open Alert");
      expect(content).toContain("Fixed Alert");
      expect(content).not.toContain("Dismissed Alert");
    });

    it("should filter security alerts by ecosystem", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  security_alerts:
    ecosystem:
      - pip
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/dependabot/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              dependency: {
                package: {
                  ecosystem: "pip",
                  name: "django",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-1234-5678-9012",
                cve_id: null,
                summary: "Python Alert",
                description: "Description",
                severity: "high",
                cvss: { score: 7.5, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "pip", name: "django" },
                severity: "high",
                vulnerable_version_range: "< 3.0",
                first_patched_version: { identifier: "3.0" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/1",
              html_url: "https://github.com/owner/repo/security/dependabot/1",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
            },
            {
              number: 2,
              state: "open",
              dependency: {
                package: {
                  ecosystem: "npm",
                  name: "lodash",
                },
              },
              security_advisory: {
                ghsa_id: "GHSA-2345-6789-0123",
                cve_id: null,
                summary: "NPM Alert",
                description: "Description",
                severity: "high",
                cvss: { score: 7.5, vector_string: null },
                cwes: [],
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                withdrawn_at: null,
                references: [],
              },
              security_vulnerability: {
                package: { ecosystem: "npm", name: "lodash" },
                severity: "high",
                vulnerable_version_range: "< 4.17.21",
                first_patched_version: { identifier: "4.17.21" },
              },
              url: "https://api.github.com/repos/owner/repo/dependabot/alerts/2",
              html_url: "https://github.com/owner/repo/security/dependabot/2",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
            },
          ]);
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
      expect(content).toContain("Python Alert");
      expect(content).not.toContain("NPM Alert");
    });

    it("should handle security alerts permission errors", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  security_alerts:
    limit: 10
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/dependabot/alerts")) {
          throw new Error("Permission denied");
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
    });
  });

  describe("dependabot PRs collection", () => {
    it("should collect Dependabot pull requests", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  dependabot_prs:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/pulls")) {
          return Promise.resolve([
            {
              number: 20,
              title: "Bump lodash from 4.17.20 to 4.17.21",
              state: "open",
              user: { login: "dependabot[bot]", type: "Bot" },
              html_url: "https://github.com/owner/repo/pull/20",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              merged_at: null,
              labels: [{ name: "dependencies" }],
              base: { ref: "main" },
              head: { ref: "dependabot/npm/lodash-4.17.21", sha: "abc123" },
              body: "Bumps lodash...",
            },
          ]);
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
      expect(content).toContain("## Dependabot Pull Requests");
      expect(content).toContain("lodash");
      expect(content).toContain("4.17.20");
      expect(content).toContain("4.17.21");
    });
  });

  describe("code scanning alerts collection", () => {
    it("should filter code scanning alerts by state", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  code_scanning_alerts:
    state:
      - open
      - dismissed
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/code-scanning/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              rule: {
                id: "js/sql-injection",
                severity: "error",
                description: "Open alert",
                name: "Open Alert",
                security_severity_level: "high",
              },
              tool: { name: "CodeQL", version: "2.7.0" },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "open",
                commit_sha: "abc123",
                location: { path: "src/file1.js", start_line: 10, end_line: 10 },
                message: { text: "Issue" },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
              html_url: "https://github.com/owner/repo/security/code-scanning/1",
            },
            {
              number: 2,
              state: "dismissed",
              rule: {
                id: "js/unused-var",
                severity: "warning",
                description: "Dismissed alert",
                name: "Dismissed Alert",
              },
              tool: { name: "CodeQL", version: "2.7.0" },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "dismissed",
                commit_sha: "def456",
                location: { path: "src/file2.js", start_line: 20, end_line: 20 },
                message: { text: "Issue" },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: new Date().toISOString(),
              dismissed_by: { login: "admin" },
              dismissed_reason: "false_positive",
              dismissed_comment: null,
              fixed_at: null,
              html_url: "https://github.com/owner/repo/security/code-scanning/2",
            },
            {
              number: 3,
              state: "fixed",
              rule: {
                id: "js/xss",
                severity: "error",
                description: "Fixed alert",
                name: "Fixed Alert",
              },
              tool: { name: "CodeQL", version: "2.7.0" },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "fixed",
                commit_sha: "ghi789",
                location: { path: "src/file3.js", start_line: 30, end_line: 30 },
                message: { text: "Issue" },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: new Date().toISOString(),
              html_url: "https://github.com/owner/repo/security/code-scanning/3",
            },
          ]);
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
      expect(result.outputs["total-items"]).toBe("2");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("Open Alert");
      expect(content).toContain("Dismissed Alert");
      expect(content).not.toContain("Fixed Alert");
    });

    it("should filter code scanning alerts by tool", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  code_scanning_alerts:
    tool:
      - ESLint
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/code-scanning/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              rule: {
                id: "no-unused-vars",
                severity: "warning",
                description: "ESLint alert",
                name: "ESLint Alert",
              },
              tool: { name: "ESLint", version: "8.0.0" },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "open",
                commit_sha: "abc123",
                location: { path: "src/file1.js", start_line: 10, end_line: 10 },
                message: { text: "Issue" },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
              html_url: "https://github.com/owner/repo/security/code-scanning/1",
            },
            {
              number: 2,
              state: "open",
              rule: {
                id: "js/sql-injection",
                severity: "error",
                description: "CodeQL alert",
                name: "CodeQL Alert",
              },
              tool: { name: "CodeQL", version: "2.7.0" },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "open",
                commit_sha: "def456",
                location: { path: "src/file2.js", start_line: 20, end_line: 20 },
                message: { text: "Issue" },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
              html_url: "https://github.com/owner/repo/security/code-scanning/2",
            },
          ]);
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
      expect(content).toContain("ESLint Alert");
      expect(content).not.toContain("CodeQL Alert");
    });

    it("should collect code scanning alerts", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  code_scanning_alerts:
    severity:
      - high
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/code-scanning/alerts")) {
          return Promise.resolve([
            {
              number: 1,
              state: "open",
              rule: {
                id: "js/sql-injection",
                severity: "error",
                description: "SQL injection vulnerability",
                name: "SQL Injection",
                security_severity_level: "high",
                tags: ["security"],
              },
              tool: {
                name: "CodeQL",
                version: "2.7.0",
              },
              most_recent_instance: {
                ref: "refs/heads/main",
                state: "open",
                commit_sha: "abc123",
                location: {
                  path: "src/database.js",
                  start_line: 42,
                  end_line: 42,
                },
                message: {
                  text: "Unsanitized user input used in SQL query",
                },
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dismissed_at: null,
              dismissed_by: null,
              dismissed_reason: null,
              dismissed_comment: null,
              fixed_at: null,
              html_url: "https://github.com/owner/repo/security/code-scanning/1",
            },
          ]);
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
      expect(content).toContain("## Code Scanning Alerts");
      expect(content).toContain("SQL Injection");
      expect(content).toContain("CodeQL");
    });
  });

  describe("multiple collection types", () => {
    it("should collect and combine multiple context types", async () => {
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
  pull_requests:
    states:
      - open
  stars: true
  forks: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues")) {
          return Promise.resolve([
            {
              number: 1,
              title: "Test Issue",
              state: "open",
              user: { login: "user1" },
              html_url: "https://github.com/owner/repo/issues/1",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              labels: [],
              assignees: [],
              body: null,
            },
          ]);
        }
        if (endpoint.includes("/pulls")) {
          return Promise.resolve([
            {
              number: 2,
              title: "Test PR",
              state: "open",
              user: { login: "user2" },
              html_url: "https://github.com/owner/repo/pull/2",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              merged_at: null,
              labels: [],
              assignees: [],
              requested_reviewers: [],
              base: { ref: "main" },
              head: { ref: "feature" },
              body: null,
            },
          ]);
        }
        if (endpoint === "repos/owner/repo") {
          return Promise.resolve({ stargazers_count: 50, forks_count: 10 });
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
      expect(result.outputs["total-items"]).toBe("4");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("## Issues");
      expect(content).toContain("## Pull Requests");
      expect(content).toContain("Stars: 50");
      expect(content).toContain("Forks: 10");
    });
  });

  describe("comments collection", () => {
    it("should collect issue and PR comments", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  comments:
    limit: 50
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/issues/comments")) {
          return Promise.resolve([
            {
              id: 123,
              body: "This is a comment",
              user: { login: "commenter" },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              html_url: "https://github.com/owner/repo/issues/1#issuecomment-123",
              issue_url: "https://api.github.com/repos/owner/repo/issues/1",
            },
          ]);
        }
        if (endpoint.includes("/pulls/comments")) {
          return Promise.resolve([
            {
              id: 456,
              body: "This is a review comment",
              user: { login: "reviewer" },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              html_url: "https://github.com/owner/repo/pull/2#discussion_r456",
              pull_request_url: "https://api.github.com/repos/owner/repo/pulls/2",
            },
          ]);
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
      expect(result.outputs["total-items"]).toBe("2");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("## Comments");
      expect(content).toContain("This is a comment");
      expect(content).toContain("This is a review comment");
    });
  });

  describe("branches collection", () => {
    it("should filter branches by protected status", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  branches:
    protected: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches")) {
          return Promise.resolve([
            {
              name: "main",
              commit: {
                sha: "abc123def456",
                commit: {
                  author: {
                    name: "Developer",
                    date: new Date().toISOString(),
                  },
                },
              },
              protected: true,
            },
            {
              name: "feature",
              commit: {
                sha: "def456abc123",
                commit: {
                  author: {
                    name: "Developer",
                    date: new Date().toISOString(),
                  },
                },
              },
              protected: false,
            },
          ]);
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
      expect(content).toContain("main");
      expect(content).not.toContain("feature");
    });

    it("should collect branches and identify stale ones", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  branches:
    stale_days: 30
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      const staleDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/branches")) {
          return Promise.resolve([
            {
              name: "main",
              commit: {
                sha: "abc123def456",
                commit: {
                  author: {
                    name: "Developer",
                    date: new Date().toISOString(),
                  },
                },
              },
              protected: true,
            },
            {
              name: "old-feature",
              commit: {
                sha: "def456abc123",
                commit: {
                  author: {
                    name: "Developer",
                    date: staleDate.toISOString(),
                  },
                },
              },
              protected: false,
            },
          ]);
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
      expect(result.outputs["total-items"]).toBe("2");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("## Branches");
      expect(content).toContain("main");
      expect(content).toContain("old-feature");
      expect(content).toContain("STALE");
      expect(content).toContain("[Protected]");
    });
  });

  describe("check runs collection", () => {
    it("should filter check runs by workflow name", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  check_runs:
    workflows:
      - "Test Suite"
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/check-runs")) {
          return Promise.resolve({
            total_count: 2,
            check_runs: [
              {
                id: 789,
                name: "Test Suite - Unit Tests",
                head_sha: "abc123def456",
                status: "completed",
                conclusion: "failure",
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                app: { name: "GitHub Actions" },
                output: { title: "Test failures", summary: "3 tests failed" },
                html_url: "https://github.com/owner/repo/runs/789",
              },
              {
                id: 790,
                name: "Linting",
                head_sha: "abc123def456",
                status: "completed",
                conclusion: "success",
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                app: { name: "GitHub Actions" },
                output: { title: null, summary: null },
                html_url: "https://github.com/owner/repo/runs/790",
              },
            ],
          });
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
      expect(content).toContain("Test Suite");
      expect(content).not.toContain("Linting");
    });

    it("should collect check runs", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  check_runs:
    status:
      - failure
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/check-runs")) {
          return Promise.resolve({
            total_count: 1,
            check_runs: [
              {
                id: 789,
                name: "Test Suite",
                head_sha: "abc123def456",
                status: "completed",
                conclusion: "failure",
                started_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                app: {
                  name: "GitHub Actions",
                },
                output: {
                  title: "Test failures",
                  summary: "3 tests failed",
                },
                html_url: "https://github.com/owner/repo/runs/789",
              },
            ],
          });
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
      expect(content).toContain("## Check Runs");
      expect(content).toContain("Test Suite");
      expect(content).toContain("FAILURE");
    });
  });

  describe("milestones collection", () => {
    it("should collect milestones with progress", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  milestones:
    states:
      - open
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/milestones")) {
          return Promise.resolve([
            {
              number: 1,
              title: "Version 2.0",
              description: "Major release",
              state: "open",
              open_issues: 5,
              closed_issues: 15,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              due_on: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              closed_at: null,
              creator: { login: "maintainer" },
              html_url: "https://github.com/owner/repo/milestone/1",
            },
          ]);
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
      expect(content).toContain("## Milestones");
      expect(content).toContain("Version 2.0");
      expect(content).toContain("75%");
    });
  });

  describe("contributors collection", () => {
    it("should collect contributors with recent activity", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  since: "24h"
  contributors:
    limit: 20
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/contributors")) {
          return Promise.resolve([
            {
              login: "contributor1",
              id: 1,
              avatar_url: "https://github.com/contributor1.png",
              html_url: "https://github.com/contributor1",
              contributions: 50,
              type: "User",
            },
          ]);
        }
        if (endpoint.includes("/commits?author=")) {
          return Promise.resolve([
            {
              commit: {
                author: {
                  date: new Date().toISOString(),
                },
              },
            },
          ]);
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
      expect(content).toContain("## Contributors");
      expect(content).toContain("contributor1");
    });
  });

  describe("deployments collection", () => {
    it("should filter deployments by state", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  deployments:
    states:
      - success
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/deployments") && !endpoint.includes("/statuses")) {
          return Promise.resolve([
            {
              id: 100,
              sha: "abc123def456",
              ref: "main",
              task: "deploy",
              environment: "production",
              description: "Deploy to prod",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              creator: { login: "deployer" },
              statuses_url: "https://api.github.com/repos/owner/repo/deployments/100/statuses",
            },
            {
              id: 101,
              sha: "def456abc123",
              ref: "main",
              task: "deploy",
              environment: "staging",
              description: "Deploy to staging",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              creator: { login: "deployer" },
              statuses_url: "https://api.github.com/repos/owner/repo/deployments/101/statuses",
            },
          ]);
        }
        if (endpoint.includes("/deployments/100/statuses")) {
          return Promise.resolve([
            {
              state: "success",
              description: "Success",
              environment: "production",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              target_url: "https://example.com",
              log_url: null,
            },
          ]);
        }
        if (endpoint.includes("/deployments/101/statuses")) {
          return Promise.resolve([
            {
              state: "failure",
              description: "Failed",
              environment: "staging",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              target_url: null,
              log_url: null,
            },
          ]);
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
      expect(content).toContain("production");
      expect(content).not.toContain("staging");
    });

    it("should handle deployments without status", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  deployments:
    limit: 10
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/deployments") && !endpoint.includes("/statuses")) {
          return Promise.resolve([
            {
              id: 100,
              sha: "abc123def456",
              ref: "main",
              task: "deploy",
              environment: "production",
              description: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              creator: { login: "deployer" },
              statuses_url: "https://api.github.com/repos/owner/repo/deployments/100/statuses",
            },
          ]);
        }
        if (endpoint.includes("/statuses")) {
          throw new Error("Status fetch failed");
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
      expect(content).toContain("No status available");
    });

    it("should collect deployments with status", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  deployments:
    environments:
      - production
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/deployments") && !endpoint.includes("/statuses")) {
          return Promise.resolve([
            {
              id: 100,
              sha: "abc123def456",
              ref: "main",
              task: "deploy",
              environment: "production",
              description: "Deploy to prod",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              creator: { login: "deployer" },
              statuses_url: "https://api.github.com/repos/owner/repo/deployments/100/statuses",
            },
          ]);
        }
        if (endpoint.includes("/statuses")) {
          return Promise.resolve([
            {
              state: "success",
              description: "Deployment successful",
              environment: "production",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              target_url: "https://example.com",
              log_url: null,
            },
          ]);
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
      expect(content).toContain("## Deployments");
      expect(content).toContain("production");
      expect(content).toContain("SUCCESS");
    });
  });

  describe("repository traffic collection", () => {
    it("should handle permission errors for traffic endpoints", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  repository_traffic:
    views: true
    clones: true
    referrers: true
    paths: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/traffic/")) {
          throw new Error("Permission denied");
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
    });

    it("should collect repository traffic data", async () => {
      const agentContent = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  repository_traffic:
    views: true
    clones: true
---

Test agent.
`;
      await writeFile(agentPath, agentContent);

      mockGhApi.mockImplementation((endpoint: string) => {
        if (endpoint.includes("/traffic/views")) {
          return Promise.resolve({
            count: 500,
            uniques: 100,
            views: [
              {
                timestamp: new Date().toISOString(),
                count: 50,
                uniques: 10,
              },
            ],
          });
        }
        if (endpoint.includes("/traffic/clones")) {
          return Promise.resolve({
            count: 50,
            uniques: 15,
            clones: [
              {
                timestamp: new Date().toISOString(),
                count: 5,
                uniques: 2,
              },
            ],
          });
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
      expect(result.outputs["total-items"]).toBe("2");

      const content = await readFile("/tmp/context/collected.md", "utf-8");
      expect(content).toContain("## Repository Traffic");
      expect(content).toContain("Views");
      expect(content).toContain("Clones");
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
