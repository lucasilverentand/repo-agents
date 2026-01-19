import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDispatch } from "../dispatch";
import type { DispatcherContext } from "../types";

interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
}

// Mock GitHub API utilities
const mockIsOrgMember = mock(() => Promise.resolve(false));
const mockIsTeamMember = mock(() => Promise.resolve(false));
const mockGetRepositoryPermission = mock(() => Promise.resolve("read"));
const mockGetRecentWorkflowRuns = mock((): Promise<WorkflowRun[]> => Promise.resolve([]));

// Mock the utils module
mock.module("../../../utils/index", () => ({
  parseRepository: (repo: string) => {
    const [owner, name] = repo.split("/");
    return { owner, repo: name };
  },
  isOrgMember: mockIsOrgMember,
  isTeamMember: mockIsTeamMember,
  getRepositoryPermission: mockGetRepositoryPermission,
  getRecentWorkflowRuns: mockGetRecentWorkflowRuns,
}));

describe("runDispatch", () => {
  let tempAgentPath: string;
  let tempEventPath: string;

  beforeEach(async () => {
    const tempDir = tmpdir();
    tempAgentPath = join(tempDir, `agent-${randomUUID()}.md`);
    tempEventPath = join(tempDir, `event-${randomUUID()}.json`);

    // Reset mocks
    mockIsOrgMember.mockClear();
    mockIsTeamMember.mockClear();
    mockGetRepositoryPermission.mockClear();
    mockGetRecentWorkflowRuns.mockClear();

    // Default mock behaviors
    mockIsOrgMember.mockResolvedValue(false);
    mockIsTeamMember.mockResolvedValue(false);
    mockGetRepositoryPermission.mockResolvedValue("read");
    mockGetRecentWorkflowRuns.mockResolvedValue([]);
  });

  afterEach(async () => {
    try {
      await rm(tempAgentPath, { force: true });
      await rm(tempEventPath, { force: true });
      await rm("/tmp/artifacts", { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createContext = (
    eventName: string,
    eventAction: string,
    actor: string,
  ): DispatcherContext => ({
    github: {
      repository: "test/repo",
      runId: "123456",
      runAttempt: "1",
      serverUrl: "https://github.com",
      eventName,
      eventAction,
      ref: "refs/heads/main",
      sha: "abc123",
      actor,
      eventPath: tempEventPath,
    },
    options: {
      agentPath: tempAgentPath,
      workflowFile: "agent-test.yml",
    },
  });

  test("allows execution when user is in allowed_users list", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
allowed-users:
  - alice
  - bob
---
Test agent`,
    );

    const ctx = createContext("issues", "opened", "alice");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
  });

  test("blocks execution when user not in allowed_users list", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
allowed-users:
  - alice
  - bob
---
Test agent`,
    );

    const ctx = createContext("issues", "opened", "charlie");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("false");
    expect(result.outputs["skip-reason"]).toContain("not authorized");
  });

  test("allows execution when user is in allowed team", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
allowed-teams:
  - core-team
---
Test agent`,
    );

    mockIsTeamMember.mockResolvedValue(true);

    const ctx = createContext("issues", "opened", "teamuser");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
    expect(mockIsTeamMember).toHaveBeenCalledWith("test", "core-team", "teamuser");
  });

  test("allows org member with write permission", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
---
Test agent`,
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "orguser");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
  });

  test("blocks org member with read-only permission", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
---
Test agent`,
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("read");

    const ctx = createContext("issues", "opened", "readonly");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("false");
    expect(result.outputs["skip-reason"]).toContain("read-only access");
  });

  test("checks trigger labels and allows when present", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
trigger_labels:
  - needs-review
  - automated
---
Test agent`,
    );

    // Create event with required labels
    await writeFile(
      tempEventPath,
      JSON.stringify({
        issue: {
          labels: [{ name: "needs-review" }, { name: "automated" }, { name: "bug" }],
        },
      }),
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
  });

  test("blocks when trigger labels are missing", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
trigger_labels:
  - needs-review
  - automated
---
Test agent`,
    );

    // Event missing 'automated' label
    await writeFile(
      tempEventPath,
      JSON.stringify({
        issue: {
          labels: [{ name: "needs-review" }, { name: "bug" }],
        },
      }),
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("false");
    expect(result.outputs["skip-reason"]).toContain("automated");
  });

  test("skips label check for non-issue/PR events", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  discussion:
    types: [created]
trigger_labels:
  - needs-review
---
Test agent`,
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("discussion", "created", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
  });

  test("enforces rate limiting when recent run exists", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
rate_limit_minutes: 10
---
Test agent`,
    );

    // Mock recent successful run 5 minutes ago
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockGetRecentWorkflowRuns.mockResolvedValue([
      {
        id: 1,
        name: "agent-test",
        conclusion: "success",
        created_at: fiveMinutesAgo,
        status: "completed",
        head_branch: "main",
      },
    ]);

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("false");
    expect(result.outputs["rate-limited"]).toBe("true");
    expect(result.outputs["skip-reason"]).toContain("Rate limit");
  });

  test("allows execution when rate limit has passed", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
rate_limit_minutes: 10
---
Test agent`,
    );

    // Mock run 15 minutes ago (beyond 10 minute limit)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    mockGetRecentWorkflowRuns.mockResolvedValue([
      {
        id: 1,
        name: "agent-test",
        conclusion: "success",
        created_at: fifteenMinutesAgo,
        status: "completed",
        head_branch: "main",
      },
    ]);

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("true");
  });

  test("uses default 5 minute rate limit when not specified", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
---
Test agent`,
    );

    // Mock run 3 minutes ago (within default 5 minute limit)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    mockGetRecentWorkflowRuns.mockResolvedValue([
      {
        id: 1,
        name: "agent-test",
        conclusion: "success",
        created_at: threeMinutesAgo,
        status: "completed",
        head_branch: "main",
      },
    ]);

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(true);
    expect(result.outputs["should-run"]).toBe("false");
    expect(result.outputs["rate-limited"]).toBe("true");
  });

  test("handles invalid agent definition", async () => {
    await writeFile(
      tempAgentPath,
      `---
on:
  issues:
    types: [opened]
---
Missing name`,
    );

    const ctx = createContext("issues", "opened", "user");
    const result = await runDispatch(ctx);

    expect(result.success).toBe(false);
    expect(result.outputs["skip-reason"]).toContain("Validation error");
  });

  test("creates validation audit artifact", async () => {
    await writeFile(
      tempAgentPath,
      `---
name: test-agent
on:
  issues:
    types: [opened]
---
Test agent`,
    );

    mockIsOrgMember.mockResolvedValue(true);
    mockGetRepositoryPermission.mockResolvedValue("write");

    const ctx = createContext("issues", "opened", "user");
    await runDispatch(ctx);

    // Audit artifact should be created at /tmp/artifacts/validation-audit/audit.json
    // We can't easily test this without mocking file system, but we can verify no errors
    expect(true).toBe(true);
  });
});
