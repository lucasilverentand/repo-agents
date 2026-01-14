---
title: Collect Inputs Stage
description: Gathering repository data before agent execution
---

The collect-inputs stage queries the GitHub API to gather data for the agent. This is particularly useful for scheduled agents that need to process multiple items.

**This stage only runs if `inputs` is configured in the agent definition.**

## Purpose

- Query repository data (issues, PRs, discussions, commits, etc.)
- Filter data by time range
- Skip agent execution if minimum threshold not met
- Format collected data for Claude

## Steps

### 1. Query GitHub API

Uses the GitHub CLI to query various data types based on your `inputs` configuration.

**Available data types:**
- `issues` — Repository issues
- `pull_requests` — Pull requests
- `discussions` — GitHub discussions
- `commits` — Recent commits
- `releases` — Repository releases
- `workflow_runs` — Workflow run history
- `stars` — Repository stargazers
- `forks` — Repository forks

### 2. Filter by Time Range

The `since` field filters data to a specific time window.

**Available values:**
- `last-run` — Since the workflow last ran successfully
- `1h`, `2h`, `6h`, `12h` — Hours
- `24h`, `48h`, `72h` — Days (in hours)
- `7d`, `14d`, `30d` — Days

### 3. Check Minimum Threshold

If `min_items` is set, the agent only runs if enough data was collected. This prevents the agent from running unnecessarily when there's nothing to process.

### 4. Format Data for Claude

Collected data is formatted as markdown sections and passed to Claude as part of the context. Each item includes relevant metadata like title, author, labels, and body content.

## Outputs

| Output | Description |
|--------|-------------|
| `has-inputs` | `true` if enough data collected, `false` otherwise |
| `inputs-data` | Formatted markdown of collected data |

## Skipping Execution

When `min_items` threshold isn't met:

1. The collect-inputs job outputs `has-inputs=false`
2. The claude-agent job is skipped
3. The audit-report job records "skipped due to insufficient inputs"

This prevents wasting API calls when there's nothing for the agent to process.

## See Also

- [Inputs Overview](/repo-agents/inputs/) - All input types
- [Time Filtering](/repo-agents/inputs/time-filtering/) - Time range options
- [Schedule Trigger](/repo-agents/triggers/schedule/) - Cron scheduling
