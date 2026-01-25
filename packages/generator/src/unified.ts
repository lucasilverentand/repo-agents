import type { AgentDefinition, TriggerConfig, WorkflowStep } from "@repo-agents/types";
import yaml from "js-yaml";

/**
 * Configuration for which secrets are available
 */
interface SecretsConfig {
  hasApiKey: boolean;
  hasAccessToken: boolean;
}

/**
 * GitHub Actions workflow job structure
 */
interface GitHubWorkflowJob {
  "runs-on": string;
  needs?: string | string[];
  if?: string;
  "timeout-minutes"?: number;
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  concurrency?: {
    group: string;
    "cancel-in-progress": boolean;
  };
  steps: WorkflowStep[];
}

/**
 * Complete workflow structure
 */
interface UnifiedWorkflow {
  name: string;
  on: TriggerConfig;
  concurrency?: {
    group: string;
    "cancel-in-progress": boolean | string;
  };
  permissions: Record<string, string>;
  jobs: Record<string, GitHubWorkflowJob>;
}

/**
 * Unified Workflow Generator
 *
 * Generates a single workflow file that replaces the dispatcher + per-agent workflows.
 * The unified workflow has 5 job types:
 * 1. dispatcher: Validates Claude auth, discovers agents, routes events, validates per-agent
 * 2. agent-execution: Runs Claude for validated agents (one job per agent)
 * 3. agent-outputs: Executes outputs (one job per agent with outputs)
 * 4. audit-report: Generates combined audit manifest and GitHub step summary (single job)
 * 5. audit-issues: Creates GitHub issues for failures (matrix job per failed agent)
 */
export class UnifiedWorkflowGenerator {
  /**
   * Secret configuration for the workflow
   */
  private secrets: SecretsConfig = { hasApiKey: false, hasAccessToken: false };

  /**
   * Generate the complete unified workflow YAML.
   */
  generate(agents: AgentDefinition[], secrets?: SecretsConfig): string {
    // Store secrets config for use in job generation
    this.secrets = secrets || { hasApiKey: false, hasAccessToken: false };

    // Build jobs dynamically
    const jobs: Record<string, GitHubWorkflowJob> = {
      dispatcher: this.generateDispatcherJob(agents),
    };

    // Generate individual jobs for each agent
    // Outputs are executed inline within the agent job (no separate outputs job)
    for (const agent of agents) {
      const agentSlug = this.slugifyAgentName(agent.name);
      jobs[`agent-${agentSlug}`] = this.generateAgentExecutionJob(agent, agentSlug);
    }

    // Add unified audit jobs (replaces per-agent audit jobs)
    jobs["audit-report"] = this.generateAuditReportJob(agents);
    jobs["audit-issues"] = this.generateAuditIssuesJob(agents);

    const workflow: UnifiedWorkflow = {
      name: "AI Agents",
      on: this.aggregateTriggers(agents),
      concurrency: this.generateWorkflowConcurrency(agents),
      permissions: this.aggregatePermissions(agents),
      jobs,
    };

    const yamlString = yaml.dump(workflow, {
      lineWidth: -1, // Disable line wrapping
      noRefs: true,
      quotingType: '"',
      forceQuotes: false,
    });

    return this.formatYaml(yamlString);
  }

  /**
   * Convert agent name to URL-safe slug for job names.
   */
  private slugifyAgentName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  /**
   * Aggregate triggers from all agents into a single TriggerConfig.
   */
  private aggregateTriggers(agents: AgentDefinition[]): TriggerConfig {
    const triggers: TriggerConfig = {};
    const issueTypes = new Set<string>();
    const prTypes = new Set<string>();
    const discussionTypes = new Set<string>();
    const schedules: Array<{ cron: string }> = [];
    const seenCrons = new Set<string>();
    const repoDispatchTypes = new Set<string>();
    let hasBlockingChecks = false;
    let hasInvocations = false;

    for (const agent of agents) {
      // Track if any agent has blocking checks enabled
      if (agent.pre_flight?.check_blocking_issues) {
        hasBlockingChecks = true;
      }

      // Track if any agent has invocation triggers
      if (agent.on.invocation) {
        hasInvocations = true;
      }

      // Issues
      if (agent.on.issues?.types) {
        agent.on.issues.types.forEach((t) => issueTypes.add(t));
      }

      // Pull requests
      if (agent.on.pull_request?.types) {
        agent.on.pull_request.types.forEach((t) => prTypes.add(t));
      }

      // Discussions
      if (agent.on.discussion?.types) {
        agent.on.discussion.types.forEach((t) => discussionTypes.add(t));
      }

      // Schedule - collect unique cron expressions
      if (agent.on.schedule) {
        for (const schedule of agent.on.schedule) {
          if (!seenCrons.has(schedule.cron)) {
            seenCrons.add(schedule.cron);
            schedules.push({ cron: schedule.cron });
          }
        }
      }

      // Repository dispatch types
      if (agent.on.repository_dispatch?.types) {
        agent.on.repository_dispatch.types.forEach((t) => repoDispatchTypes.add(t));
      }
    }

    // If any agent has blocking checks, listen for closed issues to auto-retry
    if (hasBlockingChecks) {
      issueTypes.add("closed");
    }

    if (issueTypes.size > 0) {
      triggers.issues = { types: Array.from(issueTypes).sort() };
    }

    if (prTypes.size > 0) {
      triggers.pull_request = { types: Array.from(prTypes).sort() };
    }

    if (discussionTypes.size > 0) {
      triggers.discussion = { types: Array.from(discussionTypes).sort() };
    }

    if (schedules.length > 0) {
      triggers.schedule = schedules;
    }

    if (repoDispatchTypes.size > 0) {
      triggers.repository_dispatch = {
        types: Array.from(repoDispatchTypes).sort(),
      };
    }

    // Add issue_comment trigger if any agent has invocation triggers
    if (hasInvocations) {
      // @ts-expect-error - issue_comment is a valid GitHub trigger but not in our TriggerConfig type
      triggers.issue_comment = { types: ["created"] };
    }

    // Always enable workflow_dispatch for manual triggering
    triggers.workflow_dispatch = {
      inputs: {
        agent: {
          description: "Specific agent to run (leave empty to auto-route)",
          required: false,
          type: "string",
        },
      },
    };

    return triggers;
  }

  /**
   * Aggregate permissions from all agents to maximum level needed.
   */
  private aggregatePermissions(agents: AgentDefinition[]): Record<string, string> {
    const permissions: Record<string, string> = {
      actions: "write", // Required for workflow operations
      contents: "read", // Default read access
      issues: "write", // For progress comments and issue creation
    };

    for (const agent of agents) {
      const agentPerms = agent.permissions || {};

      // Upgrade to write if any agent needs it
      if (agentPerms.contents === "write") {
        permissions.contents = "write";
      }
      if (agentPerms.pull_requests === "write") {
        permissions["pull-requests"] = "write";
      }
      if (agentPerms.discussions === "write") {
        permissions.discussions = "write";
      }

      // Add read permissions
      if (agentPerms.discussions && !permissions.discussions) {
        permissions.discussions = "read";
      }
    }

    return permissions;
  }

  /**
   * Generate workflow-level concurrency configuration.
   *
   * Groups workflow runs by event type AND issue/PR/discussion number to debounce
   * rapid events. When a new event occurs for the same entity, any in-progress run
   * is cancelled.
   *
   * The group includes event_name to prevent collisions between different entity types
   * (e.g., issue #100 and discussion #100 are separate number sequences in GitHub).
   *
   * For schedule/dispatch triggers, falls back to run_id so each run is independent
   * (no automatic debouncing for scheduled runs).
   */
  private generateWorkflowConcurrency(
    agents: AgentDefinition[],
  ): { group: string; "cancel-in-progress": boolean | string } | undefined {
    // Check if all agents have concurrency disabled
    const allDisabled = agents.every((a) => a.concurrency === false);
    if (allDisabled) {
      return undefined;
    }

    // Build a dynamic group that includes event type to avoid collisions
    // Issue #100 and Discussion #100 are different entities with separate number sequences
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;
    const entityId = ghExpr(
      "github.event.issue.number || github.event.pull_request.number || github.event.discussion.number || github.run_id",
    );
    const group = `agents-${ghExpr("github.event_name")}-${entityId}`;

    // Bot-triggered edit/label events should NOT cancel in-progress workflows.
    // When an agent edits/labels an issue, it triggers a new workflow. Without this,
    // the new workflow would cancel the still-running original workflow.
    // The job-level condition will skip bot-triggered workflows, but we need to
    // prevent them from cancelling the original workflow first.
    const cancelInProgress = ghExpr(
      "!(endsWith(github.actor, '[bot]') && (github.event.action == 'edited' || github.event.action == 'labeled'))",
    );

    return {
      group,
      "cancel-in-progress": cancelInProgress,
    };
  }

  /**
   * Job 1: Dispatcher - discovers, routes, and validates all agents
   * Includes global preflight check (Claude authentication) before proceeding.
   * Outputs per-agent decisions: agent-{slug}-should-run, agent-{slug}-skip-reason, etc.
   */
  private generateDispatcherJob(agents: AgentDefinition[]): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    // Build outputs for each agent
    const outputs: Record<string, string> = {};
    for (const agent of agents) {
      const slug = this.slugifyAgentName(agent.name);
      outputs[`agent-${slug}-should-run`] = ghExpr(
        `steps.dispatcher.outputs.agent-${slug}-should-run`,
      );
      outputs[`agent-${slug}-skip-reason`] = ghExpr(
        `steps.dispatcher.outputs.agent-${slug}-skip-reason`,
      );
      outputs[`agent-${slug}-event-payload`] = ghExpr(
        `steps.dispatcher.outputs.agent-${slug}-event-payload`,
      );
    }

    // Build env object with configured secrets
    const env: Record<string, string> = {
      GITHUB_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
      WORKFLOW_DISPATCH_AGENT: ghExpr("inputs.agent"),
    };
    if (this.secrets.hasApiKey) {
      env.ANTHROPIC_API_KEY = ghExpr("secrets.ANTHROPIC_API_KEY");
    }
    if (this.secrets.hasAccessToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN");
    }

    return {
      "runs-on": "ubuntu-latest",
      // Skip bot-triggered events to prevent recursive loops and self-cancellation.
      // When an agent edits/labels an issue, it triggers a new workflow run.
      // Without this check, the new run would cancel the still-running original.
      if: "!(endsWith(github.actor, '[bot]') && (github.event.action == 'edited' || github.event.action == 'labeled'))",
      outputs,
      steps: [
        {
          uses: "actions/checkout@v4",
        },
        {
          uses: "oven-sh/setup-bun@v2",
        },
        {
          name: "Install dependencies",
          run: "bun install --frozen-lockfile",
        },
        {
          name: "Dispatch agents",
          id: "dispatcher",
          run: "bun run repo-agent run dispatcher",
          env,
        },
      ],
    };
  }

  /**
   * Generate agent execution job for a specific agent
   * Checks dispatcher output and runs Claude if approved
   */
  private generateAgentExecutionJob(agent: AgentDefinition, agentSlug: string): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;
    const hasContext = !!agent.context;
    const timeout = this.getTimeoutConfig(agent);

    const steps: WorkflowStep[] = [
      {
        uses: "actions/checkout@v4",
      },
      {
        uses: "oven-sh/setup-bun@v2",
      },
      {
        name: "Install dependencies",
        run: "bun install --frozen-lockfile",
      },
      {
        uses: "actions/create-github-app-token@v1",
        id: "app-token",
        with: {
          "app-id": ghExpr("secrets.GH_APP_ID"),
          "private-key": ghExpr("secrets.GH_APP_PRIVATE_KEY"),
        },
        "continue-on-error": true,
      },
    ];

    // Add context collection if configured
    if (hasContext) {
      steps.push({
        name: "Collect context",
        run: `bun run repo-agent run context --agent "${agent.name}"`,
        "timeout-minutes": timeout.contextCollection,
        env: {
          GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
        },
      });
    }

    // Configure git identity and run agent
    steps.push(
      {
        name: "Configure git identity",
        run: [
          `git config --global user.name "${ghExpr("steps.app-token.outputs.app-slug || 'github-actions[bot]'")}"`,
          `git config --global user.email "${ghExpr("steps.app-token.outputs.app-slug || 'github-actions[bot]'")}@users.noreply.github.com"`,
        ].join("\n"),
      },
      {
        name: `Run ${agent.name}`,
        run: `bun run repo-agent run agent --agent "${agent.name}"`,
        "timeout-minutes": timeout.execution,
        env: {
          ...this.buildClaudeEnv(ghExpr),
          EVENT_PAYLOAD: ghExpr(`needs.dispatcher.outputs.agent-${agentSlug}-event-payload`),
        },
      },
    );

    // Execute outputs inline if agent has them (no separate job needed)
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: "Execute outputs",
        run: `bun run repo-agent run outputs --agent "${agent.name}"`,
        env: {
          GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
          EVENT_PAYLOAD: ghExpr(`needs.dispatcher.outputs.agent-${agentSlug}-event-payload`),
        },
      });
    }

    // Always upload audit metrics
    steps.push({
      if: "always()",
      name: "Upload audit metrics",
      uses: "actions/upload-artifact@v4",
      with: {
        name: `agent-${agentSlug}-audit-${ghExpr("github.run_id")}`,
        path: "/tmp/audit/",
        "retention-days": "7",
      },
    });

    return {
      "runs-on": "ubuntu-latest",
      needs: "dispatcher",
      if: `needs.dispatcher.outputs.agent-${agentSlug}-should-run == 'true'`,
      "timeout-minutes": timeout.total,
      steps,
    };
  }

  /**
   * Generate audit report job - single job that processes all agents
   * Downloads all audit artifacts, builds manifests, writes to GITHUB_STEP_SUMMARY
   */
  private generateAuditReportJob(agents: AgentDefinition[]): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    // Build needs array with all agent execution jobs
    const agentJobNames = agents.map((a) => `agent-${this.slugifyAgentName(a.name)}`);
    const needs = ["dispatcher", ...agentJobNames];

    return {
      "runs-on": "ubuntu-latest",
      needs,
      if: "always()",
      outputs: {
        "has-failures": ghExpr("steps.report.outputs.has-failures"),
        "failed-agents": ghExpr("steps.report.outputs.failed-agents"),
      },
      steps: [
        {
          uses: "actions/checkout@v4",
        },
        {
          uses: "oven-sh/setup-bun@v2",
        },
        {
          name: "Install dependencies",
          run: "bun install --frozen-lockfile",
        },
        {
          name: "Download all audit artifacts",
          uses: "actions/download-artifact@v4",
          with: {
            pattern: "agent-*-audit-*",
            path: "/tmp/all-audits/",
          },
          "continue-on-error": true,
        },
        {
          name: "Generate audit report",
          id: "report",
          run: "bun run repo-agent run audit-report",
          env: {
            GITHUB_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
            JOB_RESULTS: ghExpr("toJSON(needs)"),
          },
        },
        {
          name: "Write job summary",
          run: "cat /tmp/audit/summary.md >> $GITHUB_STEP_SUMMARY",
          if: "always()",
          "continue-on-error": true,
        },
        {
          name: "Upload audit manifest",
          uses: "actions/upload-artifact@v4",
          with: {
            name: `audit-manifest-${ghExpr("github.run_id")}`,
            path: "/tmp/audit/",
            "retention-days": "30",
          },
          if: "always()",
        },
      ],
    };
  }

  /**
   * Generate audit issues job - matrix job for each failed agent
   * Creates or updates GitHub issues for failures
   */
  private generateAuditIssuesJob(_agents: AgentDefinition[]): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    return {
      "runs-on": "ubuntu-latest",
      needs: ["audit-report"],
      if: `always() && needs.audit-report.outputs.has-failures == 'true'`,
      strategy: {
        matrix: {
          agent: ghExpr("fromJSON(needs.audit-report.outputs.failed-agents)"),
        },
        "fail-fast": false,
      },
      steps: [
        {
          uses: "actions/checkout@v4",
        },
        {
          uses: "oven-sh/setup-bun@v2",
        },
        {
          name: "Install dependencies",
          run: "bun install --frozen-lockfile",
        },
        {
          uses: "actions/create-github-app-token@v1",
          id: "app-token",
          with: {
            "app-id": ghExpr("secrets.GH_APP_ID"),
            "private-key": ghExpr("secrets.GH_APP_PRIVATE_KEY"),
          },
          "continue-on-error": true,
        },
        {
          name: "Download audit manifest",
          uses: "actions/download-artifact@v4",
          with: {
            name: `audit-manifest-${ghExpr("github.run_id")}`,
            path: "/tmp/audit/",
          },
        },
        {
          name: "Create failure issue",
          run: `bun run repo-agent run audit-issues --agent "${ghExpr("matrix.agent")}"`,
          env: {
            GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
            MATRIX_AGENT: ghExpr("matrix.agent"),
          },
        },
      ],
    };
  }

  /**
   * Build environment variables for Claude authentication.
   * Only includes secrets that are configured.
   */
  private buildClaudeEnv(ghExpr: (expr: string) => string): Record<string, string> {
    const env: Record<string, string> = {
      GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
    };

    if (this.secrets.hasApiKey) {
      env.ANTHROPIC_API_KEY = ghExpr("secrets.ANTHROPIC_API_KEY");
    }
    if (this.secrets.hasAccessToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN");
    }

    return env;
  }

  /**
   * Get timeout configuration for an agent.
   * Returns resolved timeout values with defaults.
   */
  private getTimeoutConfig(agent: AgentDefinition): {
    execution: number;
    total: number;
    contextCollection: number;
  } {
    const defaults = {
      execution: 30,
      total: 45,
      contextCollection: 5,
    };

    if (!agent.timeout) {
      return defaults;
    }

    if (typeof agent.timeout === "number") {
      // Simple number: treat as execution timeout, derive total
      return {
        execution: agent.timeout,
        total: agent.timeout + 15, // Add 15 minutes for setup/teardown
        contextCollection: defaults.contextCollection,
      };
    }

    // Detailed config object
    return {
      execution: agent.timeout.execution ?? defaults.execution,
      total: agent.timeout.total ?? (agent.timeout.execution ?? defaults.execution) + 15,
      contextCollection: agent.timeout.context_collection ?? defaults.contextCollection,
    };
  }

  /**
   * Format YAML output for better readability.
   */
  private formatYaml(yamlContent: string): string {
    const lines = yamlContent.split("\n");
    const formatted: string[] = [];
    let previousLineWasStep = false;
    let inJobs = false;
    let inSteps = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track when we enter jobs section
      if (line === "jobs:") {
        inJobs = true;
        formatted.push(line);
        continue;
      }

      // Check if this is a job key (2 spaces indentation, ends with colon)
      const isJobKey = inJobs && /^\s{2}[a-z-]+:$/.test(line);

      // Check if entering steps section
      if (trimmed === "steps:") {
        inSteps = true;
        formatted.push(line);
        previousLineWasStep = false;
        continue;
      }

      // Check if exiting steps section
      if (inSteps && /^\s{2}[a-z-]+:$/.test(line)) {
        inSteps = false;
      }

      // Add blank line before job keys (except the very first one after "jobs:")
      if (isJobKey) {
        const lastNonEmptyLine = formatted.filter((l) => l.trim() !== "").pop();
        if (lastNonEmptyLine && lastNonEmptyLine !== "jobs:") {
          formatted.push("");
        }
        formatted.push(line);
        previousLineWasStep = false;
        continue;
      }

      // Add blank line before each step (except the first one)
      const isStepStart = inSteps && /^\s{4}-\s/.test(line);
      if (isStepStart && previousLineWasStep) {
        formatted.push("");
      }

      formatted.push(line);
      previousLineWasStep = isStepStart;
    }

    return formatted.join("\n");
  }
}

// Export singleton instance
export const unifiedWorkflowGenerator = new UnifiedWorkflowGenerator();
