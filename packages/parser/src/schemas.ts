import { z } from "zod";

const workflowInputSchema = z.object({
  description: z.string(),
  required: z.boolean().optional(),
  default: z.string().optional(),
  type: z.enum(["string", "boolean", "choice"]).optional(),
  options: z.array(z.string()).optional(),
});

const invocationConfigSchema = z.object({
  command: z.string().min(1), // Command name (without leading /)
  description: z.string().optional(), // Description shown in /help
  aliases: z.array(z.string()).optional(), // Alternative command names
  allowed_users: z.array(z.string()).optional(), // Users who can invoke
  allowed_teams: z.array(z.string()).optional(), // Teams who can invoke
});

const triggerConfigSchema = z.strictObject({
  issues: z
    .strictObject({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  pull_request: z
    .strictObject({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  discussion: z
    .strictObject({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  schedule: z
    .array(
      z.strictObject({
        cron: z.string(),
      }),
    )
    .optional(),
  workflow_dispatch: z
    .strictObject({
      inputs: z.record(z.string(), workflowInputSchema).optional(),
    })
    .optional(),
  repository_dispatch: z
    .strictObject({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  invocation: z.union([invocationConfigSchema, z.array(invocationConfigSchema)]).optional(),
});

const permissionsSchema = z
  .strictObject({
    contents: z.enum(["read", "write"]).optional(),
    issues: z.enum(["read", "write"]).optional(),
    pull_requests: z.enum(["read", "write"]).optional(),
    discussions: z.enum(["read", "write"]).optional(),
  })
  .optional();

const outputConfigSchema = z.looseObject({
  max: z.number().optional(),
  sign: z.boolean().optional(),
}); // Allow additional properties

const outputSchema = z
  .partialRecord(
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
      "copy-project",
      "mark-template",
      "manage-labels",
      "add-to-project",
      "remove-from-project",
      "update-project-field",
      "archive-project-item",
      "manage-project",
      "manage-project-field",
      "link-project",
    ]),
    z.union([outputConfigSchema, z.boolean()]),
  )
  .optional();

const toolSchema = z
  .array(
    z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.string(), z.unknown()).optional(),
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

const projectContextSchema = z
  .object({
    project_number: z.number().min(1).optional(),
    project_id: z.string().optional(),
    owner: z.string().optional(),
    include_items: z.boolean().optional(),
    include_fields: z.boolean().optional(),
    filters: z
      .object({
        status: z.array(z.string()).optional(),
        assignee: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
      })
      .optional(),
    limit: z.number().min(1).max(1000).optional(),
  })
  .optional();

const apiDocumentationConfigSchema = z
  .object({
    sources: z.array(z.string()).min(1),
    output: z.string().min(1),
    format: z.enum(["markdown", "json", "html"]).optional(),
    include_private: z.boolean().optional(),
    include_internal: z.boolean().optional(),
  })
  .optional();

const readmeSectionConfigSchema = z.object({
  section: z.string().min(1),
  source: z.string().optional(),
  template: z.string().optional(),
});

const readmeMaintenanceConfigSchema = z
  .object({
    path: z.string().optional(),
    sections: z.array(readmeSectionConfigSchema),
    preserve_custom: z.boolean().optional(),
  })
  .optional();

const changelogConfigSchema = z
  .object({
    path: z.string().optional(),
    format: z.enum(["keep-a-changelog", "conventional", "custom"]).optional(),
    include_prs: z.boolean().optional(),
    include_commits: z.boolean().optional(),
    categories: z.array(z.string()).optional(),
    exclude_labels: z.array(z.string()).optional(),
  })
  .optional();

const driftDetectionPairSchema = z.object({
  code: z.string().min(1),
  docs: z.string().min(1),
  threshold: z.number().min(1).optional(),
});

const driftDetectionConfigSchema = z
  .object({
    enabled: z.boolean(),
    pairs: z.array(driftDetectionPairSchema),
    create_issues: z.boolean().optional(),
    labels: z.array(z.string()).optional(),
  })
  .optional();

const documentationConfigSchema = z
  .object({
    api: apiDocumentationConfigSchema,
    readme: readmeMaintenanceConfigSchema,
    changelog: changelogConfigSchema,
    drift_detection: driftDetectionConfigSchema,
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
    project: projectContextSchema,
    documentation: documentationConfigSchema,
    stars: z.boolean().optional(),
    forks: z.boolean().optional(),
    since: z.string().optional(),
    min_items: z.number().min(0).optional(),
    project_id: z.string().optional(),
    include_dependencies: z.boolean().optional(),
    include_custom_fields: z.array(z.string()).optional(),
  })
  .optional();

const preFlightConfigSchema = z
  .object({
    check_blocking_issues: z.boolean().optional(),
    max_estimate: z.number().min(1).optional(),
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

const concurrencyConfigSchema = z
  .union([
    z.object({
      // Custom concurrency group (supports GitHub expressions like ${{ github.event.issue.number }})
      group: z.string().optional(),
      // Whether to cancel in-progress runs when a new one starts (default: true)
      cancel_in_progress: z.boolean().optional(),
    }),
    // Disable concurrency entirely
    z.literal(false),
  ])
  .optional();

const timeoutConfigSchema = z
  .union([
    // Simple number: execution timeout in minutes
    z
      .number()
      .min(1)
      .max(360),
    // Detailed config object
    z.object({
      // Agent execution timeout in minutes (default: 30)
      execution: z.number().min(1).max(360).optional(),
      // Total job timeout in minutes (default: 45)
      total: z.number().min(1).max(360).optional(),
      // Context collection timeout in minutes (default: 5)
      context_collection: z.number().min(1).max(60).optional(),
    }),
  ])
  .optional();

// Tracing configuration schema
const tracingConfigSchema = z
  .object({
    // Trace level: summary (default), detailed, or debug
    level: z.enum(["summary", "detailed", "debug"]).optional(),
    // How long to keep traces (e.g., "7d")
    retention: z
      .string()
      .regex(/^\d+[hdwm]$/, "Retention must be in format: number + h/d/w/m (e.g., '7d', '30d')")
      .optional(),
    // What to include in traces
    include: z
      .array(z.enum(["tool-calls", "decisions", "timing", "file-reads", "file-writes"]))
      .optional(),
    // What to exclude from traces
    exclude: z.array(z.enum(["sensitive-data", "full-file-contents", "secrets"])).optional(),
    // Redaction settings
    redact: z
      .object({
        secrets: z.boolean().optional(), // Redact secrets (default: true)
        patterns: z.array(z.string()).optional(), // Custom regex patterns to redact
        file_contents_over: z.number().min(1).optional(), // Truncate file contents over N lines
      })
      .optional(),
  })
  .optional();

// Deduplication configuration schemas
const eventDeduplicationSchema = z
  .object({
    // Enable event deduplication (default: true when configured)
    enabled: z.boolean().optional(),
    // Time window for deduplication (e.g., "1h", "24h", "7d")
    window: z
      .string()
      .regex(/^\d+[hdwm]$/, "Window must be in format: number + h/d/w/m (e.g., '1h', '24h', '7d')")
      .optional(),
    // Custom deduplication key fields
    key: z.array(z.string()).optional(),
  })
  .optional();

const actionDeduplicationSchema = z
  .object({
    // Enable action deduplication (default: true when configured)
    enabled: z.boolean().optional(),
    // Time window for deduplication
    window: z
      .string()
      .regex(/^\d+[hdwm]$/, "Window must be in format: number + h/d/w/m (e.g., '24h', '7d')")
      .optional(),
    // How to match actions: exact or similar (content-based)
    match: z.enum(["exact", "similar"]).optional(),
  })
  .optional();

const deduplicationConfigSchema = z
  .object({
    // Event-level deduplication
    events: eventDeduplicationSchema,
    // Action-level deduplication (can be global or per-action type)
    actions: z
      .union([actionDeduplicationSchema, z.record(z.string(), actionDeduplicationSchema)])
      .optional(),
  })
  .optional();

export const agentFrontmatterSchema = z.strictObject({
  name: z.string().min(1, { message: "Agent name is required" }),
  on: triggerConfigSchema,
  permissions: permissionsSchema,
  provider: z.enum(["claude-code", "opencode"]).optional(),
  outputs: outputSchema,
  tools: toolSchema,
  "allowed-actors": z.array(z.string()).optional(),
  "allowed-users": z.array(z.string()).optional(),
  "allowed-teams": z.array(z.string()).optional(),
  "allowed-paths": z.array(z.string()).optional(),
  trigger_labels: z.array(z.string()).optional(),
  skip_labels: z.array(z.string()).optional(),
  max_open_prs: z.number().min(1).optional(),
  rate_limit_minutes: z.number().min(0).optional(),
  pre_flight: preFlightConfigSchema,
  context: contextConfigSchema,
  audit: auditConfigSchema,
  progress_comment: z.boolean().optional(), // Show progress comment on issue/PR (default: true for issue/PR triggers)
  allow_bot_triggers: z.boolean().optional(), // Allow bot/app actors to trigger this agent (default: false, prevents recursive loops)
  exclude_bot_issues: z.boolean().optional(), // Skip issues/PRs authored by bots (default: false)
  concurrency: concurrencyConfigSchema, // Concurrency settings for debouncing (default: auto-generated based on trigger)
  timeout: timeoutConfigSchema, // Execution timeout in minutes or detailed config
  tracing: tracingConfigSchema, // Execution tracing configuration
  deduplication: deduplicationConfigSchema, // Smart deduplication to prevent redundant actions
}); // Reject unknown properties

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
