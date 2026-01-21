import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ProgressCommentState } from "@repo-agents/types";
import {
  createInitialProgressState,
  createProgressComment,
  findProgressComment,
  formatProgressComment,
  setFinalComment,
  shouldUseProgressComment,
  updateProgressComment,
  updateProgressState,
} from "./progress-comment";

// Mock the ghApi function to avoid actual GitHub API calls
const mockGhApi = mock(() => Promise.resolve({}));
mock.module("./github", () => ({
  ghApi: mockGhApi,
}));

describe("shouldUseProgressComment", () => {
  test("returns true when explicitly enabled", () => {
    expect(shouldUseProgressComment({}, true)).toBe(true);
    expect(shouldUseProgressComment({ issues: {} }, true)).toBe(true);
  });

  test("returns false when explicitly disabled", () => {
    expect(shouldUseProgressComment({ issues: {} }, false)).toBe(false);
    expect(shouldUseProgressComment({ pull_request: {} }, false)).toBe(false);
  });

  test("returns true by default for issue triggers", () => {
    expect(shouldUseProgressComment({ issues: {} })).toBe(true);
    expect(shouldUseProgressComment({ issues: { types: ["opened"] } })).toBe(true);
  });

  test("returns true by default for pull_request triggers", () => {
    expect(shouldUseProgressComment({ pull_request: {} })).toBe(true);
    expect(shouldUseProgressComment({ pull_request: { types: ["opened"] } })).toBe(true);
  });

  test("returns false by default for other triggers", () => {
    expect(shouldUseProgressComment({})).toBe(false);
    // No issues or pull_request means no progress comment
    expect(shouldUseProgressComment({ issues: undefined, pull_request: undefined })).toBe(false);
  });

  test("returns true when both issue and PR triggers present", () => {
    expect(shouldUseProgressComment({ issues: {}, pull_request: {} })).toBe(true);
  });
});

describe("createInitialProgressState", () => {
  test("creates state with validation success and context pending", () => {
    const state = createInitialProgressState(
      "test-agent",
      "12345",
      "https://github.com/test/repo/actions/runs/12345",
      true,
    );

    expect(state.agentName).toBe("test-agent");
    expect(state.workflowRunId).toBe("12345");
    expect(state.workflowRunUrl).toBe("https://github.com/test/repo/actions/runs/12345");
    expect(state.stages.validation).toBe("success");
    expect(state.stages.context).toBe("pending");
    expect(state.stages.agent).toBe("pending");
    expect(state.stages.outputs).toBe("pending");
    expect(state.currentStage).toBe("context");
  });

  test("skips context stage when hasContext is false", () => {
    const state = createInitialProgressState(
      "test-agent",
      "12345",
      "https://github.com/test/repo/actions/runs/12345",
      false,
    );

    expect(state.stages.context).toBe("skipped");
    expect(state.currentStage).toBe("agent");
  });
});

describe("updateProgressState", () => {
  const baseState: ProgressCommentState = {
    agentName: "test-agent",
    workflowRunId: "12345",
    workflowRunUrl: "https://github.com/test/repo/actions/runs/12345",
    stages: {
      validation: "success",
      context: "pending",
      agent: "pending",
      outputs: "pending",
      complete: "pending",
      failed: "pending",
    },
    currentStage: "context",
  };

  test("updates stage to running and sets currentStage", () => {
    const newState = updateProgressState(baseState, "context", "running");
    expect(newState.stages.context).toBe("running");
    expect(newState.currentStage).toBe("context");
  });

  test("updates stage to success and advances to next stage", () => {
    const newState = updateProgressState(baseState, "context", "success");
    expect(newState.stages.context).toBe("success");
    expect(newState.currentStage).toBe("agent");
  });

  test("skips over skipped stages when advancing", () => {
    const stateWithSkippedContext: ProgressCommentState = {
      ...baseState,
      stages: { ...baseState.stages, context: "skipped" },
      currentStage: "validation",
    };

    const newState = updateProgressState(stateWithSkippedContext, "validation", "success");
    expect(newState.currentStage).toBe("agent");
  });

  test("updates to failed state and sets error", () => {
    const newState = updateProgressState(baseState, "agent", "failed", "Something went wrong");
    expect(newState.stages.agent).toBe("failed");
    expect(newState.currentStage).toBe("failed");
    expect(newState.error).toBe("Something went wrong");
  });

  test("does not mutate original state", () => {
    const originalContext = baseState.stages.context;
    updateProgressState(baseState, "context", "success");
    expect(baseState.stages.context).toBe(originalContext);
  });
});

describe("setFinalComment", () => {
  const baseState: ProgressCommentState = {
    agentName: "test-agent",
    workflowRunId: "12345",
    workflowRunUrl: "https://github.com/test/repo/actions/runs/12345",
    stages: {
      validation: "success",
      context: "success",
      agent: "success",
      outputs: "success",
      complete: "pending",
      failed: "pending",
    },
    currentStage: "outputs",
  };

  test("sets final comment and changes currentStage to complete", () => {
    const newState = setFinalComment(baseState, "Analysis complete!");
    expect(newState.finalComment).toBe("Analysis complete!");
    expect(newState.currentStage).toBe("complete");
  });

  test("does not mutate original state", () => {
    setFinalComment(baseState, "Analysis complete!");
    expect(baseState.finalComment).toBeUndefined();
  });
});

describe("formatProgressComment", () => {
  test("includes hidden marker for identification", () => {
    const state = createInitialProgressState(
      "test-agent",
      "12345",
      "https://github.com/test/repo/actions/runs/12345",
      true,
    );

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("<!-- repo-agents-progress:12345:test-agent -->");
  });

  test("shows running header for active execution", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "running",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("### 🤖 Agent: test-agent");
  });

  test("shows success header when complete", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "success",
        agent: "success",
        outputs: "success",
        complete: "success",
        failed: "pending",
      },
      currentStage: "complete",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("### ✅ Agent: test-agent");
  });

  test("shows failed header on error", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "failed",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "failed",
      error: "Something went wrong",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("### ❌ Agent: test-agent");
    expect(formatted).toContain("> **Error:** Something went wrong");
  });

  test("includes stage status table with correct emojis", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "running",
        agent: "pending",
        outputs: "skipped",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("| Validation | ✅ |");
    expect(formatted).toContain("| Context | 🔄 |");
    expect(formatted).toContain("| Agent | ⏳ |");
    expect(formatted).toContain("| Outputs | ⏭️ |");
  });

  test("includes workflow run link", () => {
    const state = createInitialProgressState(
      "test-agent",
      "12345",
      "https://github.com/test/repo/actions/runs/12345",
      false,
    );

    const formatted = formatProgressComment(state);
    expect(formatted).toContain(
      "[View workflow run](https://github.com/test/repo/actions/runs/12345)",
    );
  });

  test("replaces table with final comment when set", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "success",
        agent: "success",
        outputs: "success",
        complete: "success",
        failed: "pending",
      },
      currentStage: "complete",
      finalComment: "## Analysis Complete\n\nThe issue looks well-formed!",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("<!-- repo-agents-progress:12345:test-agent -->");
    expect(formatted).toContain("## Analysis Complete");
    expect(formatted).toContain("The issue looks well-formed!");
    // Should NOT contain the progress table
    expect(formatted).not.toContain("| Stage | Status |");
  });

  test("handles very long agent names", () => {
    const longAgentName = "a".repeat(200);
    const state: ProgressCommentState = {
      agentName: longAgentName,
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain(`<!-- repo-agents-progress:12345:${longAgentName} -->`);
    expect(formatted).toContain(`### 🤖 Agent: ${longAgentName}`);
  });

  test("handles special characters in agent name", () => {
    const specialName = "test-agent_v2.0 (beta) [priority]";
    const state: ProgressCommentState = {
      agentName: specialName,
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain(`<!-- repo-agents-progress:12345:${specialName} -->`);
    expect(formatted).toContain(`### 🤖 Agent: ${specialName}`);
  });

  test("handles error without error message", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "failed",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "failed",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("### ❌ Agent: test-agent");
    expect(formatted).not.toContain("> **Error:**");
  });

  test("only shows stages that are not undefined", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "skipped",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "agent",
    };

    const formatted = formatProgressComment(state);
    // All stages should be shown since none are undefined
    expect(formatted).toContain("| Validation | ✅ |");
    expect(formatted).toContain("| Context | ⏭️ |");
    expect(formatted).toContain("| Agent | ⏳ |");
    expect(formatted).toContain("| Outputs | ⏳ |");
  });

  test("shows failed stage when currentStage is failed but stage status is pending", () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://example.com",
      stages: {
        validation: "success",
        context: "success",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "failed",
    };

    const formatted = formatProgressComment(state);
    expect(formatted).toContain("### ❌ Agent: test-agent");
  });
});

describe("findProgressComment", () => {
  beforeEach(() => {
    mockGhApi.mockReset();
  });

  test("finds existing progress comment by marker", async () => {
    const comments = [
      {
        id: 1,
        body: "Some other comment",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-1",
      },
      {
        id: 2,
        body: "<!-- repo-agents-progress:12345:test-agent -->\n### 🤖 Agent: test-agent",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-2",
      },
      {
        id: 3,
        body: "Another comment",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-3",
      },
    ];

    mockGhApi.mockResolvedValue(comments);

    const result = await findProgressComment("owner", "repo", 123, "12345", "test-agent");

    expect(result).toEqual(comments[1]);
    expect(mockGhApi).toHaveBeenCalledWith("repos/owner/repo/issues/123/comments?per_page=100");
  });

  test("returns null when no matching comment found", async () => {
    const comments = [
      {
        id: 1,
        body: "Some other comment",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-1",
      },
      {
        id: 2,
        body: "Another comment",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-2",
      },
    ];

    mockGhApi.mockResolvedValue(comments);

    const result = await findProgressComment("owner", "repo", 123, "12345", "test-agent");

    expect(result).toBeNull();
  });

  test("returns null when API call fails", async () => {
    mockGhApi.mockRejectedValue(new Error("API error"));

    const result = await findProgressComment("owner", "repo", 123, "12345", "test-agent");

    expect(result).toBeNull();
  });

  test("returns null when no comments exist", async () => {
    mockGhApi.mockResolvedValue([]);

    const result = await findProgressComment("owner", "repo", 123, "12345", "test-agent");

    expect(result).toBeNull();
  });

  test("finds comment with different agent name", async () => {
    const comments = [
      {
        id: 1,
        body: "<!-- repo-agents-progress:12345:another-agent -->\n### 🤖 Agent: another-agent",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-1",
      },
    ];

    mockGhApi.mockResolvedValue(comments);

    const result = await findProgressComment("owner", "repo", 123, "12345", "another-agent");

    expect(result).toEqual(comments[0]);
  });

  test("does not find comment with different run ID", async () => {
    const comments = [
      {
        id: 1,
        body: "<!-- repo-agents-progress:99999:test-agent -->\n### 🤖 Agent: test-agent",
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-1",
      },
    ];

    mockGhApi.mockResolvedValue(comments);

    const result = await findProgressComment("owner", "repo", 123, "12345", "test-agent");

    expect(result).toBeNull();
  });

  test("handles comments with special characters in agent name", async () => {
    const specialName = "test-agent_v2.0 (beta)";
    const comments = [
      {
        id: 1,
        body: `<!-- repo-agents-progress:12345:${specialName} -->\n### 🤖 Agent: ${specialName}`,
        html_url: "https://github.com/owner/repo/issues/123#issuecomment-1",
      },
    ];

    mockGhApi.mockResolvedValue(comments);

    const result = await findProgressComment("owner", "repo", 123, "12345", specialName);

    expect(result).toEqual(comments[0]);
  });
});

describe("createProgressComment", () => {
  beforeEach(() => {
    mockGhApi.mockReset();
  });

  test("creates new progress comment with formatted body", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await createProgressComment("owner", "repo", 123, state);

    expect(result).toEqual(mockResponse);
    expect(mockGhApi).toHaveBeenCalledWith("repos/owner/repo/issues/123/comments", {
      method: "POST",
      body: { body: formatProgressComment(state) },
    });
  });

  test("creates comment with final comment content", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "success",
        agent: "success",
        outputs: "success",
        complete: "success",
        failed: "pending",
      },
      currentStage: "complete",
      finalComment: "## Analysis Complete\n\nEverything looks good!",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await createProgressComment("owner", "repo", 123, state);

    expect(result).toEqual(mockResponse);
    const callArgs = mockGhApi.mock.calls[0];
    expect(callArgs[1]?.body?.body).toContain("## Analysis Complete");
    expect(callArgs[1]?.body?.body).toContain("Everything looks good!");
    expect(callArgs[1]?.body?.body).not.toContain("| Stage | Status |");
  });

  test("throws error when API call fails", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    mockGhApi.mockRejectedValue(new Error("Permission denied"));

    await expect(createProgressComment("owner", "repo", 123, state)).rejects.toThrow();
  });

  test("creates comment with error state", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "failed",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "failed",
      error: "Context collection failed",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await createProgressComment("owner", "repo", 123, state);

    expect(result).toEqual(mockResponse);
    const callArgs = mockGhApi.mock.calls[0];
    expect(callArgs[1]?.body?.body).toContain("> **Error:** Context collection failed");
  });
});

describe("updateProgressComment", () => {
  beforeEach(() => {
    mockGhApi.mockReset();
  });

  test("updates existing comment with new state", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "success",
        agent: "running",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "agent",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await updateProgressComment("owner", "repo", 456, state);

    expect(result).toEqual(mockResponse);
    expect(mockGhApi).toHaveBeenCalledWith("repos/owner/repo/issues/comments/456", {
      method: "PATCH",
      body: { body: formatProgressComment(state) },
    });
  });

  test("updates comment to completion state", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "success",
        agent: "success",
        outputs: "success",
        complete: "success",
        failed: "pending",
      },
      currentStage: "complete",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await updateProgressComment("owner", "repo", 456, state);

    expect(result).toEqual(mockResponse);
    const callArgs = mockGhApi.mock.calls[0];
    expect(callArgs[1]?.body?.body).toContain("### ✅ Agent: test-agent");
  });

  test("updates comment to failed state with error", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "success",
        agent: "failed",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "failed",
      error: "Agent execution timeout",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await updateProgressComment("owner", "repo", 456, state);

    expect(result).toEqual(mockResponse);
    const callArgs = mockGhApi.mock.calls[0];
    expect(callArgs[1]?.body?.body).toContain("### ❌ Agent: test-agent");
    expect(callArgs[1]?.body?.body).toContain("> **Error:** Agent execution timeout");
  });

  test("updates comment with final comment", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "success",
        agent: "success",
        outputs: "success",
        complete: "success",
        failed: "pending",
      },
      currentStage: "complete",
      finalComment: "## Issue Analysis\n\nThis issue is valid and ready for implementation.",
    };

    const mockResponse = {
      id: 456,
      body: formatProgressComment(state),
      html_url: "https://github.com/owner/repo/issues/123#issuecomment-456",
    };

    mockGhApi.mockResolvedValue(mockResponse);

    const result = await updateProgressComment("owner", "repo", 456, state);

    expect(result).toEqual(mockResponse);
    const callArgs = mockGhApi.mock.calls[0];
    expect(callArgs[1]?.body?.body).toContain("## Issue Analysis");
    expect(callArgs[1]?.body?.body).toContain("This issue is valid and ready for implementation.");
  });

  test("throws error when API call fails", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    mockGhApi.mockRejectedValue(new Error("Comment not found"));

    await expect(updateProgressComment("owner", "repo", 456, state)).rejects.toThrow();
  });

  test("handles permission errors", async () => {
    const state: ProgressCommentState = {
      agentName: "test-agent",
      workflowRunId: "12345",
      workflowRunUrl: "https://github.com/owner/repo/actions/runs/12345",
      stages: {
        validation: "success",
        context: "pending",
        agent: "pending",
        outputs: "pending",
        complete: "pending",
        failed: "pending",
      },
      currentStage: "context",
    };

    mockGhApi.mockRejectedValue(new Error("GitHub API request failed: Permission denied"));

    await expect(updateProgressComment("owner", "repo", 456, state)).rejects.toThrow(
      "GitHub API request failed",
    );
  });
});
