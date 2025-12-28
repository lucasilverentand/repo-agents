---
title: Advanced Topics
description: Advanced patterns and techniques for gh-claude agents
---

This guide provides an overview of advanced techniques. See linked guides for details.

## Advanced Guides

| Topic | Description |
|-------|-------------|
| [Multi-Agent Patterns](/gh-claude/guide/multi-agent-patterns/) | Coordinating multiple agents |
| [Testing Strategies](/gh-claude/guide/testing-strategies/) | Safe development and testing |
| [Cost Estimation](/gh-claude/guide/cost-estimation/) | API cost management |
| [Security Best Practices](/gh-claude/guide/security-best-practices/) | Secure agent configuration |

## Workflow Dispatch Inputs

Enable manual triggers with user-provided inputs:

```yaml
on:
  workflow_dispatch:
    inputs:
      target:
        description: 'Target to analyze'
        required: true
        type: string
      mode:
        description: 'Analysis mode'
        type: choice
        options:
          - quick
          - detailed
        default: quick
```

Reference inputs in your agent instructions to modify behavior based on user input.

**[→ Workflow Dispatch Trigger](/gh-claude/triggers/workflow-dispatch/)**

## Input Filtering and Collection

The `inputs` field provides data collection before agent execution:

```yaml
inputs:
  issues:
    states: [open]
    labels: [bug]
    limit: 100
  pull_requests:
    states: [merged]
    limit: 50
  since: 7d        # Last 7 days
  min_items: 5     # Skip if fewer items
```

**Available inputs**: issues, pull_requests, discussions, commits, releases, workflow_runs, stars, forks

**[→ Inputs Overview](/gh-claude/inputs/)**

## Path Patterns

Control file modification scope with glob patterns:

```yaml
allowed-paths:
  - docs/**           # Directory and contents
  - "**/*.md"         # All markdown files
  - "!.github/**"     # Exclude .github
  - src/types/**/*.ts # Specific file types
```

**[→ Output Files](/gh-claude/outputs/files/)**

## Team-Based Access Control

Restrict agent triggers to specific users or teams:

```yaml
allowed-teams:
  - maintainers
  - security-team

allowed-actors:
  - trusted-bot
  - admin-user
```

**[→ Permissions Guide](/gh-claude/guide/permissions/)**

## Rate Limiting

Prevent excessive runs:

```yaml
# Aggressive - max once per hour
rate_limit_minutes: 60

# Moderate - max once per 5 minutes
rate_limit_minutes: 5

# No limit (use cautiously)
rate_limit_minutes: 0
```

**[→ Triggers Overview](/gh-claude/triggers/)**

## Performance Optimization

### Use Specific Triggers

```yaml
# More efficient - only specific labels
on:
  issues:
    types: [labeled]
trigger_labels:
  - needs-review
```

### Batch Processing

```yaml
# Process multiple items per run
on:
  schedule:
    - cron: '0 * * * *'  # Hourly
inputs:
  issues:
    states: [open]
    since: last-run
  min_items: 1
```

### Optimize Claude Configuration

```yaml
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 1024        # Lower for simple tasks
  temperature: 0.3        # More deterministic
```

## See Also

- [Quick Reference](/gh-claude/reference/quick-reference/) - Field lookup tables
- [Examples](/gh-claude/examples/) - Complete agent examples
- [Troubleshooting](/gh-claude/guide/troubleshooting/) - Common issues
