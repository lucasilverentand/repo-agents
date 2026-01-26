export type AgentProvider = "claude-code" | "opencode";

export interface PreFlightConfig {
  check_blocking_issues?: boolean; // Check if issue has open blockers (default: false)
  max_estimate?: number; // Skip if estimate exceeds this value (optional)
}

export interface AgentDefinition {
  name: string;
  on: TriggerConfig;
  permissions?: PermissionsConfig;
  provider?: AgentProvider;
  outputs?: Record<string, OutputConfig | boolean>;
  tools?: Tool[];
  allowed_actors?: string[];
  allowed_users?: string[]; // Alias for allowed_actors (explicit user list)
  allowed_teams?: string[];
  allowed_paths?: string[];
  trigger_labels?: string[]; // Labels that must ALL be present to trigger the agent
  skip_labels?: string[]; // Labels that will skip the agent if ANY are present
  max_open_prs?: number; // Maximum number of open PRs before skipping execution
  rate_limit_minutes?: number; // Minimum minutes between agent runs (default: 5)
  pre_flight?: PreFlightConfig; // Pre-flight checks configuration
  context?: ContextConfig; // Data collection configuration
  audit?: AuditConfig; // Audit and failure reporting configuration
  progress_comment?: boolean; // Show progress comment on issue/PR (default: true for issue/PR triggers)
  allow_bot_triggers?: boolean; // Allow bot/app actors to trigger this agent (default: false, prevents recursive loops)
  concurrency?: ConcurrencyConfig | false; // Concurrency settings for debouncing (default: auto-generated based on trigger)
  timeout?: number | TimeoutConfig; // Execution timeout in minutes (number) or detailed config
  markdown: string;
}

export interface AuditConfig {
  create_issues?: boolean; // Whether to create issues on failures (default: true)
  labels?: string[]; // Labels to add to audit issues
  assignees?: string[]; // Assignees for audit issues
}

// Blueprint Types
export type BlueprintParameterType = "string" | "number" | "boolean" | "array" | "enum";

export interface BlueprintParameter {
  name: string;
  description?: string;
  type: BlueprintParameterType;
  default?: string | number | boolean | string[];
  required?: boolean;
  values?: string[]; // For enum type
}

export interface BlueprintMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  extends?: string; // Parent blueprint to inherit from
  parameters: BlueprintParameter[];
}

export interface BlueprintDefinition {
  blueprint: BlueprintMetadata;
  frontmatter: Record<string, unknown>; // Template frontmatter with {{ parameter }} placeholders
  markdown: string; // Template markdown with {{ parameter }} placeholders
}

export interface BlueprintInstance {
  extends: string; // Blueprint source (e.g., "catalog:standard-triage@v1", "./blueprints/custom.md")
  parameters?: Record<string, string | number | boolean | string[]>; // Parameter values
}

export interface ResolvedBlueprint {
  source: string;
  metadata: BlueprintMetadata;
  agent: AgentDefinition; // The resolved agent with parameters applied
}

export interface ConcurrencyConfig {
  group?: string; // Custom concurrency group (supports GitHub expressions)
  cancel_in_progress?: boolean; // Whether to cancel in-progress runs (default: true)
}

export interface InvocationConfig {
  command: string; // Command name (without leading /)
  description?: string; // Description shown in /help
  aliases?: string[]; // Alternative command names
  allowed_users?: string[]; // Users who can invoke this command
  allowed_teams?: string[]; // Teams who can invoke this command
}

export interface TimeoutConfig {
  execution?: number; // Agent execution timeout in minutes (default: 30)
  total?: number; // Total job timeout in minutes (default: 45)
  context_collection?: number; // Context collection timeout in minutes (default: 5)
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
  invocation?: InvocationConfig | InvocationConfig[]; // Comment-triggered execution
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
  | "create-branch"
  | "copy-project"
  | "mark-template"
  | "manage-labels"
  | "add-to-project"
  | "remove-from-project"
  | "update-project-field"
  | "archive-project-item"
  | "manage-project"
  | "manage-project-field"
  | "link-project";

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
  "timeout-minutes"?: number;
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

export interface ProjectContextConfig {
  project_number?: number; // Project number (visible in URL)
  project_id?: string; // Project node ID (format: PVT_...)
  owner?: string; // Owner for organization projects (defaults to repo owner)
  include_items?: boolean; // Include project items in context (default: true)
  include_fields?: boolean; // Include field definitions (default: true)
  filters?: {
    status?: string[]; // Filter by status field values
    assignee?: string[]; // Filter by assignee
    labels?: string[]; // Filter by labels on linked issues/PRs
  };
  limit?: number; // Limit number of items (default: 100)
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
  project?: ProjectContextConfig; // GitHub Projects v2 context collection
  stars?: boolean;
  forks?: boolean;
  since?: string; // Time filter: "last-run", "1h", "24h", "7d", etc. (default: "last-run")
  min_items?: number; // Minimum total items to trigger agent (default: 1)
  project_id?: string; // GitHub Project ID for custom fields (format: PVT_...) - deprecated, use project.project_id
  include_dependencies?: boolean; // Include issue blocking/blocked-by relationships
  include_custom_fields?: string[]; // Custom field names to include from Projects - deprecated, use project config
}

// Issue Dependency Types
export interface IssueDependency {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  labels: string[];
}

// Project Custom Field Types
export interface ProjectCustomField {
  name: string;
  value: string | number | boolean | null;
  fieldType: "single_select" | "number" | "text" | "date" | "iteration";
}

export interface CollectedContext {
  issues?: GitHubIssue[];
  pull_requests?: GitHubPullRequest[];
  discussions?: GitHubDiscussion[];
  commits?: GitHubCommit[];
  releases?: GitHubRelease[];
  workflow_runs?: GitHubWorkflowRun[];
  project?: GitHubProject;
  stars?: number;
  forks?: number;
  dependencies?: {
    blocked_by: IssueDependency[];
    blocking: IssueDependency[];
  };
  custom_fields?: ProjectCustomField[];
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

export interface GitHubProjectField {
  id: string;
  name: string;
  dataType: "single_select" | "number" | "text" | "date" | "iteration";
  options?: Array<{
    id: string;
    name: string;
  }>;
}

export interface GitHubProjectItemFieldValue {
  fieldName: string;
  value: string | number | null;
}

export interface GitHubProjectItem {
  id: string;
  contentType: "Issue" | "PullRequest" | "DraftIssue";
  contentNumber?: number;
  contentTitle?: string;
  contentState?: string;
  contentUrl?: string;
  assignees: string[];
  labels: string[];
  fieldValues: GitHubProjectItemFieldValue[];
}

export interface GitHubProject {
  id: string;
  number: number;
  title: string;
  description?: string;
  url: string;
  fields: GitHubProjectField[];
  items: GitHubProjectItem[];
  itemsByStatus: Record<string, number>;
  totalItems: number;
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

// Progress Comment Types
export type ProgressStage = "validation" | "context" | "agent" | "outputs" | "complete" | "failed";

export type ProgressStatus = "pending" | "running" | "success" | "failed" | "skipped";

export interface ProgressCommentState {
  agentName: string;
  workflowRunId: string;
  workflowRunUrl: string;
  stages: Record<ProgressStage, ProgressStatus>;
  currentStage: ProgressStage;
  error?: string;
  finalComment?: string; // Claude's add-comment output replaces progress
}

// Audit Manifest Types
export interface AuditManifest {
  schema_version: "1.0.0";
  audit_id: string;
  generated_at: string;
  metadata: AuditMetadata;
  validation: AuditValidationPhase;
  execution: AuditExecutionPhase;
  outputs: AuditOutputsPhase;
  failures: AuditFailureSummary;
  issues: AuditIssue[];
}

export interface AuditMetadata {
  agent_name: string;
  agent_path: string;
  agent_version?: string;
  workflow: {
    run_id: string;
    run_number: number;
    run_attempt: number;
    workflow_name: string;
    workflow_url: string;
    job_name: string;
  };
  trigger: {
    event_name: string;
    event_action?: string;
    actor: string;
    repository: string;
    ref?: string;
    sha?: string;
  };
  timing: {
    workflow_started_at: string;
    agent_started_at?: string;
    agent_completed_at?: string;
    total_duration_ms: number;
  };
}

export interface AuditValidationPhase {
  passed: boolean;
  checks: {
    secrets_check: AuditValidationCheck;
    bot_actor: AuditValidationCheck;
    user_authorization: AuditValidationCheck;
    trigger_labels: AuditValidationCheck;
    rate_limit: AuditValidationCheck;
    max_open_prs: AuditValidationCheck;
    blocking_issues: AuditValidationCheck;
  };
  skip_reason?: string;
}

export interface AuditValidationCheck {
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface AuditExecutionPhase {
  success: boolean;
  session_id?: string;
  metrics: {
    total_cost_usd: number;
    num_turns: number;
    duration_ms: number;
    duration_api_ms: number;
    model?: string;
    input_tokens?: number;
    output_tokens?: number;
  };
  conversation_file?: string;
  tool_usage: AuditToolUsageSummary;
  result?: string;
  error?: {
    type: string;
    message: string;
    stack?: string;
  };
}

export interface AuditToolUsageSummary {
  total_calls: number;
  by_tool: Record<
    string,
    {
      calls: number;
      successes: number;
      failures: number;
    }
  >;
  permission_issues: AuditToolPermissionIssue[];
}

export interface AuditToolPermissionIssue {
  tool: string;
  issue_type: "denied" | "restricted" | "not_allowed";
  message: string;
  timestamp: string;
}

export interface AuditOutputsPhase {
  configured_count: number;
  executed_count: number;
  results: AuditOutputResult[];
}

export interface AuditOutputResult {
  type: string;
  file: string;
  validation_passed: boolean;
  execution_succeeded: boolean;
  validation_errors?: string[];
  execution_error?: string;
  data?: Record<string, unknown>;
  result?: Record<string, unknown>;
}

export interface AuditFailureSummary {
  has_failures: boolean;
  failure_count: number;
  reasons: AuditFailureReason[];
  severity: "none" | "warning" | "error" | "critical";
}

export interface AuditFailureReason {
  category: "validation" | "execution" | "output" | "permission" | "configuration";
  message: string;
  severity: "warning" | "error" | "critical";
  details?: Record<string, unknown>;
}

export interface AuditIssue {
  id: string;
  type:
    | "missing_permission"
    | "path_restriction"
    | "rate_limit"
    | "validation_error"
    | "configuration_error"
    | "tool_not_allowed"
    | "secret_missing"
    | "agent_definition_error";
  severity: "warning" | "error" | "critical";
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  remediation?: string;
}

export interface CombinedAuditManifest {
  schema_version: "1.0.0";
  generated_at: string;
  workflow_run_id: string;
  workflow_run_url: string;
  agents: AuditManifest[];
  summary: {
    total_agents: number;
    successful_agents: number;
    failed_agents: number;
    total_cost_usd: number;
    total_duration_ms: number;
  };
}
