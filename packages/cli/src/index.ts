#!/usr/bin/env node

import { Command } from "commander";
// Import root package.json for version (gets inlined during bundling)
import packageJson from "../../../package.json";
import { addCommand } from "./commands/add";
import { authCommand } from "./commands/auth";
import { compileCommand } from "./commands/compile";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { setupCommand } from "./commands/setup";
import { setupAppCommand } from "./commands/setup-app";
import { validateCommand } from "./commands/validate";

const program = new Command();

program
  .name("repo-agents")
  .description(
    "CLI tool for creating AI-powered GitHub Actions workflows from markdown agent definitions",
  )
  .version(packageJson.version)
  .option("--no-color", "Disable colored output")
  .option("-q, --quiet", "Suppress informational output, only show errors")
  .hook("preAction", (thisCommand) => {
    // Handle global options before any command runs
    const opts = thisCommand.optsWithGlobals();

    // Disable colors if --no-color is passed
    if (opts.color === false) {
      process.env.NO_COLOR = "1";
    }

    // Set quiet mode in environment for logger to check
    if (opts.quiet) {
      process.env.REPO_AGENTS_QUIET = "1";
    }
  });

program
  .command("init")
  .description("Initialize Repo Agents in the current repository")
  .option("--examples", "Include example agent templates")
  .option("--force", "Overwrite existing files")
  .action(initCommand);

program
  .command("compile")
  .description(
    "Compile all agent markdown files to GitHub Actions workflows (generates dispatcher + agent workflows)",
  )
  .option("-d, --dry-run", "Show what would be generated without writing files")
  .option("-o, --output-dir <dir>", "Output directory for workflows")
  .action(compileCommand);

program
  .command("validate [file]")
  .description("Validate agent markdown files")
  .option("-a, --all", "Validate all agents")
  .option("-s, --strict", "Enable strict validation")
  .action(validateCommand);

program
  .command("list")
  .description("List all agents")
  .option("-f, --format <format>", "Output format (table, json, yaml)", "table")
  .option("-d, --details", "Show detailed information")
  .option("--plain", "Plain output without colors (for piping to grep)")
  .action(listCommand);

program
  .command("setup-token")
  .description(
    "Set up Claude API token (checks subscription token first, then prompts for API key)",
  )
  .option("--force", "Overwrite existing token")
  .option("--no-input", "Disable interactive prompts (for automation)")
  .action(authCommand);

program
  .command("setup-app")
  .description("Configure a GitHub App for branded agent identity and CI triggering")
  .option("--force", "Overwrite existing GitHub App secrets")
  .option(
    "--org <organization>",
    "Organization name (auto-detected from current repo if not specified)",
  )
  .option("--no-input", "Disable interactive prompts (for automation)")
  .action(setupAppCommand);

program
  .command("setup")
  .description(
    "Interactive setup wizard for Repo Agents (configures authentication and GitHub App)",
  )
  .option("--force", "Overwrite existing configuration")
  .option("--skip-auth", "Skip Claude authentication setup")
  .option("--skip-app", "Skip GitHub App setup")
  .option("--no-input", "Disable interactive prompts (for automation)")
  .action(setupCommand);

program
  .command("add")
  .description("Add agents from the library")
  .option("-a, --all", "Add all agents from the library")
  .option("--force", "Overwrite existing agents")
  .action(addCommand);

program.parse();
