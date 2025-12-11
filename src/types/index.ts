export interface AgentDefinition {
  name: string;
  on: TriggerConfig;
  permissions?: PermissionsConfig;
  claude?: ClaudeConfig;
  outputs?: Record<string, OutputConfig | boolean>;
  tools?: Tool[];
  allowedActors?: string[];
  allowedUsers?: string[];  // Alias for allowedActors (explicit user list)
  allowedTeams?: string[];
  allowedPaths?: string[];
  triggerLabels?: string[];  // Labels that must be present to trigger the agent
  rateLimitMinutes?: number; // Minimum minutes between agent runs (default: 5)
  inputs?: InputConfig; // Data collection configuration
  markdown: string;
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
  maxTokens?: number;
  temperature?: number;
}

export type Output =
  | 'add-comment'
  | 'add-label'
  | 'remove-label'
  | 'create-issue'
  | 'create-pr'
  | 'update-file'
  | 'close-issue'
  | 'close-pr';

export interface OutputConfig {
  max?: number;      // Maximum times this output can be used
  sign?: boolean;    // Whether to sign commits (for code changes)
  [key: string]: any;  // Allow custom settings
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
  with?: Record<string, string>;
  run?: string;
  env?: Record<string, string>;
  if?: string;
}

// Input Configuration Types
export interface InputConfig {
  issues?: IssuesInputConfig;
  pullRequests?: PullRequestsInputConfig;
  discussions?: DiscussionsInputConfig;
  commits?: CommitsInputConfig;
  releases?: ReleasesInputConfig;
  workflowRuns?: WorkflowRunsInputConfig;
  stars?: boolean;
  forks?: boolean;
  since?: string; // Time filter: "last-run", "1h", "24h", "7d", etc. (default: "last-run")
  minItems?: number; // Minimum total items to trigger agent (default: 1)
}

export interface IssuesInputConfig {
  states?: ('open' | 'closed' | 'all')[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  mentions?: string[];
  milestones?: string[];
  excludeLabels?: string[];
  limit?: number; // Max items to fetch (default: 100)
}

export interface PullRequestsInputConfig {
  states?: ('open' | 'closed' | 'merged' | 'all')[];
  labels?: string[];
  assignees?: string[];
  creators?: string[];
  reviewers?: string[];
  baseBranch?: string;
  headBranch?: string;
  excludeLabels?: string[];
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
  excludeAuthors?: string[];
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
  pullRequests?: GitHubPullRequest[];
  discussions?: GitHubDiscussion[];
  commits?: GitHubCommit[];
  releases?: GitHubRelease[];
  workflowRuns?: GitHubWorkflowRun[];
  stars?: number;
  forks?: number;
  totalItems: number;
  collectedAt: string;
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
