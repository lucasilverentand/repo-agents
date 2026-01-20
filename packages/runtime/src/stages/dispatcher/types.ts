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
