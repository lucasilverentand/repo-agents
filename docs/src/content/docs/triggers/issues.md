---
title: Issue Events
description: Respond to issue activity in your repository
---

Trigger your agent when issues are created, updated, labeled, or otherwise modified.

## Basic Configuration

```yaml
on:
  issues:
    types: [opened]
```

## Available Event Types

- **`opened`** - Issue is created
- **`edited`** - Issue title or body is modified
- **`deleted`** - Issue is deleted
- **`transferred`** - Issue is transferred to another repository
- **`pinned`** - Issue is pinned
- **`unpinned`** - Issue is unpinned
- **`closed`** - Issue is closed
- **`reopened`** - Issue is reopened
- **`assigned`** - Issue is assigned to someone
- **`unassigned`** - Issue is unassigned
- **`labeled`** - Label is added to issue
- **`unlabeled`** - Label is removed from issue
- **`locked`** - Issue conversation is locked
- **`unlocked`** - Issue conversation is unlocked
- **`milestoned`** - Issue is added to milestone
- **`demilestoned`** - Issue is removed from milestone

## Common Use Cases

### Issue Triage

Automatically categorize and label new issues:

```yaml
---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
---

Analyze new issues and:
1. Categorize with appropriate labels (bug, feature, documentation, question)
2. Assess priority
3. Welcome the contributor
```

### Label-Based Routing

React when specific labels are added:

```yaml
---
name: Bug Investigation
on:
  issues:
    types: [labeled]
trigger_labels: [bug, needs-investigation]
permissions:
  issues: write
---

When a bug is reported:
1. Check for reproduction steps
2. Request additional information if needed
3. Add priority label based on severity
```

### Stale Issue Management

Close or update issues that haven't had activity:

```yaml
---
name: Stale Issue Cleanup
on:
  issues:
    types: [labeled]
  schedule:
    - cron: '0 0 * * *'  # Check daily
trigger_labels: [stale]
permissions:
  issues: write
---

For stale issues:
1. Check last activity date
2. Add warning comment if approaching closure
3. Close if no activity after warning
```

### Auto-Assignment

Automatically assign issues based on content:

```yaml
---
name: Issue Router
on:
  issues:
    types: [opened]
permissions:
  issues: write
---

Route issues to the right team member:
1. Analyze issue content and labels
2. Determine relevant area (frontend, backend, docs)
3. Assign to appropriate team member
```

## Multiple Event Types

Listen to multiple events:

```yaml
on:
  issues:
    types: [opened, edited, labeled]
```

## Available Data

When your agent runs, it has access to:

- **Issue number** - via `${{ github.event.issue.number }}`
- **Issue title** - via `${{ github.event.issue.title }}`
- **Issue body** - via `${{ github.event.issue.body }}`
- **Issue author** - via `${{ github.event.issue.user.login }}`
- **Issue labels** - via `${{ github.event.issue.labels }}`
- **Issue state** - via `${{ github.event.issue.state }}`

Access this data using the `gh` CLI:

```bash
# Get issue details
gh issue view ${{ github.event.issue.number }}

# Get issue comments
gh issue view ${{ github.event.issue.number }} --comments
```

## Required Permissions

For read-only operations:

```yaml
permissions:
  issues: read
```

For operations that modify issues:

```yaml
permissions:
  issues: write
```

See [Permissions](/guide/permissions/) for details.

## Rate Limiting

Issues can be edited frequently. Use rate limiting to prevent excessive runs:

```yaml
on:
  issues:
    types: [edited]
rate_limit_minutes: 10  # Max once per 10 minutes
```

## Best Practices

### Choose Specific Events

Don't listen to all events if you only need specific ones:

```yaml
# ❌ Too broad
on:
  issues:
    types: [opened, edited, closed, reopened, labeled, unlabeled, assigned, unassigned]

# ✅ Specific
on:
  issues:
    types: [opened]
```

### Use Label Filtering

Reduce unnecessary runs by filtering on labels:

```yaml
on:
  issues:
    types: [labeled, opened]
trigger_labels: [needs-triage]
```

This only triggers when the issue has the `needs-triage` label.

### Handle Edge Cases

Remember that:
- Users can rapidly edit issues
- Labels can be added and removed multiple times
- Issues can be reopened after closure

Use rate limiting and idempotent operations to handle these cases gracefully.

## Examples

### Welcome First-Time Contributors

```yaml
---
name: Welcome Bot
on:
  issues:
    types: [opened]
permissions:
  issues: write
---

Check if this is the user's first issue in the repository.
If so, welcome them warmly and provide helpful links to:
- Contributing guidelines
- Code of conduct
- How to get help
```

### Require Issue Template

```yaml
---
name: Template Validator
on:
  issues:
    types: [opened]
permissions:
  issues: write
---

Check if the issue follows the template:
1. Verify required sections are present
2. If missing, add a comment requesting proper formatting
3. Add 'needs-template' label
```

## Next Steps

- Learn about [Pull Request triggers](/triggers/pull-requests/)
- Understand [Permissions](/guide/permissions/)
- See [Issue Triage example](/examples/issue-triage/)
