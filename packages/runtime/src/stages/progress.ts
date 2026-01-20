import { readFile } from "node:fs/promises";
import { agentParser } from "@repo-agents/parser";
import type { DispatchContext, ProgressCommentState, ProgressStage } from "@repo-agents/types";
import type { StageContext, StageResult } from "../types";
import {
  findProgressComment,
  parseRepository,
  setFinalComment,
  shouldUseProgressComment,
  updateProgressComment,
  updateProgressState,
} from "../utils/index";

interface ProgressOptions {
  stage: ProgressStage;
  status: "running" | "success" | "failed" | "skipped";
  error?: string;
  finalComment?: string;
}

/**
 * Progress stage: Update progress comment on issue/PR.
 *
 * This stage is called at each workflow stage transition to update
 * the progress comment with the current status.
 */
export async function runProgress(
  ctx: StageContext,
  options: ProgressOptions,
): Promise<StageResult> {
  try {
    // Load agent to check if progress comments are enabled
    const { agent } = await agentParser.parseFile(ctx.agentPath);
    if (!agent) {
      return { success: true, outputs: {} };
    }

    if (!shouldUseProgressComment(agent.on, agent.progress_comment)) {
      return { success: true, outputs: {} };
    }

    // Load dispatch context to get progress comment info
    const dispatchContext = await loadDispatchContext();
    if (!dispatchContext?.progressComment) {
      console.log("No progress comment found in dispatch context");
      return { success: true, outputs: {} };
    }

    const { commentId, issueNumber } = dispatchContext.progressComment;
    const { owner, repo } = parseRepository(ctx.repository);

    // Find existing comment to get current state
    const existingComment = await findProgressComment(
      owner,
      repo,
      issueNumber,
      ctx.runId,
      agent.name,
    );

    if (!existingComment) {
      console.log("Progress comment not found");
      return { success: true, outputs: {} };
    }

    // Parse current state from comment (or create new state)
    let state = parseProgressState(existingComment.body, agent.name, ctx.runId, dispatchContext);

    // Handle final comment replacement
    if (options.finalComment) {
      state = setFinalComment(state, options.finalComment);
    } else {
      // Update state with new stage status
      state = updateProgressState(state, options.stage, options.status, options.error);
    }

    // Update the comment
    await updateProgressComment(owner, repo, commentId, state);
    console.log(`✓ Updated progress comment: ${options.stage} → ${options.status}`);

    return {
      success: true,
      outputs: {},
    };
  } catch (error) {
    console.warn("Failed to update progress comment:", error);
    // Don't fail the workflow if progress comment update fails
    return {
      success: true,
      outputs: {},
    };
  }
}

/**
 * Load dispatch context from artifact.
 */
async function loadDispatchContext(): Promise<DispatchContext | null> {
  try {
    const content = await readFile("/tmp/dispatch-context/context.json", "utf-8");
    return JSON.parse(content) as DispatchContext;
  } catch {
    return null;
  }
}

/**
 * Parse progress state from existing comment body.
 * Falls back to creating initial state if parsing fails.
 */
function parseProgressState(
  _body: string,
  agentName: string,
  runId: string,
  dispatchContext: DispatchContext,
): ProgressCommentState {
  // For simplicity, we recreate state based on the stage updates
  // A more sophisticated implementation could parse the table from the comment
  const workflowRunUrl = dispatchContext.dispatcherRunUrl.replace(
    dispatchContext.dispatcherRunId,
    runId,
  );

  return {
    agentName,
    workflowRunId: runId,
    workflowRunUrl,
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
}

/**
 * Read the final comment from Claude's add-comment output.
 */
export async function readFinalComment(): Promise<string | null> {
  try {
    // Check for add-comment output file
    const content = await readFile("/tmp/outputs/add-comment.json", "utf-8");
    const parsed = JSON.parse(content) as { body?: string };
    return parsed.body ?? null;
  } catch {
    return null;
  }
}
