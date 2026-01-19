export type AgentProvider = "claude-code" | "opencode";

export interface AgentDefinition {
  name: string;
  on: TriggerConfig;
  permissions?: PermissionsConfig;
  provider?: AgentProvider;
  claude?: ClaudeConfig;
  outputs?: Record<string, OutputConfig | boolean>;
  tools?: Tool[];
  allowed_actors?: string[];
  allowed_users?: string[]; // Alias for allowed_actors (explicit user list)
  allowed_teams?: string[];
  allowed_paths?: string[];
  trigger_labels?: string[]; // Labels that must ALL be present to trigger the agent
  max_open_prs?: number; // Maximum number of open PRs before skipping execution
  rate_limit_minutes?: number; // Minimum minutes between agent runs (default: 5)
  context?: ContextConfig; // Data collection configuration
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
  type?: "string" | "boolean" | "choice";
  options?: string[];
}

export interface PermissionsConfig {
  contents?: "read" | "write";
  issues?: "read" | "write";
  pull_requests?: "read" | "write";
  discussions?: "read" | "write";
}

export interface ClaudeConfig {
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export type Output =
  | "add-comment"
  | "add-label"
  | "remove-label"
  | "create-issue"
  | "create-discussion"
  | "create-pr"
  | "update-file"
  | "close-issue"
  | "close-pr"
  | "assign-issue"
  | "request-review"
  | "merge-pr"
  | "approve-pr"
  | "create-release"
  | "delete-branch"
  | "lock-conversation"
  | "pin-issue"
  | "convert-to-discussion"
  | "edit-issue"
  | "reopen-issue"
  | "set-milestone"
  | "trigger-workflow"
  | "add-reaction"
  | "create-branch";

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
  severity: "error" | "warning";
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
  "continue-on-error"?: boolean;
}

// Context Configuration Types
export interface IssuesContextConfig {
  states?: ("open" | "closed" | "all")[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  mentions?: string[];
  milestones?: string[];
  exclude_labels?: string[];
  limit?: number; // Max items to fetch (default: 100)
}

export interface PullRequestsContextConfig {
  states?: ("open" | "closed" | "merged" | "all")[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  reviewers?: string[];
  base_branch?: string;
  head_branch?: string;
  exclude_labels?: string[];
  limit?: number;
}

export interface DiscussionsContextConfig {
  categories?: string[];
  answered?: boolean;
  unanswered?: boolean;
  labels?: string[];
  limit?: number;
}

export interface CommitsContextConfig {
  branches?: string[]; // Branches to check (default: ["main", "master"])
  authors?: string[];
  exclude_authors?: string[];
  limit?: number;
}

export interface ReleasesContextConfig {
  prerelease?: boolean; // Include prereleases
  draft?: boolean; // Include drafts
  limit?: number;
}

export interface WorkflowRunsContextConfig {
  workflows?: string[]; // Workflow file names or IDs
  status?: ("success" | "failure" | "cancelled" | "skipped")[];
  branches?: string[];
  limit?: number;
}

export interface SecurityAlertsContextConfig {
  severity?: ("critical" | "high" | "medium" | "low")[];
  state?: ("open" | "fixed" | "dismissed")[];
  ecosystem?: string[]; // npm, pip, maven, etc.
  limit?: number;
}

export interface DependabotPRsContextConfig {
  states?: ("open" | "closed" | "merged")[];
  limit?: number;
}

export interface CodeScanningAlertsContextConfig {
  severity?: ("critical" | "high" | "medium" | "low" | "warning" | "note" | "error")[];
  state?: ("open" | "fixed" | "dismissed")[];
  tool?: string[]; // CodeQL, etc.
  limit?: number;
}

export interface DeploymentsContextConfig {
  environments?: string[];
  states?: ("success" | "failure" | "error" | "pending" | "in_progress")[];
  limit?: number;
}

export interface MilestonesContextConfig {
  states?: ("open" | "closed" | "all")[];
  sort?: "due_on" | "completeness";
  limit?: number;
}

export interface ContributorsContextConfig {
  limit?: number;
  since?: string; // Contributor activity since (uses parent since if not specified)
}

export interface CommentsContextConfig {
  issue_comments?: boolean;
  pr_comments?: boolean;
  pr_review_comments?: boolean;
  discussion_comments?: boolean;
  limit?: number;
}

export interface RepositoryTrafficContextConfig {
  views?: boolean;
  clones?: boolean;
  referrers?: boolean;
  paths?: boolean;
}

export interface BranchesContextConfig {
  protected?: boolean;
  stale_days?: number; // Consider branches stale if no commits in N days
  limit?: number;
}

export interface CheckRunsContextConfig {
  workflows?: string[];
  status?: ("success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out")[];
  limit?: number;
}

export interface ContextConfig {
  issues?: IssuesContextConfig;
  pull_requests?: PullRequestsContextConfig;
  discussions?: DiscussionsContextConfig;
  commits?: CommitsContextConfig;
  releases?: ReleasesContextConfig;
  workflow_runs?: WorkflowRunsContextConfig;
  security_alerts?: SecurityAlertsContextConfig;
  dependabot_prs?: DependabotPRsContextConfig;
  code_scanning_alerts?: CodeScanningAlertsContextConfig;
  deployments?: DeploymentsContextConfig;
  milestones?: MilestonesContextConfig;
  contributors?: ContributorsContextConfig;
  comments?: CommentsContextConfig;
  repository_traffic?: RepositoryTrafficContextConfig;
  branches?: BranchesContextConfig;
  check_runs?: CheckRunsContextConfig;
  stars?: boolean;
  forks?: boolean;
  since?: string; // Time filter: "last-run", "1h", "24h", "7d", etc. (default: "last-run")
  min_items?: number; // Minimum total items to trigger agent (default: 1)
}

export interface CollectedContext {
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
  issue_type: "missing_permission" | "path_restriction" | "rate_limit" | "validation_error";
  severity: "error" | "warning";
  message: string;
  context?: Record<string, unknown>;
}

// Dispatcher Types
export interface DispatcherConfig {
  selfHeal?: {
    createIssue?: boolean;
    disableOnError?: boolean;
    issueLabels?: string[];
    issueAssignees?: string[];
  };
}

export type TriggerEventType =
  | "issues"
  | "pull_request"
  | "discussion"
  | "schedule"
  | "workflow_dispatch"
  | "repository_dispatch";

export interface RoutingRule {
  agentName: string;
  agentPath: string; // Path to agent markdown file (e.g., .github/agents/triage.md)
  workflowFile: string;
  triggers: Array<{
    eventType: TriggerEventType;
    eventActions?: string[]; // For event-based triggers (issues, pull_request, discussion)
    schedule?: string; // For schedule triggers (cron expression)
    dispatchTypes?: string[]; // For repository_dispatch
  }>;
}

export interface DispatchContext {
  dispatchId: string;
  dispatchedAt: string;
  dispatcherRunId: string;
  dispatcherRunUrl: string;
  eventName: string;
  eventAction?: string;
  repository: string;
  ref: string;
  sha: string;
  actor: string;
  issue?: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
    state: string;
    url: string;
  };
  pullRequest?: {
    number: number;
    title: string;
    body: string;
    author: string;
    labels: string[];
    baseBranch: string;
    headBranch: string;
    state: string;
    url: string;
  };
  discussion?: {
    number: number;
    title: string;
    body: string;
    author: string;
    category: string;
    url: string;
  };
  schedule?: {
    cron: string;
  };
  repositoryDispatch?: {
    eventType: string;
    clientPayload: Record<string, unknown>;
  };
}
