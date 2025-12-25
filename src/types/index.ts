export interface AgentDefinition {
  name: string;
  on: TriggerConfig;
  permissions?: PermissionsConfig;
  claude?: ClaudeConfig;
  outputs?: Record<string, OutputConfig | boolean>;
  tools?: Tool[];
  allowed_actors?: string[];
  allowed_users?: string[]; // Alias for allowed_actors (explicit user list)
  allowed_teams?: string[];
  allowed_paths?: string[];
  trigger_labels?: string[]; // Labels that must be present to trigger the agent
  rate_limit_minutes?: number; // Minimum minutes between agent runs (default: 5)
  inputs?: InputConfig; // Data collection configuration
  audit?: AuditConfig; // Audit and failure reporting configuration
  markdown: string;
}

export interface AuditConfig {
  create_issues?: boolean; // Whether to create issues on failures (default: true)
  labels?: string[]; // Labels to add to audit issues
  assignees?: string[]; // Assignees for audit issues
}

export interface TriggerConfig {
  issues?: {
    types?: string[];
  };
  pull_request?: {
    types?: string[];
  };
  discussion?: {
    types?: string[];
  };
  schedule?: Array<{
    cron: string;
  }>;
  workflow_dispatch?: {
    inputs?: Record<string, WorkflowInput>;
  };
  repository_dispatch?: {
    types?: string[];
  };
}

export interface WorkflowInput {
  description: string;
  required?: boolean;
  default?: string;
  type?: 'string' | 'boolean' | 'choice';
  options?: string[];
}

export interface PermissionsConfig {
  contents?: 'read' | 'write';
  issues?: 'read' | 'write';
  pull_requests?: 'read' | 'write';
  discussions?: 'read' | 'write';
}

export interface ClaudeConfig {
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export type Output =
  | 'add-comment'
  | 'add-label'
  | 'remove-label'
  | 'create-issue'
  | 'create-discussion'
  | 'create-pr'
  | 'update-file'
  | 'close-issue'
  | 'close-pr';

export interface OutputConfig {
  max?: number; // Maximum times this output can be used
  sign?: boolean; // Whether to sign commits (for code changes)
  [key: string]: unknown; // Allow custom settings
}

export interface Tool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface ParsedAgent {
  frontmatter: Record<string, unknown>;
  markdown: string;
  filePath: string;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface CompileResult {
  success: boolean;
  inputPath: string;
  outputPath?: string;
  errors?: ValidationError[];
}

export interface ClaudeOutput {
  type: Output;
  data: Record<string, unknown>;
}

export interface WorkflowStep {
  name?: string;
  id?: string;
  uses?: string;
  with?: Record<string, string | boolean>;
  run?: string;
  env?: Record<string, string>;
  if?: string;
  'continue-on-error'?: boolean;
}

// Input Configuration Types
export interface InputConfig {
  issues?: IssuesInputConfig;
  pull_requests?: PullRequestsInputConfig;
  discussions?: DiscussionsInputConfig;
  commits?: CommitsInputConfig;
  releases?: ReleasesInputConfig;
  workflow_runs?: WorkflowRunsInputConfig;
  stars?: boolean;
  forks?: boolean;
  since?: string; // Time filter: "last-run", "1h", "24h", "7d", etc. (default: "last-run")
  min_items?: number; // Minimum total items to trigger agent (default: 1)
}

export interface IssuesInputConfig {
  states?: ('open' | 'closed' | 'all')[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  mentions?: string[];
  milestones?: string[];
  exclude_labels?: string[];
  limit?: number; // Max items to fetch (default: 100)
}

export interface PullRequestsInputConfig {
  states?: ('open' | 'closed' | 'merged' | 'all')[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  reviewers?: string[];
  base_branch?: string;
  head_branch?: string;
  exclude_labels?: string[];
  limit?: number;
}

export interface DiscussionsInputConfig {
  categories?: string[];
  answered?: boolean;
  unanswered?: boolean;
  labels?: string[];
  limit?: number;
}

export interface CommitsInputConfig {
  branches?: string[]; // Branches to check (default: ["main", "master"])
  authors?: string[];
  exclude_authors?: string[];
  limit?: number;
}

export interface ReleasesInputConfig {
  prerelease?: boolean; // Include prereleases
  draft?: boolean; // Include drafts
  limit?: number;
}

export interface WorkflowRunsInputConfig {
  workflows?: string[]; // Workflow file names or IDs
  status?: ('success' | 'failure' | 'cancelled' | 'skipped')[];
  branches?: string[];
  limit?: number;
}

export interface CollectedInputs {
  issues?: GitHubIssue[];
  pull_requests?: GitHubPullRequest[];
  discussions?: GitHubDiscussion[];
  commits?: GitHubCommit[];
  releases?: GitHubRelease[];
  workflow_runs?: GitHubWorkflowRun[];
  stars?: number;
  forks?: number;
  total_items: number;
  collected_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  assignees: string[];
  body?: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  labels: string[];
  assignees: string[];
  reviewers: string[];
  baseBranch: string;
  headBranch: string;
  body?: string;
}

export interface GitHubDiscussion {
  number: number;
  title: string;
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  category: string;
  answered: boolean;
  labels: string[];
  body?: string;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  branch?: string;
}

export interface GitHubRelease {
  tagName: string;
  name: string;
  author: string;
  url: string;
  createdAt: string;
  publishedAt: string;
  prerelease: boolean;
  draft: boolean;
  body?: string;
}

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  url: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

// Audit Report Types
export interface ClaudeExecutionMetrics {
  result: string; // The actual response content
  total_cost_usd: number; // API cost for the request
  is_error: boolean; // Boolean error indicator
  duration_ms: number; // Total execution time in milliseconds
  duration_api_ms: number; // API-only processing time
  num_turns: number; // Conversation turn count
  session_id: string; // Unique conversation identifier
}

export interface ExecutionAudit {
  agent_name: string;
  workflow_run_id: string;
  workflow_run_url: string;
  triggered_by: string;
  trigger_event: string;
  started_at: string;
  completed_at: string;
  metrics: ClaudeExecutionMetrics;
  validation_status: {
    secrets_check: boolean;
    user_authorization: boolean;
    labels_check: boolean;
    rate_limit_check: boolean;
  };
  outputs_executed: OutputExecutionSummary[];
  permission_issues: PermissionIssue[];
}

export interface OutputExecutionSummary {
  output_type: Output;
  success: boolean;
  error_message?: string;
  details?: Record<string, unknown>;
}

export interface PermissionIssue {
  timestamp: string;
  issue_type: 'missing_permission' | 'path_restriction' | 'rate_limit' | 'validation_error';
  severity: 'error' | 'warning';
  message: string;
  context?: Record<string, unknown>;
}
