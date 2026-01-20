import { describe, expect, test } from "bun:test";
import type { ProgressCommentState } from "@repo-agents/types";
import {
  createInitialProgressState,
  formatProgressComment,
  setFinalComment,
  shouldUseProgressComment,
  updateProgressState,
} from "./progress-comment";

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
});
