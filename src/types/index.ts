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
