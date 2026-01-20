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
    return {
      name: `Update progress: ${stage} ${status}`,
      run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage ${stage} --progress-status ${status}`,
      env: {
        GH_TOKEN: "${{ secrets.GITHUB_TOKEN }}",
      },
      "continue-on-error": true,
    };
  }

  /**
   * Generate a workflow that uses the runtime CLI instead of embedded bash scripts.
   * This produces clean workflows that delegate logic to `repo-agent run <stage>`.
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
            "context-run-id": {
              type: string;
              required: boolean;
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
            "context-run-id": {
              type: "string",
              required: true,
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
        {
          name: "Download dispatch context",
          uses: "actions/download-artifact@v4",
          with: {
            name: `dispatch-context-${ghExpr("inputs.context-run-id")}`,
            path: "/tmp/dispatch-context/",
            "run-id": ghExpr("inputs.context-run-id"),
            "github-token": ghExpr("secrets.GITHUB_TOKEN"),
          },
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
            GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
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
        outputs: {
          "has-context": ghExpr("steps.run.outputs.has-context"),
        },
        steps: contextSteps,
      };
    }

    // Agent job
    const agentNeeds = hasContext ? ["collect-context"] : undefined;
    const agentIf = hasContext ? "needs.collect-context.outputs.has-context == 'true'" : undefined;

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
      {
        name: "Download dispatch context",
        uses: "actions/download-artifact@v4",
        with: {
          name: `dispatch-context-${ghExpr("inputs.context-run-id")}`,
          path: "/tmp/dispatch-context/",
          "run-id": ghExpr("inputs.context-run-id"),
          "github-token": ghExpr("secrets.GITHUB_TOKEN"),
        },
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
        id: "run",
        run: `${cliCommand} run agent --agent ${agentFilePath}`,
        env: {
          ANTHROPIC_API_KEY: ghExpr("secrets.ANTHROPIC_API_KEY"),
          CLAUDE_CODE_OAUTH_TOKEN: ghExpr("secrets.CLAUDE_CODE_OAUTH_TOKEN"),
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
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
      steps: agentSteps,
    };
    if (agentNeeds) {
      agentJob.needs = agentNeeds;
    }
    if (agentIf) {
      agentJob.if = agentIf;
    }
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
          name: "Download dispatch context",
          uses: "actions/download-artifact@v4",
          with: {
            name: `dispatch-context-${ghExpr("inputs.context-run-id")}`,
            path: "/tmp/dispatch-context/",
            "run-id": ghExpr("inputs.context-run-id"),
            "github-token": ghExpr("secrets.GITHUB_TOKEN"),
          },
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
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
        },
      });

      workflow.jobs["execute-outputs"] = {
        "runs-on": "ubuntu-latest",
        needs: "agent",
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
        ? ["collect-context", "agent", "execute-outputs"]
        : ["collect-context", "agent"]
      : hasOutputs
        ? ["agent", "execute-outputs"]
        : ["agent"];

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
        name: "Download dispatch context",
        uses: "actions/download-artifact@v4",
        with: {
          name: `dispatch-context-${ghExpr("inputs.context-run-id")}`,
          path: "/tmp/dispatch-context/",
          "run-id": ghExpr("inputs.context-run-id"),
          "github-token": ghExpr("secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
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
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
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
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage complete --progress-status success --progress-final-comment "${ghExpr("steps.final-comment.outputs.comment")}"`,
        if: `needs.agent.result == 'success' && steps.final-comment.outputs.has-comment == 'true'`,
        env: {
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
      });

      auditSteps.push({
        name: "Update progress: complete",
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage complete --progress-status success`,
        if: `needs.agent.result == 'success' && steps.final-comment.outputs.has-comment != 'true'`,
        env: {
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
        },
        "continue-on-error": true,
      });

      auditSteps.push({
        name: "Update progress: failed",
        run: `${cliCommand} run progress --agent ${agentFilePath} --progress-stage failed --progress-status failed --progress-error "Workflow failed"`,
        if: "needs.agent.result != 'success'",
        env: {
          GH_TOKEN: ghExpr("secrets.GITHUB_TOKEN"),
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
