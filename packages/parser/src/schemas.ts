import { z } from "zod";

const workflowInputSchema = z.object({
  description: z.string(),
  required: z.boolean().optional(),
  default: z.string().optional(),
  type: z.enum(["string", "boolean", "choice"]).optional(),
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
      }),
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
    contents: z.enum(["read", "write"]).optional(),
    issues: z.enum(["read", "write"]).optional(),
    pull_requests: z.enum(["read", "write"]).optional(),
    discussions: z.enum(["read", "write"]).optional(),
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
      "add-comment",
      "add-label",
      "remove-label",
      "create-issue",
      "create-discussion",
      "create-pr",
      "update-file",
      "close-issue",
      "close-pr",
      "assign-issue",
      "request-review",
      "merge-pr",
      "approve-pr",
      "create-release",
      "delete-branch",
      "lock-conversation",
      "pin-issue",
      "convert-to-discussion",
      "edit-issue",
      "reopen-issue",
      "set-milestone",
      "trigger-workflow",
      "add-reaction",
      "create-branch",
    ]),
    z.union([outputConfigSchema, z.boolean()]),
  )
  .optional();

const toolSchema = z
  .array(
    z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.unknown()).optional(),
    }),
  )
  .optional();

const issuesContextSchema = z
  .object({
    states: z.array(z.enum(["open", "closed", "all"])).optional(),
    labels: z.array(z.string()).optional(),
    assignees: z.array(z.string()).optional(),
    creators: z.array(z.string()).optional(),
    mentions: z.array(z.string()).optional(),
    milestones: z.array(z.string()).optional(),
    exclude_labels: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const pullRequestsContextSchema = z
  .object({
    states: z.array(z.enum(["open", "closed", "merged", "all"])).optional(),
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

const discussionsContextSchema = z
  .object({
    categories: z.array(z.string()).optional(),
    answered: z.boolean().optional(),
    unanswered: z.boolean().optional(),
    labels: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const commitsContextSchema = z
  .object({
    branches: z.array(z.string()).optional(),
    authors: z.array(z.string()).optional(),
    exclude_authors: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const releasesContextSchema = z
  .object({
    prerelease: z.boolean().optional(),
    draft: z.boolean().optional(),
    limit: z.number().min(1).max(100).optional(),
  })
  .optional();

const workflowRunsContextSchema = z
  .object({
    workflows: z.array(z.string()).optional(),
    status: z.array(z.enum(["success", "failure", "cancelled", "skipped"])).optional(),
    branches: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const securityAlertsContextSchema = z
  .object({
    severity: z.array(z.enum(["critical", "high", "medium", "low"])).optional(),
    state: z.array(z.enum(["open", "fixed", "dismissed"])).optional(),
    ecosystem: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const dependabotPRsContextSchema = z
  .object({
    states: z.array(z.enum(["open", "closed", "merged"])).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const codeScanningAlertsContextSchema = z
  .object({
    severity: z
      .array(z.enum(["critical", "high", "medium", "low", "warning", "note", "error"]))
      .optional(),
    state: z.array(z.enum(["open", "fixed", "dismissed"])).optional(),
    tool: z.array(z.string()).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const deploymentsContextSchema = z
  .object({
    environments: z.array(z.string()).optional(),
    states: z.array(z.enum(["success", "failure", "error", "pending", "in_progress"])).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const milestonesContextSchema = z
  .object({
    states: z.array(z.enum(["open", "closed", "all"])).optional(),
    sort: z.enum(["due_on", "completeness"]).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const contributorsContextSchema = z
  .object({
    limit: z.number().min(1).max(1000).optional(),
    since: z.string().optional(),
  })
  .optional();

const commentsContextSchema = z
  .object({
    issue_comments: z.boolean().optional(),
    pr_comments: z.boolean().optional(),
    pr_review_comments: z.boolean().optional(),
    discussion_comments: z.boolean().optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const repositoryTrafficContextSchema = z
  .object({
    views: z.boolean().optional(),
    clones: z.boolean().optional(),
    referrers: z.boolean().optional(),
    paths: z.boolean().optional(),
  })
  .optional();

const branchesContextSchema = z
  .object({
    protected: z.boolean().optional(),
    stale_days: z.number().min(1).optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const checkRunsContextSchema = z
  .object({
    workflows: z.array(z.string()).optional(),
    status: z
      .array(z.enum(["success", "failure", "neutral", "cancelled", "skipped", "timed_out"]))
      .optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const contextConfigSchema = z
  .object({
    issues: issuesContextSchema,
    pull_requests: pullRequestsContextSchema,
    discussions: discussionsContextSchema,
    commits: commitsContextSchema,
    releases: releasesContextSchema,
    workflow_runs: workflowRunsContextSchema,
    security_alerts: securityAlertsContextSchema,
    dependabot_prs: dependabotPRsContextSchema,
    code_scanning_alerts: codeScanningAlertsContextSchema,
    deployments: deploymentsContextSchema,
    milestones: milestonesContextSchema,
    contributors: contributorsContextSchema,
    comments: commentsContextSchema,
    repository_traffic: repositoryTrafficContextSchema,
    branches: branchesContextSchema,
    check_runs: checkRunsContextSchema,
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
  name: z.string().min(1, "Agent name is required"),
  on: triggerConfigSchema,
  permissions: permissionsSchema,
  provider: z.enum(["claude-code", "opencode"]).optional(),
  claude: claudeConfigSchema,
  outputs: outputSchema,
  tools: toolSchema,
  "allowed-actors": z.array(z.string()).optional(),
  "allowed-users": z.array(z.string()).optional(),
  "allowed-teams": z.array(z.string()).optional(),
  "allowed-paths": z.array(z.string()).optional(),
  trigger_labels: z.array(z.string()).optional(),
  max_open_prs: z.number().min(1).optional(),
  rate_limit_minutes: z.number().min(0).optional(),
  context: contextConfigSchema,
  audit: auditConfigSchema,
});

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
