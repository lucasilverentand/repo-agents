---
title: Claude Agent Stage
description: The main execution stage where Claude runs with your instructions
---

The claude-agent stage is where Claude actually executes with your agent's instructions. This is the core of the workflow where AI-powered analysis and decision-making happens.

## Purpose

- Set up the execution environment
- Prepare context from trigger event and collected inputs
- Generate skills documentation for available outputs
- Run Claude with your instructions
- Capture execution metrics

## Steps

### 1. Checkout Repository

Clones the repository with full history so Claude can read files and understand git context.

### 2. Setup Runtime

Installs Bun and the Claude Code CLI to prepare the execution environment.

### 3. Prepare Context File

Combines multiple data sources into a single context file for Claude:

- Trigger event data (issue body, PR diff, etc.)
- Collected inputs (if configured)
- Repository metadata
- Available labels and other dynamic context

### 4. Create Skills File

Generates a `.claude/CLAUDE.md` file with instructions for available outputs. This tells Claude exactly how to produce outputs, including the file format, schema, and limits.

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

If the claude-agent stage fails:

1. The execute-outputs stage is skipped
2. The audit-report stage runs
3. A diagnostic agent analyzes the failure
4. A GitHub issue is created with the diagnosis

## See Also

- [Agent Definition](/repo-agents/guide/agent-definition/) - Configuration options
- [Permissions](/repo-agents/guide/permissions/) - Tool access control
- [Execute Outputs](/repo-agents/stages/execute-outputs/) - Next stage
