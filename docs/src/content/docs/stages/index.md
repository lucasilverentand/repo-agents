---
title: The Flow
description: How repo-agents agents execute from trigger to completion
---

import { Steps } from '@astrojs/starlight/components';

When an event triggers an agent, it flows through a series of stages in GitHub Actions. Each stage has a specific purpose in the execution pipeline.

## The Execution Flow

<Steps>

1. **[Pre-Flight Validation](/repo-agents/stages/pre-flight/)**

   Security checks and validation run first:
   - Validates Claude API authentication (API key or OAuth token)
   - Checks user authorization (admin, allowed users, teams)
   - Enforces rate limiting (default: 5 minutes between runs)
   - Validates trigger labels (if configured)
   - Generates GitHub App token (if configured)

   If pre-flight fails, execution stops here.

2. **[Collect Inputs](/repo-agents/stages/collect-inputs/)** *(optional)*

   Gathers repository data for analysis (only if `inputs` configured):
   - Queries GitHub API for issues, PRs, discussions, commits, etc.
   - Filters data by time range (`since` field)
   - Checks if `min_items` threshold is met
   - Formats data as markdown for Claude

   If threshold not met, execution stops.

3. **[Claude Agent Execution](/repo-agents/stages/claude-agent/)**

   Runs Claude with your natural language instructions:
   - Sets up Bun runtime and Claude Code CLI
   - Prepares context file with event data and collected inputs
   - Creates skills documentation for allowed outputs
   - Executes Claude with appropriate tool permissions
   - Extracts and logs execution metrics (cost, turns, duration)
   - Uploads outputs artifact

   This is where your agent's instructions are executed.

4. **[Execute Outputs](/repo-agents/stages/execute-outputs/)** *(optional)*

   Validates and executes Claude's actions (only if `outputs` configured):
   - Uses matrix strategy to process each output type in parallel
   - Validates output files against JSON schemas
   - Executes GitHub operations via `gh` CLI
   - Collects validation errors for reporting

   Actions include: add comments, labels, create issues/PRs, update files, etc.

5. **[Report Results](/repo-agents/stages/report-results/)** *(optional)*

   Reports validation errors (only if `outputs` configured):
   - Posts error comments to issues/PRs with details
   - Explains what went wrong and why
   - Helps debug agent output issues

6. **[Audit Report](/repo-agents/stages/audit-report/)**

   Always runs to track metrics and handle failures:
   - Collects all audit artifacts from previous stages
   - Generates comprehensive audit report
   - Logs execution metrics (tokens, cost, duration)
   - On failure: runs diagnostic agent (safe mode, read-only)
   - Creates GitHub issues for failures (if configured)

</Steps>

## Workflow Variations

The actual jobs generated depend on your agent configuration:

**Minimal agent** (no inputs, no outputs):
```
Pre-Flight → Claude Agent → Audit Report
```

**With inputs only**:
```
Pre-Flight → Collect Inputs → Claude Agent → Audit Report
```

**With outputs only**:
```
Pre-Flight → Claude Agent → Execute Outputs → Report Results → Audit Report
```

**Full agent** (inputs + outputs):
```
Pre-Flight → Collect Inputs → Claude Agent → Execute Outputs → Report Results → Audit Report
```

## Job Dependencies

Each stage depends on previous stages:

| Stage | Depends On | Skip Condition |
|-------|------------|----------------|
| Pre-Flight | — | Never skips |
| Collect Inputs | Pre-Flight | Pre-flight fails |
| Claude Agent | Pre-Flight, Collect Inputs | Pre-flight fails OR inputs threshold not met |
| Execute Outputs | Claude Agent | Agent fails OR no outputs configured |
| Report Results | Execute Outputs | No outputs configured |
| Audit Report | All stages | Never skips (always runs) |

## See Also

- [Execution Flow Diagrams](/repo-agents/guide/agent-execution-flow/) - Visual flowcharts with Mermaid
- [How It Works](/repo-agents/guide/how-it-works/) - High-level architecture overview
- [Agent Definition](/repo-agents/guide/agent-definition/) - Configure your agents
