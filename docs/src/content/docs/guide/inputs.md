---
title: Inputs Overview
description: Collect repository data for scheduled agents
---

The inputs system enables scheduled agents to collect repository data before execution. This is essential for creating reports, summaries, or alerts based on repository activity.

## What Are Inputs?

Inputs allow agents to query GitHub data (issues, PRs, commits, etc.) and pass it to Claude for analysis. Agents with inputs automatically skip execution if no data is collected.

## Quick Example

```yaml
inputs:
  issues:
    states: [open, closed]
    limit: 50
  pull_requests:
    states: [merged]
  since: last-run
  min_items: 5
```

## Available Input Types

| Type | Description |
|------|-------------|
| `issues` | Open/closed issues with filtering |
| `pull_requests` | PRs with state and review filters |
| `discussions` | Community discussions |
| `commits` | Recent commits by branch/author |
| `releases` | Published releases |
| `workflow_runs` | CI/CD run results |
| `stars` | Repository star count |
| `forks` | Repository fork count |

## Key Configuration Options

### Time Filtering (`since`)

Control the time range for data collection:

- `last-run` - Since last successful workflow run (default)
- `1h`, `6h`, `12h`, `24h` - Last N hours
- `7d`, `30d` - Last N days

### Minimum Threshold (`min_items`)

Skip agent execution if insufficient data:

```yaml
inputs:
  issues:
    states: [open]
  min_items: 5  # Skip if fewer than 5 items
```

## Complete Documentation

For detailed configuration options, filtering, and examples:

**[Complete Inputs Reference](/gh-claude/inputs/)**

Individual input type documentation:
- [Issues](/gh-claude/inputs/issues/)
- [Pull Requests](/gh-claude/inputs/pull-requests/)
- [Discussions](/gh-claude/inputs/discussions/)
- [Commits](/gh-claude/inputs/commits/)
- [Releases](/gh-claude/inputs/releases/)
- [Workflow Runs](/gh-claude/inputs/workflow-runs/)
- [Time Filtering](/gh-claude/inputs/time-filtering/)

## See Also

- [Daily Summary Example](/gh-claude/examples/daily-summary/) - Inputs in action
- [How It Works](/gh-claude/guide/how-it-works/) - Workflow execution details
