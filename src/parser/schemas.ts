import { z } from 'zod';

const workflowInputSchema = z.object({
  description: z.string(),
  required: z.boolean().optional(),
  default: z.string().optional(),
  type: z.enum(['string', 'boolean', 'choice']).optional(),
  options: z.array(z.string()).optional(),
});

const triggerConfigSchema = z.object({
  issues: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  pull_request: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  discussion: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  schedule: z
    .array(
      z.object({
        cron: z.string(),
      })
    )
    .optional(),
  workflow_dispatch: z
    .object({
      inputs: z.record(workflowInputSchema).optional(),
    })
    .optional(),
  repository_dispatch: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
});

const permissionsSchema = z
  .object({
    contents: z.enum(['read', 'write']).optional(),
    issues: z.enum(['read', 'write']).optional(),
    pull_requests: z.enum(['read', 'write']).optional(),
    discussions: z.enum(['read', 'write']).optional(),
  })
  .optional();

const claudeConfigSchema = z
  .object({
    model: z.string().optional(),
    max_tokens: z.number().optional(),
    temperature: z.number().min(0).max(1).optional(),
  })
  .optional();

const outputConfigSchema = z
  .object({
    max: z.number().optional(),
    sign: z.boolean().optional(),
  })
  .passthrough(); // Allow additional properties

const outputSchema = z
  .record(
    z.enum([
      'add-comment',
      'add-label',
      'remove-label',
      'create-issue',
      'create-discussion',
      'create-pr',
      'update-file',
      'close-issue',
      'close-pr',
    ]),
    z.union([outputConfigSchema, z.boolean()])
  )
  .optional();

const toolSchema = z
  .array(
    z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.unknown()).optional(),
    })
  )
  .optional();

const issuesInputSchema = z
  .object({
    states: z.array(z.enum(['open', 'closed', 'all'])).optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    creators: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    milestones: z.array(z.string()).optional(),
    exclude_labels: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const pullRequestsInputSchema = z
  .object({
    states: z.array(z.enum(['open', 'closed', 'merged', 'all'])).optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    creators: z.array(z.string()).optional(),
    reviewers: z.array(z.string()).optional(),
    base_branch: z.string().optional(),
    head_branch: z.string().optional(),
    exclude_labels: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const discussionsInputSchema = z
  .object({
    categories: z.array(z.string()).optional(),
    answered: z.boolean().optional(),
    unanswered: z.boolean().optional(),
    labels: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const commitsInputSchema = z
  .object({
    branches: z.array(z.string()).optional(),
    authors: z.array(z.string()).optional(),
    exclude_authors: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const releasesInputSchema = z
  .object({
    prerelease: z.boolean().optional(),
    draft: z.boolean().optional(),
    limit: z.number().min(1).max(100).optional(),
  })
  .optional();

const workflowRunsInputSchema = z
  .object({
    workflows: z.array(z.string()).optional(),
    status: z.array(z.enum(['success', 'failure', 'cancelled', 'skipped'])).optional(),
    branches: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const inputConfigSchema = z
  .object({
    issues: issuesInputSchema,
    pull_requests: pullRequestsInputSchema,
    discussions: discussionsInputSchema,
    commits: commitsInputSchema,
    releases: releasesInputSchema,
    workflow_runs: workflowRunsInputSchema,
    stars: z.boolean().optional(),
    forks: z.boolean().optional(),
    since: z.string().optional(),
    min_items: z.number().min(0).optional(),
  })
  .optional();

const auditConfigSchema = z
  .object({
    // Whether to create issues on failures (default: true)
    create_issues: z.boolean().optional(),
    // Labels to add to audit issues
    labels: z.array(z.string()).optional(),
    // Assignees for audit issues
    assignees: z.array(z.string()).optional(),
  })
  .optional();

export const agentFrontmatterSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  on: triggerConfigSchema,
  permissions: permissionsSchema,
  claude: claudeConfigSchema,
  outputs: outputSchema,
  tools: toolSchema,
  'allowed-actors': z.array(z.string()).optional(),
  'allowed-users': z.array(z.string()).optional(),
  'allowed-teams': z.array(z.string()).optional(),
  'allowed-paths': z.array(z.string()).optional(),
  trigger_labels: z.array(z.string()).optional(),
  rate_limit_minutes: z.number().min(0).optional(),
  inputs: inputConfigSchema,
  audit: auditConfigSchema,
});

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
