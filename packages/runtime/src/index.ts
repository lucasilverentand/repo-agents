#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  runAgent,
  runAudit,
  runContext,
  runOutputs,
  runPreFlight,
  runProgress,
  runSetup,
} from "./stages/index";
import { runUnifiedRoute } from "./stages/unified/route";
import { runUnifiedValidate } from "./stages/unified/validate";
import type { JobResult, StageContext, StageResult } from "./types";

const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("repo-agent")
  .description("Runtime CLI for executing Repo Agents stages in GitHub Actions")
  .version(packageJson.version);

const stages = {
  setup: runSetup,
  "pre-flight": runPreFlight,
  context: runContext,
  agent: runAgent,
  outputs: runOutputs,
  audit: runAudit,
  progress: runProgress,
} as const;

const unifiedStages = {
  "setup:preflight": runPreFlight,
  "unified:route": runUnifiedRoute,
  "unified:validate": runUnifiedValidate,
} as const;

type StageName = keyof typeof stages;

interface RunOptions {
  agent?: string;
  outputType?: string;
  dispatchRunId?: string;
  agentsDir?: string;
  workflowFile?: string;
  // Job status options for audit stage
  // Note: Pre-flight results are not tracked here since pre-flight runs in the dispatcher
  agentResult?: JobResult;
  executeOutputsResult?: JobResult;
  collectContextResult?: JobResult;
  rateLimited?: boolean;
  // Progress comment info (from dispatcher via workflow inputs)
  progressCommentId?: string;
  progressIssueNumber?: string;
  // Progress stage options
  progressStage?: "validation" | "context" | "agent" | "outputs" | "complete" | "failed";
  progressStatus?: "running" | "success" | "failed" | "skipped";
  progressError?: string;
  progressFinalComment?: string;
}

program
  .command("run <stage>")
  .description("Run a specific stage of the agent pipeline or dispatcher")
  .option("--agent <path>", "Path to agent definition markdown file (for agent stages)")
  .option("--output-type <type>", "Output type to execute (for outputs stage)")
  .option("--dispatch-run-id <id>", "Dispatcher run ID (for dispatcher mode)")
  .option("--agents-dir <path>", "Path to agents directory (for dispatcher:route)")
  .option("--workflow-file <file>", "Workflow filename (for dispatcher:dispatch)")
  .option("--agent-result <result>", "Result of agent job (for audit stage)")
  .option("--execute-outputs-result <result>", "Result of execute-outputs job (for audit stage)")
  .option("--collect-context-result <result>", "Result of collect-context job (for audit stage)")
  .option("--rate-limited", "Whether the run was rate-limited (for audit stage)")
  .option("--progress-comment-id <id>", "Progress comment ID (from dispatcher)")
  .option(
    "--progress-issue-number <number>",
    "Issue/PR number for progress comment (from dispatcher)",
  )
  .option("--progress-stage <stage>", "Stage to update (for progress stage)")
  .option("--progress-status <status>", "Status to set (for progress stage)")
  .option("--progress-error <error>", "Error message (for progress stage)")
  .option(
    "--progress-final-comment <comment>",
    "Final comment to replace progress (for progress stage)",
  )
  .action(async (stage: string, options: RunOptions) => {
    // Check if this is a unified workflow stage
    if (stage === "unified:route" || stage === "unified:validate" || stage === "setup:preflight") {
      // Extract event action from event payload
      let eventAction = "";
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (eventPath) {
        try {
          const { readFileSync } = await import("node:fs");
          const eventPayload = JSON.parse(readFileSync(eventPath, "utf-8"));
          eventAction = eventPayload.action ?? "";
        } catch {
          // Failed to read event payload
        }
      }

      let result: StageResult;

      if (stage === "unified:route") {
        result = await runUnifiedRoute({
          github: {
            repository: process.env.GITHUB_REPOSITORY ?? "",
            runId: Number(process.env.GITHUB_RUN_ID ?? "0"),
            serverUrl: process.env.GITHUB_SERVER_URL ?? "https://github.com",
            eventName: process.env.GITHUB_EVENT_NAME ?? "",
            eventAction,
            actor: process.env.GITHUB_ACTOR ?? "",
            eventPath: process.env.GITHUB_EVENT_PATH ?? "",
          },
          options: {
            agentsDir: options.agentsDir,
          },
        });
      } else if (stage === "unified:validate") {
        result = await runUnifiedValidate({
          github: {
            repository: process.env.GITHUB_REPOSITORY ?? "",
            runId: Number(process.env.GITHUB_RUN_ID ?? "0"),
            serverUrl: process.env.GITHUB_SERVER_URL ?? "https://github.com",
            eventName: process.env.GITHUB_EVENT_NAME ?? "",
            actor: process.env.GITHUB_ACTOR ?? "",
            eventPath: process.env.GITHUB_EVENT_PATH ?? "",
          },
          options: {
            agentPath: options.agent,
          },
        });
      } else {
        // setup:preflight
        result = await runPreFlight({
          repository: process.env.GITHUB_REPOSITORY ?? "",
          runId: process.env.GITHUB_RUN_ID ?? "",
          actor: process.env.GITHUB_ACTOR ?? "",
          eventName: process.env.GITHUB_EVENT_NAME ?? "",
          eventPath: process.env.GITHUB_EVENT_PATH ?? "",
          agentPath: options.agent ?? "",
        });
      }

      // Write outputs to GITHUB_OUTPUT if available
      const outputFile = process.env.GITHUB_OUTPUT;
      if (outputFile && result.outputs && Object.keys(result.outputs).length > 0) {
        const { appendFileSync } = await import("node:fs");
        for (const [key, value] of Object.entries(result.outputs)) {
          appendFileSync(outputFile, `${key}=${value}\n`);
        }
      }

      // Exit with appropriate code
      process.exit(result.success ? 0 : 1);
    }

    // Handle agent stages
    if (!(stage in stages)) {
      console.error(`Unknown stage: ${stage}`);
      console.error(
        `Available stages: ${[...Object.keys(stages), ...Object.keys(unifiedStages)].join(", ")}`,
      );
      process.exit(1);
    }

    if (!options.agent) {
      console.error("Error: --agent is required for agent stages");
      process.exit(1);
    }

    const ctx: StageContext = {
      repository: process.env.GITHUB_REPOSITORY ?? "",
      runId: process.env.GITHUB_RUN_ID ?? "",
      actor: process.env.GITHUB_ACTOR ?? "",
      eventName: process.env.GITHUB_EVENT_NAME ?? "",
      eventPath: process.env.GITHUB_EVENT_PATH ?? "",
      agentPath: options.agent,
      outputType: options.outputType,
      dispatchRunId: options.dispatchRunId,
      jobStatuses: {
        agent: options.agentResult,
        executeOutputs: options.executeOutputsResult,
        collectContext: options.collectContextResult,
        rateLimited: options.rateLimited,
      },
      progressCommentId: options.progressCommentId ? Number(options.progressCommentId) : undefined,
      progressIssueNumber: options.progressIssueNumber
        ? Number(options.progressIssueNumber)
        : undefined,
    };

    // Handle progress stage specially (requires additional options)
    let result: StageResult;
    if (stage === "progress") {
      if (!options.progressStage || !options.progressStatus) {
        console.error(
          "Error: --progress-stage and --progress-status are required for progress stage",
        );
        process.exit(1);
      }
      result = await runProgress(ctx, {
        stage: options.progressStage,
        status: options.progressStatus,
        error: options.progressError,
        finalComment: options.progressFinalComment,
      });
    } else {
      const stageFn = stages[stage as Exclude<StageName, "progress">];
      result = await stageFn(ctx);
    }

    // Write outputs to GITHUB_OUTPUT if available
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile && Object.keys(result.outputs).length > 0) {
      const { appendFileSync } = await import("node:fs");
      for (const [key, value] of Object.entries(result.outputs)) {
        appendFileSync(outputFile, `${key}=${value}\n`);
      }
    }

    // Log skip reason if present
    if (result.skipReason) {
      console.log(`Stage skipped: ${result.skipReason}`);
    }

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  });

program.parse();
