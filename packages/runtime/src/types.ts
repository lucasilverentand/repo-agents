/**
 * Result returned by each stage of the runtime pipeline.
 */
export interface StageResult {
  /** Whether the stage completed successfully */
  success: boolean;
  /** Key-value pairs to write to GITHUB_OUTPUT */
  outputs: Record<string, string>;
  /** Artifacts to upload after stage completion */
  artifacts?: Array<{ name: string; path: string }>;
  /** Reason for skipping execution (when success=true but stage was skipped) */
  skipReason?: string;
}

/**
 * Context available to all stages during runtime execution.
 * Populated from GitHub Actions environment variables and CLI flags.
 */
export interface StageContext {
  /** Repository in owner/repo format (from GITHUB_REPOSITORY) */
  repository: string;
  /** Workflow run ID (from GITHUB_RUN_ID) */
  runId: string;
  /** User or app that triggered the workflow (from GITHUB_ACTOR) */
  actor: string;
  /** GitHub event name that triggered the workflow (from GITHUB_EVENT_NAME) */
  eventName: string;
  /** Path to the event payload JSON file (from GITHUB_EVENT_PATH) */
  eventPath: string;
  /** Path to the agent definition markdown file (from --agent flag) */
  agentPath: string;
  /** Output type to execute, for outputs stage (from --output-type flag) */
  outputType?: string;
  /** Dispatcher run ID, for dispatcher mode (from --dispatch-run-id flag) */
  dispatchRunId?: string;
  /** Job statuses from previous stages (for audit stage) */
  jobStatuses?: JobStatuses;
  /** Progress comment ID (from dispatcher via workflow input) */
  progressCommentId?: number;
  /** Issue/PR number for progress comment (from dispatcher via workflow input) */
  progressIssueNumber?: number;
}

/**
 * Status of each job in the workflow, passed to audit stage.
 * Note: Pre-flight checks run in the dispatcher, not in agent workflows.
 */
export interface JobStatuses {
  /** Result of the agent job */
  agent?: JobResult;
  /** Result of the execute-outputs job */
  executeOutputs?: JobResult;
  /** Result of the collect-context job */
  collectContext?: JobResult;
  /** Whether the run was rate-limited (skip, not failure) */
  rateLimited?: boolean;
}

export type JobResult = "success" | "failure" | "cancelled" | "skipped";

/**
 * Function signature for all runtime stages.
 */
export type Stage = (ctx: StageContext) => Promise<StageResult>;
