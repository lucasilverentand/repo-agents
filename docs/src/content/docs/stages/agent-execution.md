---
title: Agent Execution Stage
slug: stages/agent-execution
description: The main execution stage where the AI agent runs with your instructions
sidebar:
  label: 3. Agent Execution
---

This is where your agent's instructions are executed. The stage sets up the runtime environment and agent CLI, loads the context file containing event data and collected inputs, and creates skills documentation for the allowed outputs. The agent runs with appropriate tool permissions, and afterward the stage extracts and logs execution metrics including cost, turns, and duration. Any outputs are uploaded as artifacts for the next stage.

## Purpose

- Set up the runtime environment and agent CLI
- Load the context file with event data and collected inputs
- Create skills documentation for allowed outputs
- Run the agent with appropriate tool permissions
- Extract and log execution metrics (cost, turns, duration)
- Upload outputs as artifacts for the next stage

## Steps

### 1. Checkout Repository

Clones the repository with full history so Claude can read files and understand git context.

### 2. Setup Runtime

Installs Bun and the Claude Code CLI to prepare the execution environment.

### 3. Load Context File

Loads the context file containing event data and collected inputs:

- Trigger event data (issue body, PR diff, etc.)
- Collected inputs (if configured)
- Repository metadata
- Available labels and other dynamic context

### 4. Create Skills Documentation

Creates skills documentation for the allowed outputs in `.claude/CLAUDE.md`. This tells Claude exactly how to produce outputs, including the file format, schema, and limits.

### 5. Run Claude

Executes Claude with the prepared context and configured tool permissions.

**Tool Permissions:**

| Configuration | Allowed Tools |
|--------------|---------------|
| With outputs | `Write(/tmp/outputs/*),Read,Glob,Grep` |
| Without outputs | `Read,Glob,Grep` |
| With `contents: write` | `Write,Edit,Bash(git commit),...` |

### 6. Extract Metrics

Captures execution metrics from Claude's output:

- **Cost** — API cost for the run
- **Turns** — Number of conversation turns
- **Duration** — Total execution time
- **Session ID** — For debugging

### 7. Upload Outputs Artifact

Saves any output files Claude created for the execute-outputs stage to process.

## Execution Environment

The agent runs in a GitHub Actions Ubuntu runner with:

- Full repository checkout
- Bun runtime
- GitHub CLI (`gh`)
- Git (configured with GitHub token)
- Network access (for API calls only)

**Claude cannot:**
- Access external websites
- Execute arbitrary code
- Modify files outside allowed paths
- Make changes without explicit permissions

## Failure Handling

If the agent stage fails:

1. The execute-outputs stage is skipped
2. The audit-report stage runs
3. A diagnostic agent analyzes the failure
4. A GitHub issue is created with the diagnosis

