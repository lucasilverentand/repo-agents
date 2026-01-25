import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists, findMarkdownFiles } from "@repo-agents/cli-utils/files";
import { logger } from "@repo-agents/cli-utils/logger";
import { getExistingSecrets } from "@repo-agents/cli-utils/secrets";
import { workflowValidator } from "@repo-agents/cli-utils/workflow-validator";
import { unifiedWorkflowGenerator } from "@repo-agents/generator/unified";
import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition, CompileResult, ValidationError } from "@repo-agents/types";
import chalk from "chalk";
import ora from "ora";

interface CompileOptions {
  dryRun?: boolean;
  outputDir?: string;
}

export async function compileCommand(options: CompileOptions): Promise<void> {
  const cwd = process.cwd();
  const agentsDir = join(cwd, ".github", "agents");
  const workflowsDir = options.outputDir || join(cwd, ".github", "workflows");

  const spinner = ora("Finding agent files...").start();

  const agentsDirExists = await fileExists(agentsDir);
  if (!agentsDirExists) {
    spinner.fail("Agents directory not found");
    logger.error(`Directory not found: ${agentsDir}`);
    logger.info("Run: repo-agents init");
    process.exit(1);
  }

  const files = await findMarkdownFiles(agentsDir);

  if (files.length === 0) {
    spinner.warn("No agent files found");
    logger.info(`Create agent files in: ${agentsDir}`);
    return;
  }

  spinner.succeed(`Found ${files.length} agent file(s)`);

  // Phase 1: Parse and validate all agents
  const parsedAgents: { agent: AgentDefinition; filePath: string; errors: ValidationError[] }[] =
    [];
  let hasErrors = false;

  for (const filePath of files) {
    const fileName = filePath.split("/").pop() || filePath;
    const parseSpinner = ora(`Parsing ${chalk.cyan(fileName)}...`).start();

    const { agent, errors: parseErrors } = await agentParser.parseFile(filePath);

    if (!agent || parseErrors.some((e) => e.severity === "error")) {
      parseSpinner.fail(`Failed to parse ${fileName}`);
      if (parseErrors.length > 0) {
        logger.newline();
        parseErrors.forEach((error) => {
          const icon = error.severity === "error" ? "✗" : "⚠";
          const color = error.severity === "error" ? chalk.red : chalk.yellow;
          logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
        });
      }
      hasErrors = true;
      continue;
    }

    const validationErrors = agentParser.validateAgent(agent);
    const allErrors = [...parseErrors, ...validationErrors];

    if (validationErrors.some((e) => e.severity === "error")) {
      parseSpinner.fail(`Validation failed for ${fileName}`);
      logger.newline();
      validationErrors.forEach((error) => {
        const icon = error.severity === "error" ? "✗" : "⚠";
        const color = error.severity === "error" ? chalk.red : chalk.yellow;
        logger.log(color(`  ${icon} ${error.field}: ${error.message}`));
      });
      hasErrors = true;
      continue;
    }

    parseSpinner.succeed(`Parsed ${fileName}`);
    parsedAgents.push({ agent, filePath, errors: allErrors });
  }

  if (hasErrors) {
    logger.newline();
    logger.error("Some agents failed to parse or validate.");
    logger.info("Fix the errors above and try again. Common issues:");
    logger.log("  • Missing required fields (name, on)");
    logger.log("  • Invalid YAML frontmatter syntax");
    logger.log("  • update-file output requires allowed-paths");
    logger.log("  • create-pr/update-file require contents: write permission");
    logger.newline();
    logger.info("Run 'repo-agents validate --all' for detailed validation");
    process.exit(1);
  }

  if (parsedAgents.length === 0) {
    logger.error("No valid agents found");
    logger.info("Create agent files in .github/agents/ or run:");
    logger.log("  repo-agents init --examples");
    process.exit(1);
  }

  const agents = parsedAgents.map((p) => p.agent);

  // Phase 2: Detect available secrets
  logger.newline();
  const secretsSpinner = ora("Detecting available secrets...").start();
  const secrets = getExistingSecrets();

  if (!secrets.hasApiKey && !secrets.hasAccessToken) {
    secretsSpinner.warn("No Claude authentication secrets found");
    logger.log(
      chalk.yellow(
        "  ⚠ Set either ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN to enable Claude authentication",
      ),
    );
    logger.log(chalk.gray("  Run: repo-agents setup"));
  } else {
    const authMethod = secrets.hasApiKey ? "ANTHROPIC_API_KEY" : "CLAUDE_CODE_OAUTH_TOKEN";
    secretsSpinner.succeed(`Found Claude authentication: ${authMethod}`);
  }

  // Phase 3: Generate unified workflow
  const workflowSpinner = ora("Generating unified workflow...").start();

  const unifiedWorkflow = unifiedWorkflowGenerator.generate(agents, secrets);

  try {
    const schemaErrors = await workflowValidator.validateWorkflow(unifiedWorkflow);
    if (schemaErrors.length > 0) {
      workflowSpinner.fail("Unified workflow schema validation failed");
      logger.newline();
      schemaErrors.forEach((error) => {
        logger.log(chalk.red(`  ✗ ${error.path}: ${error.message}`));
      });
      logger.newline();
      logger.info("This is likely a bug in repo-agents. Please report it:");
      logger.log("  https://github.com/lucasilverentand/repo-agents/issues");
      process.exit(1);
    }
  } catch (error) {
    workflowSpinner.warn(`Could not validate workflow schema (${(error as Error).message})`);
    logger.info("Workflow will be generated but may have issues. Please test it.");
  }

  workflowSpinner.succeed("Generated unified workflow");

  // Phase 4: Build compile results
  const results: CompileResult[] = parsedAgents.map(({ filePath, errors }) => ({
    success: true,
    inputPath: filePath,
    errors,
  }));

  // Phase 5: Write workflows
  if (options.dryRun) {
    logger.newline();
    logger.info("Dry run - not writing files");
    logger.newline();

    logger.log(chalk.gray("--- Unified Workflow ---"));
    logger.log(unifiedWorkflow);
    logger.log(chalk.gray("--- End Unified Workflow ---"));
  } else {
    await mkdir(workflowsDir, { recursive: true });

    // Clean up old workflow files
    await cleanupOldWorkflows(workflowsDir);

    // Write unified workflow
    const workflowPath = join(workflowsDir, "agents.yml");
    await writeFile(workflowPath, unifiedWorkflow, "utf-8");
    logger.info(`Wrote unified workflow: ${chalk.cyan("agents.yml")}`);

    // Set output path for results
    for (let i = 0; i < results.length; i++) {
      results[i].outputPath = workflowPath;
    }
  }

  // Print summary
  logger.newline();
  printSummary(results, options.dryRun || false);
}

/**
 * Clean up old dispatcher and per-agent workflow files.
 */
async function cleanupOldWorkflows(workflowsDir: string): Promise<void> {
  try {
    const files = await readdir(workflowsDir);
    const filesToDelete = files.filter(
      (file) =>
        file === "agent-dispatcher.yml" ||
        (file.startsWith("agent-") && file.endsWith(".yml") && file !== "agents.yml"),
    );

    for (const file of filesToDelete) {
      const filePath = join(workflowsDir, file);
      await rm(filePath, { force: true });
      logger.log(chalk.gray(`  Removed old workflow: ${file}`));
    }

    if (filesToDelete.length > 0) {
      logger.newline();
    }
  } catch {
    // Ignore errors - directory might not exist yet
  }
}

function printSummary(results: CompileResult[], dryRun: boolean): void {
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const warnings = results.filter((r) => r.errors?.some((e) => e.severity === "warning")).length;

  logger.info("Compilation Summary:");
  logger.log(`  ${chalk.green("✓")} Agents: ${successful}`);
  logger.log(`  ${chalk.green("✓")} Unified workflow: 1`);
  if (failed > 0) {
    logger.log(`  ${chalk.red("✗")} Failed: ${failed}`);
  }
  if (warnings > 0) {
    logger.log(`  ${chalk.yellow("⚠")} Warnings: ${warnings}`);
  }

  if (!dryRun) {
    logger.newline();
    logger.info("Unified workflow generated successfully!");
    logger.log("  All agents are now handled by a single workflow file (agents.yml).");
    logger.log("  This improves performance and simplifies the architecture.");
  }
}
