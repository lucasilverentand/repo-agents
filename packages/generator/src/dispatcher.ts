import { agentNameToWorkflowName } from "@repo-agents/cli-utils";
import type {
  AgentDefinition,
  RoutingRule,
  TriggerConfig,
  TriggerEventType,
  WorkflowStep,
} from "@repo-agents/types";
import yaml from "js-yaml";

interface DispatcherWorkflowJob {
  "runs-on": string;
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  steps: WorkflowStep[];
}

interface DispatcherWorkflow {
  name: string;
  on: TriggerConfig;
  permissions: Record<string, string>;
  jobs: Record<string, DispatcherWorkflowJob>;
}

export class DispatcherGenerator {
  /**
   * Aggregate triggers from all agents into a single TriggerConfig.
   * Event types are unioned (e.g., issues: [opened, labeled] from multiple agents).
   * Schedules are collected as unique cron expressions.
   */
  aggregateTriggers(agents: AgentDefinition[]): TriggerConfig {
    const triggers: TriggerConfig = {};
    const issueTypes = new Set<string>();
    const prTypes = new Set<string>();
    const discussionTypes = new Set<string>();
    const schedules: Array<{ cron: string }> = [];
    const seenCrons = new Set<string>();
    const repoDispatchTypes = new Set<string>();

    for (const agent of agents) {
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
      triggers.repository_dispatch = { types: Array.from(repoDispatchTypes).sort() };
    }

    // Always add workflow_dispatch for manual runs with optional agent selection
    triggers.workflow_dispatch = {
      inputs: {
        agent: {
          description: "Specific agent to run (leave empty to auto-route based on event)",
          required: false,
          type: "string",
        },
      },
    };

    return triggers;
  }

  /**
   * Get the relative path to an agent markdown file from the repository root.
   */
  private getAgentFilePath(agentName: string): string {
    const fileName = agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `.github/agents/${fileName}.md`;
  }

  /**
   * Generate routing rules that map events to agent workflows.
   */
  generateRoutingTable(agents: AgentDefinition[]): RoutingRule[] {
    const rules: RoutingRule[] = [];

    for (const agent of agents) {
      const rule: RoutingRule = {
        agentName: agent.name,
        agentPath: this.getAgentFilePath(agent.name),
        workflowFile: `${agentNameToWorkflowName(agent.name)}.yml`,
        triggers: [],
      };

      // Issues
      if (agent.on.issues?.types) {
        rule.triggers.push({
          eventType: "issues" as TriggerEventType,
          eventActions: agent.on.issues.types,
        });
      }

      // Pull requests
      if (agent.on.pull_request?.types) {
        rule.triggers.push({
          eventType: "pull_request" as TriggerEventType,
          eventActions: agent.on.pull_request.types,
        });
      }

      // Discussions
      if (agent.on.discussion?.types) {
        rule.triggers.push({
          eventType: "discussion" as TriggerEventType,
          eventActions: agent.on.discussion.types,
        });
      }

      // Schedule - one entry per cron expression
      if (agent.on.schedule) {
        for (const schedule of agent.on.schedule) {
          rule.triggers.push({
            eventType: "schedule" as TriggerEventType,
            schedule: schedule.cron,
          });
        }
      }

      // Repository dispatch
      if (agent.on.repository_dispatch?.types) {
        rule.triggers.push({
          eventType: "repository_dispatch" as TriggerEventType,
          dispatchTypes: agent.on.repository_dispatch.types,
        });
      }

      // Workflow dispatch - all agents can be manually triggered
      rule.triggers.push({
        eventType: "workflow_dispatch" as TriggerEventType,
      });

      rules.push(rule);
    }

    return rules;
  }

  /**
   * Aggregate permissions from all agents.
   */
  private aggregatePermissions(agents: AgentDefinition[]): Record<string, string> {
    const permissions: Record<string, string> = {
      actions: "write", // Required to trigger workflows
      contents: "read", // Default read access
      issues: "write", // Required for self-healing issue creation
    };

    for (const agent of agents) {
      if (agent.permissions) {
        for (const [key, value] of Object.entries(agent.permissions)) {
          const kebabKey = key.replace(/_/g, "-");
          // Upgrade to write if any agent needs write
          if (value === "write" || permissions[kebabKey] !== "write") {
            permissions[kebabKey] = value;
          }
        }
      }
    }

    return permissions;
  }

  /**
   * Generate the dispatcher workflow YAML.
   */
  generate(agents: AgentDefinition[]): string {
    const triggers = this.aggregateTriggers(agents);
    const permissions = this.aggregatePermissions(agents);

    const workflow: DispatcherWorkflow = {
      name: "Claude Agent Dispatcher",
      on: triggers,
      permissions,
      jobs: {
        "pre-flight": {
          "runs-on": "ubuntu-latest",
          outputs: {
            "should-continue": "${{ steps.global-preflight.outputs.should-continue }}",
            "app-token": "${{ steps.global-preflight.outputs.app-token }}",
            "git-user": "${{ steps.global-preflight.outputs.git-user }}",
            "git-email": "${{ steps.global-preflight.outputs.git-email }}",
          },
          steps: this.generatePreFlightSteps(),
        },
        "prepare-context": {
          "runs-on": "ubuntu-latest",
          needs: "pre-flight",
          if: "needs.pre-flight.outputs.should-continue == 'true'",
          outputs: {
            "run-id": "${{ steps.prepare-context.outputs.run-id }}",
          },
          steps: this.generateContextSteps(),
        },
        "route-event": {
          "runs-on": "ubuntu-latest",
          needs: "pre-flight",
          if: "needs.pre-flight.outputs.should-continue == 'true'",
          outputs: {
            "matching-agents": "${{ steps.route.outputs.matching-agents }}",
          },
          steps: this.generateRoutingSteps(),
        },
        "dispatch-agents": this.generateDispatchJob(),
      },
    };

    const yamlContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });

    return this.formatYaml(yamlContent);
  }

  private generatePreFlightSteps(): WorkflowStep[] {
    // For this repository, use local code. For user repos, would use bunx @repo-agents/cli@X
    const cliCommand = "bun packages/runtime/src/index.ts";

    return [
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
        name: "Global pre-flight check",
        id: "global-preflight",
        env: {
          ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_API_KEY }}",
          CLAUDE_CODE_OAUTH_TOKEN: "${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}",
          GH_APP_ID: "${{ secrets.GH_APP_ID }}",
          GH_APP_PRIVATE_KEY: "${{ secrets.GH_APP_PRIVATE_KEY }}",
          GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
          FALLBACK_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
        },
        run: `${cliCommand} run dispatcher:global-preflight`,
      },
    ];
  }

  private generateContextSteps(): WorkflowStep[] {
    // For this repository, use local code. For user repos, would use bunx @repo-agents/cli@X
    const cliCommand = "bun packages/runtime/src/index.ts";
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    return [
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
        name: "Prepare dispatch context",
        id: "prepare-context",
        run: `${cliCommand} run dispatcher:prepare-context`,
      },
      {
        name: "Upload context artifact",
        uses: "actions/upload-artifact@v4",
        with: {
          name: `dispatch-context-${ghExpr("github.run_id")}`,
          path: "/tmp/dispatch-context/",
          "retention-days": "1",
        },
      },
    ];
  }

  private generateRoutingSteps(): WorkflowStep[] {
    // For this repository, use local code. For user repos, would use bunx @repo-agents/cli@X
    const cliCommand = "bun packages/runtime/src/index.ts";

    return [
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
        name: "Route event to agents",
        id: "route",
        env: {
          WORKFLOW_DISPATCH_AGENT: "${{ github.event.inputs.agent }}",
          GITHUB_EVENT_SCHEDULE: "${{ github.event.schedule }}",
        },
        run: `${cliCommand} run dispatcher:route --agents-dir .github/agents`,
      },
    ];
  }

  private generateDispatchJob(): DispatcherWorkflowJob {
    // For this repository, use local code. For user repos, would use bunx @repo-agents/cli@X
    const cliCommand = "bun packages/runtime/src/index.ts";
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    return {
      "runs-on": "ubuntu-latest",
      needs: ["pre-flight", "prepare-context", "route-event"],
      if: "needs.route-event.outputs.matching-agents != '[]'",
      strategy: {
        matrix: {
          agent: "${{ fromJson(needs.route-event.outputs.matching-agents) }}",
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
          name: "Download dispatch context",
          uses: "actions/download-artifact@v4",
          with: {
            name: `dispatch-context-${ghExpr("needs.prepare-context.outputs.run-id")}`,
            path: "/tmp/dispatch-context/",
          },
        },
        {
          name: `Validate dispatch for ${ghExpr("matrix.agent.agentName")}`,
          id: "validate-dispatch",
          run: `${cliCommand} run dispatcher:dispatch --agent ${ghExpr("matrix.agent.agentPath")} --workflow-file ${ghExpr("matrix.agent.workflowFile")}`,
        },
        {
          name: "Upload validation audit",
          uses: "actions/upload-artifact@v4",
          if: "always()",
          with: {
            name: `validation-audit-${ghExpr("matrix.agent.agentName")}-${ghExpr("github.run_id")}`,
            path: "/tmp/artifacts/validation-audit/",
          },
        },
        {
          name: `Dispatch to ${ghExpr("matrix.agent.agentName")}`,
          if: "steps.validate-dispatch.outputs.should-run == 'true'",
          env: {
            GH_TOKEN: ghExpr("needs.pre-flight.outputs.app-token || github.token"),
          },
          run: `echo "Triggering workflow: ${ghExpr("matrix.agent.workflowFile")}"
echo "Agent: ${ghExpr("matrix.agent.agentName")}"

gh workflow run "${ghExpr("matrix.agent.workflowFile")}" \\
  --ref "${ghExpr("github.ref")}" \\
  -f context-run-id="${ghExpr("needs.prepare-context.outputs.run-id")}"

echo "✓ Dispatched to ${ghExpr("matrix.agent.agentName")}"`,
        },
        {
          name: "Skip notification",
          if: "steps.validate-dispatch.outputs.should-run != 'true'",
          run: `echo "::notice::Skipping ${ghExpr("matrix.agent.agentName")}: ${ghExpr("steps.validate-dispatch.outputs.skip-reason || 'Validation failed'")}"`,
        },
      ],
    };
  }

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

      // Check if this is a job key (2 spaces indentation, ends with colon, alphanumeric+hyphens)
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

export const dispatcherGenerator = new DispatcherGenerator();
