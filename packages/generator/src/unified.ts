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
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  steps: WorkflowStep[];
}

/**
 * Complete workflow structure
 */
interface UnifiedWorkflow {
  name: string;
  on: TriggerConfig;
  permissions: Record<string, string>;
  jobs: Record<string, GitHubWorkflowJob>;
}

/**
 * Unified Workflow Generator
 *
 * Generates a single workflow file that replaces the dispatcher + per-agent workflows.
 * The unified workflow has 6 jobs:
 * 1. global-preflight: Validates Claude auth
 * 2. route-event: Discovers agents and matches to current event
 * 3. agent-validation: Per-agent validation (matrix)
 * 4. agent-execution: Runs Claude for validated agents (matrix)
 * 5. execute-outputs: Executes outputs (matrix)
 * 6. audit-report: Generates audit reports (matrix)
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
      "global-preflight": this.generateGlobalPreflightJob(),
      dispatcher: this.generateDispatcherJob(agents),
    };

    // Generate individual jobs for each agent
    for (const agent of agents) {
      const agentSlug = this.slugifyAgentName(agent.name);

      // Agent execution job
      jobs[`agent-${agentSlug}`] = this.generateAgentExecutionJob(agent, agentSlug);

      // Agent outputs job (if agent has outputs)
      if (agent.outputs && Object.keys(agent.outputs).length > 0) {
        jobs[`agent-${agentSlug}-outputs`] = this.generateAgentOutputsJob(agent, agentSlug);
      }

      // Agent audit job (always runs)
      jobs[`agent-${agentSlug}-audit`] = this.generateAgentAuditJob(agent, agentSlug);
    }

    const workflow: UnifiedWorkflow = {
      name: "AI Agents",
      on: this.aggregateTriggers(agents),
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

    for (const agent of agents) {
      // Track if any agent has blocking checks enabled
      if (agent.pre_flight?.check_blocking_issues) {
        hasBlockingChecks = true;
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
   * Job 1: Global preflight - validates Claude auth
   */
  private generateGlobalPreflightJob(): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    // Build env object with only configured secrets
    const env: Record<string, string> = {};
    if (this.secrets.hasApiKey) {
      env.ANTHROPIC_API_KEY = ghExpr("secrets.ANTHROPIC_API_KEY");
    }
    if (this.secrets.hasAccessToken) {
      env.CLAUDE_CODE_OAUTH_TOKEN = ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN");
    }

    return {
      "runs-on": "ubuntu-latest",
      outputs: {
        "should-continue": ghExpr("steps.validate.outputs.should-continue"),
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
          name: "Validate Claude authentication",
          id: "validate",
          run: "bun run repo-agent run setup:preflight",
          env,
        },
      ],
    };
  }

  /**
   * Job 2: Dispatcher - discovers, routes, and validates all agents
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
      outputs[`agent-${slug}-target-issue`] = ghExpr(
        `steps.dispatcher.outputs.agent-${slug}-target-issue`,
      );
      outputs[`agent-${slug}-event-payload`] = ghExpr(
        `steps.dispatcher.outputs.agent-${slug}-event-payload`,
      );
    }

    return {
      "runs-on": "ubuntu-latest",
      needs: "global-preflight",
      if: `needs.global-preflight.outputs.should-continue == 'true'`,
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
          env: {
            GITHUB_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
            WORKFLOW_DISPATCH_AGENT: ghExpr("inputs.agent"),
          },
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
        env: {
          ...this.buildClaudeEnv(ghExpr),
          EVENT_PAYLOAD: ghExpr(`needs.dispatcher.outputs.agent-${agentSlug}-event-payload`),
        },
      },
    );

    // Upload outputs if agent has them
    if (agent.outputs && Object.keys(agent.outputs).length > 0) {
      steps.push({
        name: "Upload outputs",
        uses: "actions/upload-artifact@v4",
        with: {
          name: `agent-${agentSlug}-outputs-${ghExpr("github.run_id")}`,
          path: "/tmp/outputs/",
          "retention-days": "7",
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
      needs: ["global-preflight", "dispatcher"],
      if: `needs.dispatcher.outputs.agent-${agentSlug}-should-run == 'true'`,
      steps,
    };
  }

  /**
   * Generate outputs execution job for a specific agent
   * Executes all configured outputs for the agent
   */
  private generateAgentOutputsJob(agent: AgentDefinition, agentSlug: string): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    return {
      "runs-on": "ubuntu-latest",
      needs: [`agent-${agentSlug}`],
      if: `needs.agent-${agentSlug}.result == 'success'`,
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
          name: "Download outputs",
          uses: "actions/download-artifact@v4",
          with: {
            name: `agent-${agentSlug}-outputs-${ghExpr("github.run_id")}`,
            path: "/tmp/outputs/",
          },
          "continue-on-error": true,
        },
        {
          name: "Execute outputs",
          run: `bun run repo-agent run outputs --agent "${agent.name}"`,
          env: {
            GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
            TARGET_ISSUE_NUMBER: ghExpr(`needs.dispatcher.outputs.agent-${agentSlug}-target-issue`),
          },
        },
      ],
    };
  }

  /**
   * Generate audit job for a specific agent
   * Generates audit report and creates issue if configured
   */
  private generateAgentAuditJob(agent: AgentDefinition, agentSlug: string): GitHubWorkflowJob {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    return {
      "runs-on": "ubuntu-latest",
      needs: ["dispatcher", `agent-${agentSlug}`],
      if: `always() && needs.dispatcher.outputs.agent-${agentSlug}-should-run == 'true'`,
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
          name: "Download audit metrics",
          uses: "actions/download-artifact@v4",
          with: {
            name: `agent-${agentSlug}-audit-${ghExpr("github.run_id")}`,
            path: "/tmp/artifacts/",
          },
          "continue-on-error": true,
        },
        {
          name: "Generate audit report",
          run: `bun run repo-agent run audit --agent "${agent.name}"`,
          env: {
            GH_TOKEN: ghExpr("steps.app-token.outputs.token || secrets.GITHUB_TOKEN"),
            AGENT_RESULT: ghExpr(`needs.agent-${agentSlug}.result`),
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
