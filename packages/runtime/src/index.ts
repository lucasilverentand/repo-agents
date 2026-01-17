#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
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

type StageName = keyof typeof stages;

interface RunOptions {
  agent: string;
  outputType?: string;
  dispatchRunId?: string;
  // Job status options for audit stage
  // Note: Pre-flight results are not tracked here since pre-flight runs in the dispatcher
  claudeAgentResult?: JobResult;
  executeOutputsResult?: JobResult;
  collectContextResult?: JobResult;
  rateLimited?: boolean;
}

program
  .command("run <stage>")
  .description("Run a specific stage of the agent pipeline")
  .requiredOption("--agent <path>", "Path to agent definition markdown file")
  .option("--output-type <type>", "Output type to execute (for outputs stage)")
  .option("--dispatch-run-id <id>", "Dispatcher run ID (for dispatcher mode)")
  .option("--claude-agent-result <result>", "Result of claude-agent job (for audit stage)")
  .option("--execute-outputs-result <result>", "Result of execute-outputs job (for audit stage)")
  .option("--collect-context-result <result>", "Result of collect-context job (for audit stage)")
  .option("--rate-limited", "Whether the run was rate-limited (for audit stage)")
  .action(async (stage: string, options: RunOptions) => {
    if (!(stage in stages)) {
      console.error(`Unknown stage: ${stage}`);
      console.error(`Available stages: ${Object.keys(stages).join(", ")}`);
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
