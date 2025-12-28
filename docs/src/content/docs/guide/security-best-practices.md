---
title: Security Best Practices
description: Best practices for securing your Claude-powered agents
---

# Security Best Practices

Follow these guidelines to keep your agents secure and your repository protected.

## Principle of Least Privilege

Grant only the permissions your agent actually needs.

### Bad: Over-permissioned

```yaml
permissions:
  contents: write
  issues: write
  pull_requests: write
  discussions: write
```

### Good: Minimal permissions

```yaml
# For an issue triage agent
permissions:
  issues: write  # Only what's needed
```

## Restrict File Access

Always use `allowed-paths` when agents can modify files.

### Bad: Unrestricted access

```yaml
outputs:
  update-file: true
  # No path restrictions!
```

### Good: Scoped access

```yaml
outputs:
  update-file: true
allowed-paths:
  - "docs/**"
  - "*.md"
  - "!docs/internal/**"  # Exclude sensitive docs
```

## Limit Output Quantities

Use `max` limits to prevent runaway agents.

```yaml
outputs:
  add-comment: { max: 3 }      # Prevent comment spam
  create-issue: { max: 5 }     # Limit issue creation
  add-label: true              # Labels are safe, no limit needed
```

## Rate Limiting

Prevent agents from running too frequently:

```yaml
rate_limit_minutes: 10  # At least 10 minutes between runs
```

For scheduled agents, consider appropriate intervals:
- Daily reports: `cron: '0 9 * * *'`
- Weekly cleanup: `cron: '0 0 * * 1'`

## User Authorization

Restrict who can trigger agents:

```yaml
# Only allow specific users
allowed-users:
  - maintainer1
  - maintainer2

# Or require organization membership
allowed-actors:
  - org-member

# Or specific teams
allowed-teams:
  - core-team
  - maintainers
```

## Trigger Labels

Require explicit labels to trigger agents:

```yaml
trigger_labels:
  - claude-review
  - needs-triage
```

This prevents agents from running on every issue/PR.

## Sensitive Data

### Never Include in Agent Instructions

- API keys or tokens
- Passwords or secrets
- Internal URLs or endpoints
- Personal information

### Be Careful With

- Repository structure details
- Team member names
- Internal processes

## GitHub App vs Default Token

| Feature | Default Token | GitHub App |
|---------|--------------|------------|
| Identity | `github-actions[bot]` | Your app name |
| CI triggers | PRs don't trigger CI | PRs trigger CI |
| Permissions | Workflow-level | Fine-grained |
| Audit trail | Generic | Branded |

**Recommendation**: Use a GitHub App for production agents.

```bash
gh claude setup-app
```

## Audit Configuration

Enable failure tracking for visibility:

```yaml
audit:
  create_issues_on_failure: true
  failure_label: agent-failure
```

## Pre-Deployment Checklist

Before deploying an agent:

- [ ] Permissions are minimal for the task
- [ ] `allowed-paths` restricts file access
- [ ] Output limits (`max`) are set appropriately
- [ ] Rate limiting is configured
- [ ] User authorization is set up
- [ ] Trigger labels are used (if appropriate)
- [ ] No sensitive data in instructions
- [ ] Audit configuration is enabled
- [ ] Agent tested with `workflow_dispatch` first

## Testing Safely

Always test agents before deploying to production:

```yaml
on:
  workflow_dispatch:  # Manual trigger for testing
  # Add production triggers after testing:
  # issues:
  #   types: [opened]
```

## See Also

- [Permissions](/gh-claude/guide/permissions/) - Permission configuration
- [Authentication](/gh-claude/guide/authentication/) - Auth setup
- [Security Reference](/gh-claude/reference/security/) - Detailed security documentation
