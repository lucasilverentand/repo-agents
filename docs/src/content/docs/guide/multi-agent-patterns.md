---
title: Multi-Agent Patterns
description: Patterns for coordinating multiple gh-claude agents
---

Coordinate multiple agents to create sophisticated workflows.

## Agent Coordination Strategy

### Divide Responsibilities

Split work across specialized agents:

```yaml
# agent-1-triage.md - Initial categorization
---
name: Issue Triage
on:
  issues:
    types: [opened]
outputs:
  add-label: true
  add-comment: { max: 1 }
---
Add category labels: bug, feature, docs, question
Do NOT assign priority or ownership.

# agent-2-prioritize.md - Priority assessment
---
name: Priority Assessment
on:
  issues:
    types: [labeled]
trigger_labels:
  - bug
  - feature
outputs:
  add-label: true
---
Add priority labels based on impact and urgency.
Only runs after triage agent adds category.
```

### Use Labels as Handoff Signals

Labels can trigger subsequent agents:

```yaml
---
name: PR Initial Review
on:
  pull_request:
    types: [opened]
outputs:
  add-label: true
  add-comment: { max: 1 }
---
Initial review. Add "ready-for-detailed-review" when satisfied.

# Separate agent triggered by label
---
name: PR Detailed Review
on:
  pull_request:
    types: [labeled]
trigger_labels:
  - ready-for-detailed-review
outputs:
  add-comment: { max: 1 }
---
Detailed code review.
```

## State Machine Pattern

Use labels to track issue progression:

```yaml
---
name: Progressive Issue Handler
on:
  issues:
    types: [labeled]
trigger_labels:
  - needs-investigation
  - needs-reproduction
  - needs-design
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
  remove-label: true
---

Based on current label:

**needs-investigation:**
- Analyze issue description
- Add "investigating" label
- Remove "needs-investigation"

**needs-reproduction:**
- Check for reproduction steps
- Add "reproduced" or "cannot-reproduce"
- Remove "needs-reproduction"

**needs-design:**
- Review proposed solutions
- Add "design-reviewed"
- Remove "needs-design"
```

## Preventing Conflicts

### Rate Limiting

Prevent cascading triggers:

```yaml
---
name: Quick Response Agent
rate_limit_minutes: 5  # Prevent rapid re-triggering
on:
  issues:
    types: [labeled]
---
```

### Mutual Exclusion

Use labels to prevent overlap:

```yaml
---
name: Agent A
trigger_labels:
  - track-a
exclude_labels:
  - track-b
---
Only runs on track-a, never when track-b is present.

---
name: Agent B
trigger_labels:
  - track-b
exclude_labels:
  - track-a
---
Only runs on track-b, never when track-a is present.
```

## Hybrid Triggers

Combine automated and manual triggers:

```yaml
---
name: Issue Analyzer
on:
  issues:
    types: [opened, labeled]
  workflow_dispatch:
    inputs:
      issueNumber:
        description: 'Specific issue to analyze'
        type: string
  schedule:
    - cron: '0 0 * * MON'  # Weekly review
---

**If triggered by new issue:**
- Perform immediate triage

**If triggered manually with issue number:**
- Deep analysis of specified issue

**If triggered by schedule:**
- Review all open issues
- Identify stale issues
```

## See Also

- [Triggers Overview](/gh-claude/triggers/) - Trigger configuration
- [Advanced Topics](/gh-claude/guide/advanced/) - More advanced patterns
- [Examples](/gh-claude/examples/) - Complete agent examples
