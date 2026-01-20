---
title: Context Building Stage
slug: stages/context-building
description: Gathering event data and repository context for agent execution
sidebar:
  label: 2. Context Building
---

This stage prepares the context the agent will work with. It collects event data such as issue, PR, or discussion details, and can query the GitHub API for additional inputs when configured. For scheduled agents, it filters data by time range. All collected data is formatted as markdown that the agent can read and understand.

**This stage only runs if `context` is configured in the agent definition.**

## Purpose

- Collect event data (issue, PR, or discussion details)
- Query the GitHub API for additional inputs when configured
- Filter data by time range for scheduled agents
- Format all collected data as markdown for the agent

## Steps

### 1. Query GitHub API

Uses the GitHub CLI to query various data types based on your `context` configuration.

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
| `has-context` | `true` if enough data collected, `false` otherwise |
| `context-data` | Formatted markdown of collected data |

## Skipping Execution

When `min_items` threshold isn't met:

1. The collect-context job outputs `has-context=false`
2. The agent job is skipped
3. The audit-report job records "skipped due to insufficient context"

This prevents wasting API calls when there's nothing for the agent to process.

