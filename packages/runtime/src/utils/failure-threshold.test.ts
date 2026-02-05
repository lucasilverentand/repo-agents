import { describe, expect, it, mock } from "bun:test";
import type { AgentDefinition } from "@repo-agents/types";
import type { WorkflowRun } from "./github";

// Mock the github module to control getRecentCompletedRuns
const mockGetRecentCompletedRuns = mock<
  (owner: string, repo: string, workflowName: string, limit?: number) => Promise<WorkflowRun[]>
>(() => Promise.resolve([]));

mock.module("./index", () => ({
  getRecentCompletedRuns: mockGetRecentCompletedRuns,
  getRecentWorkflowRuns: mock(() => Promise.resolve([])),
  countOpenPRs: mock(() => Promise.resolve(0)),
  getRepositoryPermission: mock(() => Promise.resolve("admin")),
  isOrgMember: mock(() => Promise.resolve(false)),
  isTeamMember: mock(() => Promise.resolve(false)),
  parseRepository: (repo: string) => {
    const [owner, name] = repo.split("/");
    return { owner, repo: name };
  },
}));

import { checkFailureThreshold, type ValidationContext } from "./validation";

const createContext = (): ValidationContext => ({
  github: {
    actor: "test-user",
    repository: "owner/repo",
    eventName: "issues",
    eventPath: "/tmp/event.json",
    runId: 12345,
    serverUrl: "https://github.com",
  },
  options: {
    workflowFile: "agents.yml",
  },
});

const createAgent = (failureThreshold?: number): AgentDefinition => ({
  name: "test-agent",
  on: { issues: { types: ["opened"] } },
  failure_threshold: failureThreshold,
  markdown: "# Test Agent",
});

const makeRun = (conclusion: "success" | "failure" | "cancelled", id: number): WorkflowRun => ({
  id,
  name: "agents.yml",
  status: "completed",
  conclusion,
  created_at: new Date(Date.now() - id * 60000).toISOString(),
  head_branch: "main",
});

describe("checkFailureThreshold", () => {
  describe("allows execution when no failures", () => {
    it("should allow when no runs exist", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
    });

    it("should allow when all runs succeeded", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("success", 1),
        makeRun("success", 2),
        makeRun("success", 3),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
    });

    it("should allow when most recent run succeeded", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("success", 1),
        makeRun("failure", 2),
        makeRun("failure", 3),
        makeRun("failure", 4),
        makeRun("failure", 5),
        makeRun("failure", 6),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(0);
    });
  });

  describe("counts consecutive failures correctly", () => {
    it("should count 1 consecutive failure", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("success", 2),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(1);
    });

    it("should count 4 consecutive failures (below default threshold)", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("failure", 2),
        makeRun("failure", 3),
        makeRun("failure", 4),
        makeRun("success", 5),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(4);
    });

    it("should stop counting at first non-failure", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("failure", 2),
        makeRun("cancelled", 3), // cancelled breaks the streak
        makeRun("failure", 4),
        makeRun("failure", 5),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
      expect(result.consecutiveFailures).toBe(2);
    });
  });

  describe("trips circuit breaker at threshold", () => {
    it("should trip at default threshold of 5", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("failure", 2),
        makeRun("failure", 3),
        makeRun("failure", 4),
        makeRun("failure", 5),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(false);
      expect(result.consecutiveFailures).toBe(5);
      expect(result.threshold).toBe(5);
      expect(result.reason).toContain("Circuit breaker tripped");
      expect(result.reason).toContain("5 consecutive failures");
    });

    it("should trip at custom threshold of 3", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("failure", 2),
        makeRun("failure", 3),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent(3));

      expect(result.allowed).toBe(false);
      expect(result.consecutiveFailures).toBe(3);
      expect(result.threshold).toBe(3);
    });

    it("should trip when failures exceed threshold", async () => {
      mockGetRecentCompletedRuns.mockResolvedValueOnce([
        makeRun("failure", 1),
        makeRun("failure", 2),
        makeRun("failure", 3),
        makeRun("failure", 4),
        makeRun("failure", 5),
        makeRun("failure", 6),
        makeRun("failure", 7),
      ]);

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(false);
      expect(result.consecutiveFailures).toBe(7);
    });
  });

  describe("respects failure_threshold: 0 (disabled)", () => {
    it("should allow execution when threshold is 0", async () => {
      // Should not even call the API
      const result = await checkFailureThreshold(createContext(), createAgent(0));

      expect(result.allowed).toBe(true);
    });
  });

  describe("handles API errors gracefully", () => {
    it("should allow execution when API call fails", async () => {
      mockGetRecentCompletedRuns.mockRejectedValueOnce(new Error("API error"));

      const result = await checkFailureThreshold(createContext(), createAgent());

      expect(result.allowed).toBe(true);
    });
  });
});
