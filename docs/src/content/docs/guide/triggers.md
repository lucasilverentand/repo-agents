---
title: Triggers
description: Configure when your Claude agents run
---

Triggers define when your agent runs. You can respond to GitHub events, run on schedules, or trigger manually.

## Event Triggers

### Issue Events

```yaml
on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled]
```

### Pull Request Events

```yaml
on:
  pull_request:
    types: [opened, synchronize, closed, reopened, edited]
```

### Discussion Events

```yaml
on:
  discussion:
    types: [created, edited, answered, deleted]
```

## Schedule Triggers

Run agents on a schedule using cron syntax:

```yaml
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am
    - cron: '0 0 * * *'     # Daily at midnight
```

## Manual Triggers

### Workflow Dispatch

Allow manual triggering with inputs:

```yaml
on:
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for manual run'
        required: true
      target:
        description: 'Target scope'
        required: false
        default: 'all'
```

### Repository Dispatch

Trigger via API or webhooks:

```yaml
on:
  repository_dispatch:
    types: [custom-event, data-sync]
```

## Multiple Triggers

Combine multiple triggers:

```yaml
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]
  schedule:
    - cron: '0 9 * * MON'
```

## Next Steps

- Learn about [Outputs](/guide/outputs/)
- See [Agent Definition](/guide/agent-definition/)
