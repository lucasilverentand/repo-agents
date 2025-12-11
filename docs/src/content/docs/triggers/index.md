---
title: Triggers Overview
description: Understanding when your Claude agents run
---

Triggers define when your agent runs. gh-claude supports GitHub event triggers, scheduled executions, and manual invocations. Each agent must specify at least one trigger in the `on` field.

## Available Trigger Types

### Event-Based Triggers

Respond to activity in your repository:

- **[Issues](/triggers/issues/)** - React to issue activity (opened, labeled, closed, etc.)
- **[Pull Requests](/triggers/pull-requests/)** - Respond to PR events (opened, synchronize, ready_for_review, etc.)
- **[Discussions](/triggers/discussions/)** - Handle discussion activity (created, answered, etc.)

### Time-Based Triggers

Run on a schedule:

- **[Schedule](/triggers/schedule/)** - Execute on a recurring schedule using cron syntax

### Manual Triggers

Trigger agents on-demand:

- **[Workflow Dispatch](/triggers/workflow-dispatch/)** - Manual triggering with optional inputs
- **[Repository Dispatch](/triggers/repository-dispatch/)** - Trigger via API or webhooks

## Basic Usage

Define triggers in the YAML frontmatter of your agent file:

```yaml
---
name: My Agent
on:
  issues:
    types: [opened]
---
```

## Multiple Triggers

Combine multiple triggers for a single agent:

```yaml
---
name: Multi-Trigger Agent
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [opened, synchronize]
  schedule:
    - cron: '0 9 * * MON'
  workflow_dispatch:
---
```

This agent will run when:
- A new issue is opened or labeled
- A PR is opened or updated
- Every Monday at 9am UTC
- Manually triggered through GitHub UI

## Trigger Filtering

### Label-Based Triggering

Use `triggerLabels` to only run when specific labels are present:

```yaml
---
name: Bug Handler
on:
  issues:
    types: [labeled, opened]
trigger_labels: [bug, needs-investigation]
---
```

### Rate Limiting

Prevent too-frequent execution with `rateLimitMinutes`:

```yaml
---
name: Rate Limited Agent
on:
  issues:
    types: [edited]
rate_limit_minutes: 30  # Max once per 30 minutes
---
```

Default rate limit is 5 minutes if not specified.

## Best Practices

### Be Specific

Choose only the event types you need:

```yaml
# ✅ Good - specific triggers
on:
  issues:
    types: [opened]

# ❌ Avoid - too broad
on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled, assigned]
```

### Use Rate Limiting

Protect against excessive runs:

```yaml
on:
  issues:
    types: [edited]
rate_limit_minutes: 10  # Prevents spam during rapid edits
```

### Test First

Use `workflow_dispatch` to test before enabling automatic triggers:

```yaml
on:
  workflow_dispatch:
  # issues:
  #   types: [opened]  # Enable after testing
```

## Next Steps

Explore detailed documentation for each trigger type:

- [Issue Events](/triggers/issues/)
- [Pull Request Events](/triggers/pull-requests/)
- [Discussion Events](/triggers/discussions/)
- [Schedule Triggers](/triggers/schedule/)
- [Workflow Dispatch](/triggers/workflow-dispatch/)
- [Repository Dispatch](/triggers/repository-dispatch/)
