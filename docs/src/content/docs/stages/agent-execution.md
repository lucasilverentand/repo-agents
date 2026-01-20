---
title: Agent Execution Stage
slug: stages/agent-execution
description: The main execution stage where the AI agent runs with your instructions
sidebar:
  label: 3. Agent Execution
---

This is where your agent's instructions are executed. The stage sets up the runtime environment and agent CLI, reads the event context directly from the GitHub event payload, and creates skills documentation for the allowed outputs. The agent runs with appropriate tool permissions using the token generated in the setup stage, and afterward the stage extracts and logs execution metrics including cost, turns, and duration. Any outputs are uploaded as artifacts for the next stage.

## Purpose

- Set up the runtime environment and agent CLI
- Read event context directly from `$GITHUB_EVENT_PATH`
- Create skills documentation for allowed outputs
- Run the agent with appropriate tool permissions
- Extract and log execution metrics (cost, turns, duration)
- Upload outputs as artifacts for the next stage

## Agent Workflow Structure

Each agent workflow has the following jobs:

```
setup → collect-context (optional) → agent → execute-outputs (optional) → audit-report
```

### Setup Job

The first job in every agent workflow:
- Generates GitHub App token (if GH_APP_ID and GH_APP_PRIVATE_KEY are configured)
- Falls back to GITHUB_TOKEN if no app is configured
- Validates Claude authentication is available
- Outputs: `app-token`, `git-user`, `git-email`

Using a GitHub App provides:
- Branded identity (commits appear as "YourApp[bot]")
- PRs created by the agent can trigger CI workflows
- Higher rate limits

## Steps

### 1. Checkout Repository

Clones the repository with full history so Claude can read files and understand git context.

### 2. Setup Runtime

Installs Bun and the Claude Code CLI to prepare the execution environment.

### 3. Configure Git Identity

Sets up git user and email based on the setup job outputs:
- If GitHub App configured: `YourApp[bot]` / `123+YourApp[bot]@users.noreply.github.com`
- If no app: `github-actions[bot]` / `github-actions[bot]@users.noreply.github.com`

### 4. Load Event Context

Reads the event payload directly from `$GITHUB_EVENT_PATH`:

- Trigger event data (issue body, PR diff, etc.)
- Repository metadata
- Available labels and other dynamic context

If the collect-context job ran, also loads collected repository data from the artifact.

### 5. Create Skills Documentation

Creates skills documentation for the allowed outputs in `.claude/CLAUDE.md`. This tells Claude exactly how to produce outputs, including the file format, schema, and limits.

### 6. Run Claude

Executes Claude with the prepared context and configured tool permissions.

**Tool Permissions:**

| Configuration | Allowed Tools |
|--------------|---------------|
| With outputs | `Write(/tmp/outputs/*),Read,Glob,Grep` |
| Without outputs | `Read,Glob,Grep` |
| With `contents: write` | `Write,Edit,Bash(git commit),...` |

### 7. Extract Metrics

Captures execution metrics from Claude's output:

- **Cost** — API cost for the run
- **Turns** — Number of conversation turns
- **Duration** — Total execution time
- **Session ID** — For debugging

### 8. Upload Outputs Artifact

Saves any output files Claude created for the execute-outputs stage to process.

## Execution Environment

The agent runs in a GitHub Actions Ubuntu runner with:

- Full repository checkout
- Bun runtime
- GitHub CLI (`gh`)
- Git (configured with GitHub token or App token)
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
