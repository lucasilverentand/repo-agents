#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import {
  runDispatch,
  runGlobalPreflight,
  runPrepareContext,
  runRoute,
} from "./stages/dispatcher/index";
import { runAgent, runAudit, runContext, runOutputs, runPreFlight } from "./stages/index";
import type { JobResult, StageContext } from "./types";

const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("repo-agent")
  .description("Runtime CLI for executing Repo Agents stages in GitHub Actions")
  .version(packageJson.version);

const stages = {
  "pre-flight": runPreFlight,
  context: runContext,
  agent: runAgent,
  outputs: runOutputs,
  audit: runAudit,
} as const;

const dispatcherStages = {
  "dispatcher:global-preflight": runGlobalPreflight,
  "dispatcher:prepare-context": runPrepareContext,
  "dispatcher:route": runRoute,
  "dispatcher:dispatch": runDispatch,
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
  claudeAgentResult?: JobResult;
  executeOutputsResult?: JobResult;
  collectContextResult?: JobResult;
  rateLimited?: boolean;
}

program
  .command("run <stage>")
  .description("Run a specific stage of the agent pipeline or dispatcher")
  .option("--agent <path>", "Path to agent definition markdown file (for agent stages)")
  .option("--output-type <type>", "Output type to execute (for outputs stage)")
  .option("--dispatch-run-id <id>", "Dispatcher run ID (for dispatcher mode)")
  .option("--agents-dir <path>", "Path to agents directory (for dispatcher:route)")
  .option("--workflow-file <file>", "Workflow filename (for dispatcher:dispatch)")
  .option("--claude-agent-result <result>", "Result of claude-agent job (for audit stage)")
  .option("--execute-outputs-result <result>", "Result of execute-outputs job (for audit stage)")
  .option("--collect-context-result <result>", "Result of collect-context job (for audit stage)")
  .option("--rate-limited", "Whether the run was rate-limited (for audit stage)")
  .action(async (stage: string, options: RunOptions) => {
    // Check if this is a dispatcher stage
    if (stage in dispatcherStages) {
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

      const dispatcherCtx = {
        github: {
          repository: process.env.GITHUB_REPOSITORY ?? "",
          runId: process.env.GITHUB_RUN_ID ?? "",
          runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "1",
          serverUrl: process.env.GITHUB_SERVER_URL ?? "https://github.com",
          eventName: process.env.GITHUB_EVENT_NAME ?? "",
          eventAction,
          ref: process.env.GITHUB_REF ?? "",
          sha: process.env.GITHUB_SHA ?? "",
          actor: process.env.GITHUB_ACTOR ?? "",
          eventPath: process.env.GITHUB_EVENT_PATH ?? "",
        },
        options: {
          agentsDir: options.agentsDir,
          agentPath: options.agent,
          workflowFile: options.workflowFile,
        },
      };

      const stageFn = dispatcherStages[stage as keyof typeof dispatcherStages];
      const result = await stageFn(dispatcherCtx);

      // Write outputs to GITHUB_OUTPUT if available
      const outputFile = process.env.GITHUB_OUTPUT;
      if (outputFile && Object.keys(result.outputs).length > 0) {
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
        `Available stages: ${[...Object.keys(stages), ...Object.keys(dispatcherStages)].join(", ")}`,
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
        claudeAgent: options.claudeAgentResult,
        executeOutputs: options.executeOutputsResult,
        collectContext: options.collectContextResult,
        rateLimited: options.rateLimited,
      },
    };

    const stageFn = stages[stage as StageName];
    const result = await stageFn(ctx);

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
