import type { ProgressCommentState, ProgressStage, ProgressStatus } from "@repo-agents/types";
import { ghApi } from "./github";

const PROGRESS_MARKER_PREFIX = "<!-- repo-agents-progress:";
const PROGRESS_MARKER_SUFFIX = " -->";

interface CommentResponse {
  id: number;
  body: string;
  html_url: string;
}

interface CreateCommentRequest {
  body: string;
}

/**
 * Generate the hidden marker for identifying progress comments
 */
function generateMarker(runId: string, agentName: string): string {
  return `${PROGRESS_MARKER_PREFIX}${runId}:${agentName}${PROGRESS_MARKER_SUFFIX}`;
}

/**
 * Check if agent should use progress comments based on triggers
 */
export function shouldUseProgressComment(
  triggers: { issues?: unknown; pull_request?: unknown },
  explicitSetting?: boolean,
): boolean {
  // Explicit setting takes precedence
  if (explicitSetting !== undefined) {
    return explicitSetting;
  }

  // Default enabled for issue/PR triggers
  return !!(triggers.issues || triggers.pull_request);
}

/**
 * Format the progress comment body with stage statuses
 */
export function formatProgressComment(state: ProgressCommentState): string {
  const marker = generateMarker(state.workflowRunId, state.agentName);

  // If we have a final comment, just show that with the marker
  if (state.finalComment) {
    return `${marker}\n${state.finalComment}`;
  }

  const statusEmoji: Record<ProgressStatus, string> = {
    pending: "⏳",
    running: "🔄",
    success: "✅",
    failed: "❌",
    skipped: "⏭️",
  };

  const stageLabels: Record<ProgressStage, string> = {
    validation: "Validation",
    context: "Context",
    agent: "Agent",
    outputs: "Outputs",
    complete: "Complete",
    failed: "Failed",
  };

  // Build stage rows (only show relevant stages)
  const stageOrder: ProgressStage[] = ["validation", "context", "agent", "outputs"];
  const rows = stageOrder
    .filter((stage) => state.stages[stage] !== undefined)
    .map((stage) => {
      const status = state.stages[stage];
      const emoji = statusEmoji[status];
      const label = stageLabels[stage];
      return `| ${label} | ${emoji} |`;
    });

  // Determine header based on current state
  let header: string;
  if (state.stages[state.currentStage] === "failed" || state.currentStage === "failed") {
    header = `### ❌ Agent: ${state.agentName}`;
  } else if (state.currentStage === "complete") {
    header = `### ✅ Agent: ${state.agentName}`;
  } else {
    header = `### 🤖 Agent: ${state.agentName}`;
  }

  const table = `| Stage | Status |
|-------|--------|
${rows.join("\n")}`;

  const footer = `*[View workflow run](${state.workflowRunUrl})*`;

  // Add error message if present
  const errorSection = state.error ? `\n\n> **Error:** ${state.error}` : "";

  return `${marker}
${header}

${table}
${errorSection}

---
${footer}`;
}

/**
 * Find an existing progress comment for this run
 */
export async function findProgressComment(
  owner: string,
  repo: string,
  issueNumber: number,
  runId: string,
  agentName: string,
): Promise<CommentResponse | null> {
  const marker = generateMarker(runId, agentName);

  try {
    // Fetch comments on the issue
    const comments = await ghApi<CommentResponse[]>(
      `repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
    );

    // Find comment with our marker
    return comments.find((c) => c.body.includes(marker)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Create a new progress comment
 */
export async function createProgressComment(
  owner: string,
  repo: string,
  issueNumber: number,
  state: ProgressCommentState,
): Promise<CommentResponse> {
  const body = formatProgressComment(state);

  const comment = await ghApi<CommentResponse>(
    `repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: "POST",
      body: { body } as CreateCommentRequest,
    },
  );

  return comment;
}

/**
 * Update an existing progress comment
 */
export async function updateProgressComment(
  owner: string,
  repo: string,
  commentId: number,
  state: ProgressCommentState,
): Promise<CommentResponse> {
  const body = formatProgressComment(state);

  const comment = await ghApi<CommentResponse>(
    `repos/${owner}/${repo}/issues/comments/${commentId}`,
    {
      method: "PATCH",
      body: { body } as CreateCommentRequest,
    },
  );

  return comment;
}

/**
 * Create initial progress state
 */
export function createInitialProgressState(
  agentName: string,
  workflowRunId: string,
  workflowRunUrl: string,
  hasContext: boolean,
): ProgressCommentState {
  const stages: Record<ProgressStage, ProgressStatus> = {
    validation: "success", // Already passed if we're creating the comment
    context: hasContext ? "pending" : "skipped",
    agent: "pending",
    outputs: "pending",
    complete: "pending",
    failed: "pending",
  };

  return {
    agentName,
    workflowRunId,
    workflowRunUrl,
    stages,
    currentStage: hasContext ? "context" : "agent",
  };
}

/**
 * Update progress state with a new stage status
 */
export function updateProgressState(
  state: ProgressCommentState,
  stage: ProgressStage,
  status: ProgressStatus,
  error?: string,
): ProgressCommentState {
  const newState = { ...state };
  newState.stages = { ...state.stages, [stage]: status };

  // Determine next stage
  if (status === "running") {
    newState.currentStage = stage;
  } else if (status === "success") {
    const stageOrder: ProgressStage[] = ["validation", "context", "agent", "outputs", "complete"];
    const currentIndex = stageOrder.indexOf(stage);
    if (currentIndex < stageOrder.length - 1) {
      // Find next non-skipped stage
      for (let i = currentIndex + 1; i < stageOrder.length; i++) {
        const nextStage = stageOrder[i];
        if (newState.stages[nextStage] !== "skipped") {
          newState.currentStage = nextStage;
          break;
        }
      }
    }
  } else if (status === "failed") {
    newState.currentStage = "failed";
    newState.error = error;
  }

  return newState;
}

/**
 * Set the final comment content (replaces progress table)
 */
export function setFinalComment(
  state: ProgressCommentState,
  comment: string,
): ProgressCommentState {
  return {
    ...state,
    finalComment: comment,
    currentStage: "complete",
  };
}
