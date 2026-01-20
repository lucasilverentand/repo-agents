import { writeFile } from "node:fs/promises";
import { agentNameToWorkflowName } from "@repo-agents/cli-utils";
import type { AgentDefinition, WorkflowStep } from "@repo-agents/types";
import yaml from "js-yaml";

// Types for generated GitHub Actions workflow structures
interface GitHubWorkflowJob {
  "runs-on": string;
  needs?: string | string[];
  if?: string;
  outputs?: Record<string, string>;
  strategy?: Record<string, unknown>;
  steps: WorkflowStep[];
}

export class WorkflowGenerator {
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

  /**
   * Get the relative path to an agent markdown file from the repository root.
   * Assumes agents are stored in .github/agents/ directory.
   */
  getAgentFilePath(agentName: string): string {
    // Convert agent name to file-safe format
    const fileName = agentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `.github/agents/${fileName}.md`;
  }

  /**
   * Check if progress comments should be enabled for this agent.
   */
  private shouldUseProgressComment(agent: AgentDefinition): boolean {
    // Explicit setting takes precedence
    if (agent.progress_comment !== undefined) {
      return agent.progress_comment;
    }
    // Default enabled for issue/PR triggers
    return !!(agent.on.issues || agent.on.pull_request);
  }

  /**
   * Generate a progress update step.
   */
  private generateProgressStep(
    cliCommand: string,
    agentFilePath: string,
    stage: string,
    status: string,
  ): WorkflowStep {
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;
    return {
      name: `Update progress: ${stage} ${status}`,
      run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage ${stage} --progress-status ${status} --progress-comment-id "${ghExpr("inputs.progress-comment-id")}" --progress-issue-number "${ghExpr("inputs.progress-issue-number")}"`,
      env: {
        GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
      },
      "continue-on-error": true,
    };
  }

  /**
   * Generate a workflow that uses the runtime CLI instead of embedded bash scripts.
   * This produces clean workflows that delegate logic to `repo-agent run <stage>`.
   *
   * Architecture:
   * - setup job: Generates GitHub App token (if configured), validates Claude auth
   * - collect-context job (optional): Collects repo data
   * - agent job: Runs Claude Code CLI
   * - execute-outputs job (optional): Executes outputs
   * - audit-report job: Always runs, tracks metrics
   *
   * Event context is read directly from $GITHUB_EVENT_PATH by each job.
   * Token is generated once in setup and passed to other jobs.
   */
  generate(agent: AgentDefinition, agentFilePath: string): string {
    // For this repository, use local code. For user repos, would use bunx @repo-agents/cli@X
    const cliCommand = "bun packages/runtime/src/index.ts";
    const hasContext = !!agent.context;
    const hasOutputs = agent.outputs && Object.keys(agent.outputs).length > 0;
    const outputTypes = hasOutputs ? Object.keys(agent.outputs!) : [];
    const useProgressComment = this.shouldUseProgressComment(agent);

    // Helper to create GitHub expression strings
    const ghExpr = (expr: string) => `\${{ ${expr} }}`;

    interface SimplifiedWorkflow {
      name: string;
      on: {
        workflow_dispatch: {
          inputs: {
            "progress-comment-id": {
              type: string;
              required: boolean;
              description: string;
            };
            "progress-issue-number": {
              type: string;
              required: boolean;
              description: string;
            };
          };
        };
      };
      permissions?: Record<string, string>;
      jobs: Record<string, GitHubWorkflowJob>;
    }

    const workflow: SimplifiedWorkflow = {
      name: agent.name,
      on: {
        workflow_dispatch: {
          inputs: {
            "progress-comment-id": {
              type: "string",
              required: false,
              description: "Progress comment ID (from dispatcher)",
            },
            "progress-issue-number": {
              type: "string",
              required: false,
              description: "Issue/PR number for progress comment (from dispatcher)",
            },
          },
        },
      },
      jobs: {},
    };

    // Add permissions if configured
    if (agent.permissions) {
      workflow.permissions = Object.entries(agent.permissions).reduce(
        (acc, [key, value]) => {
          const kebabKey = key.replace(/_/g, "-");
          acc[kebabKey] = value;
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    // Setup job - generates GitHub App token and validates auth
    workflow.jobs.setup = {
      "runs-on": "ubuntu-latest",
      outputs: {
        "should-continue": ghExpr("steps.setup.outputs.should-continue"),
        "app-token": ghExpr("steps.setup.outputs.app-token"),
        "git-user": ghExpr("steps.setup.outputs.git-user"),
        "git-email": ghExpr("steps.setup.outputs.git-email"),
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
          name: "Setup agent",
          id: "setup",
          env: {
            ANTHROPIC_API_KEY: ghExpr("secrets.ANTHROPIC_API_KEY"),
            CLAUDE_CODE_OAUTH_TOKEN: ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN"),
            GH_APP_ID: ghExpr("secrets.GH_APP_ID"),
            GH_APP_PRIVATE_KEY: ghExpr("secrets.GH_APP_PRIVATE_KEY"),
            GITHUB_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
          },
          run: `${cliCommand} run setup --agent ${agentFilePath}`,
        },
      ],
    };

    // Collect-context job (only if context is configured)
    if (hasContext) {
      const contextSteps: WorkflowStep[] = [
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
      ];

      // Add progress update at start
      if (useProgressComment) {
        contextSteps.push(
          this.generateProgressStep(cliCommand, agentFilePath, "context", "running"),
        );
      }

      contextSteps.push(
        {
          id: "run",
          run: `${cliCommand} run context --agent ${agentFilePath}`,
          env: {
            GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
          },
        },
        {
          uses: "actions/upload-artifact@v4",
          with: {
            name: `collected-context-${ghExpr("github.run_id")}`,
            path: "/tmp/context/",
          },
        },
      );

      // Add progress update at end
      if (useProgressComment) {
        contextSteps.push(
          this.generateProgressStep(cliCommand, agentFilePath, "context", "success"),
        );
      }

      workflow.jobs["collect-context"] = {
        "runs-on": "ubuntu-latest",
        needs: "setup",
        if: "needs.setup.outputs.should-continue == 'true'",
        outputs: {
          "has-context": ghExpr("steps.run.outputs.has-context"),
        },
        steps: contextSteps,
      };
    }

    // Agent job
    const agentNeeds = hasContext ? ["setup", "collect-context"] : ["setup"];
    const agentIf = hasContext
      ? "needs.setup.outputs.should-continue == 'true' && needs.collect-context.outputs.has-context == 'true'"
      : "needs.setup.outputs.should-continue == 'true'";

    const agentSteps: WorkflowStep[] = [
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
    ];

    // Download collected context if context was configured
    if (hasContext) {
      agentSteps.push({
        uses: "actions/download-artifact@v4",
        if: "needs.collect-context.result == 'success'",
        with: {
          name: `collected-context-${ghExpr("github.run_id")}`,
          path: "/tmp/context/",
        },
        "continue-on-error": true,
      });
    }

    // Add progress update at start of agent execution
    if (useProgressComment) {
      agentSteps.push(this.generateProgressStep(cliCommand, agentFilePath, "agent", "running"));
    }

    agentSteps.push(
      {
        name: "Configure git identity",
        run: `git config --global user.name "${ghExpr("needs.setup.outputs.git-user")}"
git config --global user.email "${ghExpr("needs.setup.outputs.git-email")}"`,
      },
      {
        id: "run",
        run: `${cliCommand} run agent --agent ${agentFilePath}`,
        env: {
          ANTHROPIC_API_KEY: ghExpr("secrets.ANTHROPIC_API_KEY"),
          CLAUDE_CODE_OAUTH_TOKEN: ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN"),
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
        },
      },
      {
        uses: "actions/upload-artifact@v4",
        with: {
          name: `claude-outputs-${ghExpr("github.run_id")}`,
          path: "/tmp/outputs/",
        },
      },
      {
        uses: "actions/upload-artifact@v4",
        with: {
          name: `audit-metrics-${ghExpr("github.run_id")}`,
          path: "/tmp/audit/",
        },
      },
    );

    // Add progress update at end of agent execution
    if (useProgressComment) {
      agentSteps.push(this.generateProgressStep(cliCommand, agentFilePath, "agent", "success"));
    }

    const agentJob: GitHubWorkflowJob = {
      "runs-on": "ubuntu-latest",
      needs: agentNeeds,
      if: agentIf,
      steps: agentSteps,
    };
    workflow.jobs.agent = agentJob;

    // Execute-outputs job (only if outputs are configured)
    if (hasOutputs) {
      const outputsSteps: WorkflowStep[] = [
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
          name: "Download output files",
          uses: "actions/download-artifact@v4",
          with: {
            name: `claude-outputs-${ghExpr("github.run_id")}`,
            path: "/tmp/outputs/",
          },
        },
      ];

      // Add progress update at start (only for first matrix item to avoid duplicates)
      if (useProgressComment) {
        outputsSteps.push({
          ...this.generateProgressStep(cliCommand, agentFilePath, "outputs", "running"),
          if: "matrix.output-type == matrix.output-type[0]", // Only first matrix item
        });
      }

      outputsSteps.push({
        name: `Execute ${ghExpr("matrix.output-type")} outputs`,
        run: `${cliCommand} run outputs --agent ${agentFilePath} --output-type ${ghExpr("matrix.output-type")}`,
        env: {
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
          TARGET_ISSUE_NUMBER: ghExpr("inputs.progress-issue-number"),
        },
      });

      workflow.jobs["execute-outputs"] = {
        "runs-on": "ubuntu-latest",
        needs: hasContext ? ["setup", "agent"] : ["setup", "agent"],
        strategy: {
          matrix: {
            "output-type": outputTypes,
          },
          "fail-fast": false,
        },
        steps: outputsSteps,
      };
    }

    // Audit-report job (always present)
    const auditNeeds = hasContext
      ? hasOutputs
        ? ["setup", "collect-context", "agent", "execute-outputs"]
        : ["setup", "collect-context", "agent"]
      : hasOutputs
        ? ["setup", "agent", "execute-outputs"]
        : ["setup", "agent"];

    const auditRunParts: string[] = [`${cliCommand} run audit --agent ${agentFilePath}`];

    if (hasContext) {
      auditRunParts.push(`--collect-context-result ${ghExpr("needs.collect-context.result")}`);
    }

    auditRunParts.push(`--agent-result ${ghExpr("needs.agent.result")}`);

    if (hasOutputs) {
      auditRunParts.push(`--execute-outputs-result ${ghExpr("needs.execute-outputs.result")}`);
    }

    const auditSteps: WorkflowStep[] = [
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
        uses: "actions/download-artifact@v4",
        with: {
          pattern: `*-${ghExpr("github.run_id")}`,
          path: "/tmp/audit-data/",
          "merge-multiple": true,
        },
        "continue-on-error": true,
      },
      {
        run: auditRunParts.join(" \\\n            "),
        env: {
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
        },
      },
    ];

    // Add final progress update
    if (useProgressComment) {
      // Check for add-comment output and use it as final comment
      auditSteps.push({
        name: "Read final comment",
        id: "final-comment",
        if: "needs.agent.result == 'success'",
        run: `if [ -f /tmp/audit-data/add-comment.json ]; then
  COMMENT=$(jq -r '.body // empty' /tmp/audit-data/add-comment.json 2>/dev/null || true)
  if [ -n "$COMMENT" ]; then
    echo "has-comment=true" >> $GITHUB_OUTPUT
    # Escape for shell
    ESCAPED=$(echo "$COMMENT" | sed 's/"/\\"/g' | tr '\\n' ' ')
    echo "comment=$ESCAPED" >> $GITHUB_OUTPUT
  fi
fi`,
        "continue-on-error": true,
      });

      auditSteps.push({
        name: "Update progress: complete with comment",
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage complete --progress-status success --progress-comment-id "${ghExpr("inputs.progress-comment-id")}" --progress-issue-number "${ghExpr("inputs.progress-issue-number")}" --progress-final-comment "${ghExpr("steps.final-comment.outputs.comment")}"`,
        if: `needs.agent.result == 'success' && steps.final-comment.outputs.has-comment == 'true'`,
        env: {
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
      });

      auditSteps.push({
        name: "Update progress: complete",
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage complete --progress-status success --progress-comment-id "${ghExpr("inputs.progress-comment-id")}" --progress-issue-number "${ghExpr("inputs.progress-issue-number")}"`,
        if: `needs.agent.result == 'success' && steps.final-comment.outputs.has-comment != 'true'`,
        env: {
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
      });

      auditSteps.push({
        name: "Update progress: failed",
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage failed --progress-status failed --progress-comment-id "${ghExpr("inputs.progress-comment-id")}" --progress-issue-number "${ghExpr("inputs.progress-issue-number")}" --progress-error "Workflow failed"`,
        if: "needs.agent.result != 'success'",
        env: {
          GH_TOKEN: ghExpr("needs.setup.outputs.app-token || secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
      });
    }

    workflow.jobs["audit-report"] = {
      "runs-on": "ubuntu-latest",
      needs: auditNeeds,
      if: "always()",
      steps: auditSteps,
    };

    const yamlContent = yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });

    return this.formatYaml(yamlContent);
  }

  async writeWorkflow(agent: AgentDefinition, outputDir: string): Promise<string> {
    const workflowName = agentNameToWorkflowName(agent.name);
    const fileName = `${workflowName}.yml`;
    const filePath = `${outputDir}/${fileName}`;

    const agentFilePath = this.getAgentFilePath(agent.name);
    const content = this.generate(agent, agentFilePath);
    await writeFile(filePath, content, "utf-8");

    return filePath;
  }
}

export const workflowGenerator = new WorkflowGenerator();

export { ContextCollector, contextCollector } from "./context-collector";
// Re-exports
export { DispatcherGenerator, dispatcherGenerator } from "./dispatcher";
export { generateSkillForOutput, generateSkillsSection } from "./skills";
