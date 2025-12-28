---
title: Issues (create-issue, close-issue)
description: Enable agents to create and close GitHub issues
---

The `create-issue` and `close-issue` outputs enable your agent to manage issues in your repository. Use issues to track bugs, feature requests, and work items.

## Configuration

### Simple Enable

Enable issue management without restrictions:

```yaml
outputs:
  create-issue: true
  close-issue: true
```

### With Options

Limit the maximum number of issues created per run:

```yaml
outputs:
  create-issue: { max: 1 }
  close-issue: true
```

**Options for `create-issue`:**
- `max` - Maximum number of issues the agent can create in a single run (default: unlimited)

**Options for `close-issue`:**
- No configuration options available

### Individual Control

Enable only the operations needed:

```yaml
outputs:
  create-issue: { max: 3 }  # Can create issues
  # close-issue not specified - cannot close
```

## Permission Requirements

### create-issue

Requires `issues: write` permission:

```yaml
permissions:
  issues: write

outputs:
  create-issue: { max: 1 }
```

### close-issue

Requires `issues: write` permission:

```yaml
permissions:
  issues: write

outputs:
  close-issue: true
```

### Both Operations

```yaml
permissions:
  issues: write

outputs:
  create-issue: { max: 2 }
  close-issue: true
```

## Creating Issues

### Single Issue Per Run

Recommended limit to prevent accidental issue spam:

```yaml
permissions:
  issues: write

outputs:
  create-issue: { max: 1 }
```

### Multiple Issues

Allow creating multiple issues when processing batches:

```yaml
permissions:
  issues: write

outputs:
  create-issue: { max: 10 }
```

**Use case:** Daily summary issues, batch bug creation, etc.

### Issue Title and Body

When creating issues, provide clear titles and descriptions:

```markdown
Title: "Refactor authentication module"

Body:
The authentication module has grown complex and needs refactoring:
- Consolidate duplicate code
- Add proper error handling
- Update tests for new structure

Acceptance criteria:
- [ ] All tests pass
- [ ] Code review approved
- [ ] Performance benchmarks stable
```

## Closing Issues

### Basic Close

Close issues without additional context:

```yaml
permissions:
  issues: write

outputs:
  close-issue: true
```

### Close with Comment

Combine with `add-comment` to explain closure:

```yaml
permissions:
  issues: write

outputs:
  close-issue: true
  add-comment: { max: 1 }
```

## Agent Configuration Examples

### Automated Daily Summary

```yaml
name: Daily Summary
on:
  schedule:
    - cron: '0 9 * * MON'

permissions:
  issues: write

outputs:
  create-issue: { max: 1 }

inputs:
  issues:
    since: 24h
  pull_requests:
    since: 24h
```

**In your agent instructions:**
```markdown
Create a daily summary issue with:
- Title: "Daily Summary - [Date]"
- New issues count by label
- Closed issues count
- Open PRs needing review
- Blocked items

Only create if there was activity in the last 24 hours.
```

### Automated Bug Report Grouping

```yaml
name: Group Related Bugs
on:
  issues:
    types:
      - opened

permissions:
  issues: write

outputs:
  create-issue: { max: 1 }
  add-comment: { max: 1 }

inputs:
  issues:
    since: 7d
```

**In your agent instructions:**
```markdown
When a new bug is opened:
- Search for related bugs with similar errors or components
- If duplicates exist, close this one with a comment linking to the primary issue
- If multiple related bugs exist, create a meta-issue to track them

Only close if you're certain it's a duplicate.
```

### Stale Issue Management

```yaml
name: Close Stale Issues
on:
  schedule:
    - cron: '0 2 * * *'

permissions:
  issues: write

outputs:
  close-issue: true
  add-comment: { max: 1 }

inputs:
  issues:
    since: 30d
```

**In your agent instructions:**
```markdown
Find and close stale issues:
- Look for "status/needs-info" label not updated in 30 days
- Comment: "Closing due to inactivity. Please reopen if you have more information."
- Close the issue

Don't close issues with active milestones, priority/critical label, or recent maintainer comments.
```

### Release Note Generation

```yaml
name: Generate Release Notes
on:
  release:
    types:
      - published

permissions:
  issues: write

outputs:
  create-issue: { max: 1 }

inputs:
  pull_requests:
    since: last-run
```

**In your agent instructions:**
```markdown
Create release tracking issue:
- Title: "Release v[version] Complete"
- Include: release link, changes summary, known issues, breaking changes
- Labels: release, documentation
```

### Automated Incident Response

```yaml
name: Create Critical Issues
on:
  workflow_run:
    workflows:
      - ci.yml
    types:
      - completed

permissions:
  issues: write

outputs:
  create-issue: { max: 5 }
  add-comment: { max: 1 }

inputs:
  workflow_runs:
    since: 1h
```

**In your agent instructions:**
```markdown
When CI fails:
- Check if critical issue was already created today
- If not, create issue with title "CI Failed: [workflow name]"
- Include: workflow run link, failure reason, last commit
- Labels: type/bug, priority/high, ci
- If issue exists, add comment with update
```

## Use Cases

### Daily Reports
Create periodic summary issues for tracking:
```yaml
outputs:
  create-issue: { max: 1 }
```

### Bug Deduplication
Close duplicate bugs and consolidate discussions:
```yaml
outputs:
  close-issue: true
  add-comment: { max: 1 }
```

### Release Management
Generate release notes and track releases:
```yaml
outputs:
  create-issue: { max: 1 }
```

### Stale Issue Cleanup
Close inactive issues to keep backlog clean:
```yaml
outputs:
  close-issue: true
```

### Incident Management
Auto-create issues for critical events:
```yaml
outputs:
  create-issue: { max: 1 }
```

## Best Practices

### 1. Set Reasonable Limits

Always use `max` for `create-issue`:

```yaml
outputs:
  create-issue: { max: 1 }  # Recommended minimum
```

Without a limit, issues could proliferate unexpectedly.

### 2. Provide Clear Content

Issue titles and bodies should be specific and actionable:

```markdown
# Good - clear and actionable
Title: "Add validation to email input field"
Body: "The email input doesn't validate format before submission..."

# Bad - vague and unclear
Title: "Fix stuff"
Body: "Something is broken"
```

### 3. Use Labels Consistently

Combine with `add-label` for better organization:

```yaml
outputs:
  create-issue: { max: 1 }
  add-label: true
```

### 4. Check for Duplicates

Before creating issues, verify they don't already exist:

```markdown
Search for existing issues with similar:
- Titles
- Error messages
- Component references
```

### 5. Add Context

Include relevant information:
- Steps to reproduce (for bugs)
- Use cases (for features)
- Environment details (for errors)
- Links to related issues

## Security Considerations

### Issue Content

Issues are public - be careful with:
- Internal system details
- Performance metrics
- Configuration information
- User data

```markdown
# Good - appropriately vague
Encountered timeout in payment processing.

# Bad - too specific
Timeout when calling internal API at service.internal.company.com:8443/payments
```

### Issue Creation Limits

The `max` parameter prevents issue spam:

```yaml
outputs:
  create-issue: { max: 1 }  # Essential safeguard
```

### Access Control

Only grant `issues: write` to agents that truly need it:

```yaml
# Good - minimal permissions
permissions:
  issues: write
outputs:
  close-issue: true

# Avoid - if agent doesn't need both
permissions:
  issues: write
  pull_requests: write
  contents: write
outputs:
  close-issue: true
```

## Troubleshooting

### Issues Not Being Created

Check that:
1. The `permissions` section includes `issues: write`
2. The agent has logic to determine when to create issues
3. The `max` limit hasn't been reached for that run

### Too Many Issues Created

If your agent creates more issues than expected:
1. Lower the `max` value
2. Review the agent logic to add conditions
3. Test with dry-run before deploying

### Duplicate Issues

Refine agent logic to:
1. Search for existing issues before creating
2. Compare title and key terms with existing issues
3. Add deduplication logic

## Related Outputs

- [Comments (add-comment)](./comments/) - Pair with issue management
- [Labels (add-label, remove-label)](./labels/) - For issue organization
- [Pull Requests (create-pr, close-pr)](./pull-requests/) - For PR management

## Next Steps

- Learn about [Triggers](../../triggers/) to control when issue operations run
- Explore [Inputs](../../inputs/) to collect issue data
- Review [Security Best Practices](../../reference/security/)
