import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as parser from "@repo-agents/parser";
import type { StageContext } from "../types.js";
import * as artifacts from "../utils/artifacts";
import * as github from "../utils/github";
import { runPreFlight } from "./pre-flight";

// Mock the parser
const mockAgentParser = {
  parseFile: mock(() => Promise.resolve({ agent: undefined, errors: [] })),
  validateAgent: mock(() => []),
};

// Valid agent definition for testing
const validAgent = {
  name: "Test Agent",
  on: { issues: { types: ["opened"] } },
  markdown: "# Test instructions",
};

describe("runPreFlight", () => {
  // Create context for each test
  const createContext = (overrides: Partial<StageContext> = {}): StageContext => ({
    repository: "test-owner/test-repo",
    runId: "12345",
    actor: "test-user",
    eventName: "issues",
    eventPath: "/tmp/event.json",
    agentPath: ".github/agents/test.md",
    ...overrides,
  });

  beforeEach(() => {
    // Reset environment
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    process.env.GITHUB_WORKFLOW = "test-workflow";

    // Reset mocks
    mockAgentParser.parseFile.mockReset();
    mockAgentParser.parseFile.mockImplementation(() =>
      Promise.resolve({ agent: validAgent, errors: [] }),
    );
    mockAgentParser.validateAgent.mockReset();
    mockAgentParser.validateAgent.mockImplementation(() => []);
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    delete process.env.GITHUB_WORKFLOW;
  });

  describe("secrets check", () => {
    test("fails when no secrets are configured", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.CLAUDE_CODE_OAUTH_TOKEN;

      // Mock the parser
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as parser.AgentParser extends { parseFile: infer T }
          ? T extends (path: string) => Promise<{ agent: infer A }>
            ? A
            : never
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs["should-run"]).toBe("false");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
    });

    test("passes with ANTHROPIC_API_KEY", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";

      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["should-run"]).toBe("true");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("passes with CLAUDE_CODE_OAUTH_TOKEN", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      process.env.CLAUDE_CODE_OAUTH_TOKEN = "oauth-token";

      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["should-run"]).toBe("true");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });
  });

  describe("user authorization", () => {
    test("allows user with write permission", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext({ actor: "authorized-user" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(getRepoPermSpy).toHaveBeenCalledWith("test-owner", "test-repo", "authorized-user");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("allows user with admin permission", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("admin");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext({ actor: "admin-user" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("denies user without sufficient permission", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("read");
      const isOrgMemberSpy = spyOn(github, "isOrgMember").mockResolvedValue(false);

      const ctx = createContext({ actor: "readonly-user" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(false);
      expect(result.outputs["should-run"]).toBe("false");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      isOrgMemberSpy.mockRestore();
    });

    test("allows org member even with read permission", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("read");
      const isOrgMemberSpy = spyOn(github, "isOrgMember").mockResolvedValue(true);
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext({ actor: "org-member" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(isOrgMemberSpy).toHaveBeenCalledWith("test-owner", "org-member");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      isOrgMemberSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("allows user in allowed_users list", async () => {
      const agentWithAllowList = {
        ...validAgent,
        allowed_users: ["special-user"],
      };

      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: agentWithAllowList as ReturnType<
          typeof parser.agentParser.parseFile
        > extends Promise<{ agent: infer A }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext({ actor: "special-user" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("allows team member", async () => {
      const agentWithTeam = {
        ...validAgent,
        allowed_teams: ["dev-team"],
      };

      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: agentWithTeam as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const isTeamMemberSpy = spyOn(github, "isTeamMember").mockResolvedValue(true);
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext({ actor: "team-member" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(isTeamMemberSpy).toHaveBeenCalledWith("test-owner", "dev-team", "team-member");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      isTeamMemberSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });
  });

  describe("rate limiting", () => {
    test("allows when no recent runs exist", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([]);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["rate-limited"]).toBe("false");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("blocks when recent run exists within rate limit", async () => {
      const recentRun = {
        id: 1,
        name: "test-workflow",
        status: "completed",
        conclusion: "success",
        created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        head_branch: "main",
      };

      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");
      const getWorkflowRunsSpy = spyOn(github, "getRecentWorkflowRuns").mockResolvedValue([
        recentRun,
      ]);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["should-run"]).toBe("false");
      expect(result.outputs["rate-limited"]).toBe("true");
      expect(result.skipReason).toContain("Rate limit");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
      getWorkflowRunsSpy.mockRestore();
    });

    test("bypasses rate limit for workflow_dispatch", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);
      const getRepoPermSpy = spyOn(github, "getRepositoryPermission").mockResolvedValue("write");

      const ctx = createContext({ eventName: "workflow_dispatch" });
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(true);
      expect(result.outputs["should-run"]).toBe("true");
      expect(result.outputs["rate-limited"]).toBe("false");

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
      getRepoPermSpy.mockRestore();
    });
  });

  describe("agent loading", () => {
    test("fails when agent file has parse errors", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: undefined,
        errors: [{ field: "name", message: "Required", severity: "error" as const }],
      });
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(false);

      parseFileSpy.mockRestore();
      writeArtifactSpy.mockRestore();
    });

    test("fails when agent validation fails", async () => {
      const parseFileSpy = spyOn(parser.agentParser, "parseFile").mockResolvedValue({
        agent: validAgent as ReturnType<typeof parser.agentParser.parseFile> extends Promise<{
          agent: infer A;
        }>
          ? A
          : never,
        errors: [],
      });
      const validateAgentSpy = spyOn(parser.agentParser, "validateAgent").mockReturnValue([
        {
          field: "outputs",
          message: "update-file requires allowed-paths",
          severity: "error" as const,
        },
      ]);
      const writeArtifactSpy = spyOn(artifacts, "writeArtifact").mockResolvedValue(undefined);

      const ctx = createContext();
      const result = await runPreFlight(ctx);

      expect(result.success).toBe(false);

      parseFileSpy.mockRestore();
      validateAgentSpy.mockRestore();
      writeArtifactSpy.mockRestore();
    });
  });
});
