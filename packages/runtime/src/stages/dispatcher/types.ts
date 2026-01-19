/**
 * Types for dispatcher stages
 */

/**
 * Context available to dispatcher stages.
 */
export interface DispatcherContext {
  /** GitHub Actions environment variables and event data */
  github: {
    repository: string;
    runId: string;
    runAttempt: string;
    serverUrl: string;
    eventName: string;
    eventAction: string;
    ref: string;
    sha: string;
    actor: string;
    eventPath: string;
  };
  /** CLI-specific options */
  options?: {
    agentsDir?: string;
    agentPath?: string;
    workflowFile?: string;
  };
}

/**
 * Dispatch context data passed between dispatcher and agent workflows.
 */
export interface DispatchContext {
  /** Unique identifier for this dispatch */
  dispatchId: string;
  /** ISO timestamp when dispatch was initiated */
  dispatchedAt: string;
  /** Dispatcher workflow run ID */
  dispatcherRunId: string;
  /** URL to dispatcher workflow run */
  dispatcherRunUrl: string;
  /** GitHub event that triggered the dispatcher */
  eventName: string;
  /** GitHub event action (opened, closed, etc.) */
  eventAction: string;
  /** Repository in owner/repo format */
  repository: string;
  /** Git ref that triggered the event */
  ref: string;
  /** Git SHA that triggered the event */
  sha: string;
  /** User or app that triggered the event */
  actor: string;
  /** Event-specific data */
  issue?: IssueData;
  pullRequest?: PullRequestData;
  discussion?: DiscussionData;
  schedule?: ScheduleData;
  repositoryDispatch?: RepositoryDispatchData;
}

export interface IssueData {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  state: string;
  url: string;
}

export interface PullRequestData {
  number: number;
  title: string;
  body: string;
  author: string;
  labels: string[];
  baseBranch: string;
  headBranch: string;
  state: string;
  url: string;
}

export interface DiscussionData {
  number: number;
  title: string;
  body: string;
  author: string;
  category: string;
  url: string;
}

export interface ScheduleData {
  cron: string;
}

export interface RepositoryDispatchData {
  eventType: string;
  clientPayload: unknown;
}

/**
 * Routing rule for matching events to agents.
 */
export interface RoutingRule {
  agentName: string;
  agentPath: string;
  workflowFile: string;
  triggers: {
    issues?: string[];
    pullRequest?: string[];
    discussion?: string[];
    schedule?: string[];
    repositoryDispatch?: string[];
    workflowDispatch?: boolean;
  };
}
