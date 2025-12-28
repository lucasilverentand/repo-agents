---
title: Permissions
description: Control what your Claude agents can access
---

Permissions control what GitHub resources your agent can read and write.

## Permission Types

### Contents

Access repository files:

```yaml
permissions:
  contents: read   # Read files
  contents: write  # Modify files
```

### Issues

Manage issues:

```yaml
permissions:
  issues: read   # Read issues
  issues: write  # Create, edit, comment on issues
```

### Pull Requests

Manage pull requests:

```yaml
permissions:
  pull_requests: read   # Read PRs
  pull_requests: write  # Create, edit, comment on PRs
```

Note: Uses underscore `pull_requests`, not hyphen.

### Discussions

Manage discussions:

```yaml
permissions:
  discussions: read   # Read discussions
  discussions: write  # Create, edit discussions
```

## Default Behavior

Without explicit permissions, agents have **read-only** access.

## Best Practices

### Minimal Permissions

Only grant necessary permissions:

```yaml
# Good - minimal required permissions
permissions:
  issues: write

# Avoid - unnecessary permissions
permissions:
  contents: write
  issues: write
  pull_requests: write
  discussions: write
```

### Combine with Outputs

Permissions and outputs work together:

```yaml
permissions:
  issues: write       # Required for issue operations
outputs:
  add-comment: true   # Specific action allowed
  add-label: true
```

## See Also

- [Outputs Overview](/gh-claude/guide/outputs/) - Actions your agent can take
- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Secure permission patterns
- [Agent Definition](/gh-claude/guide/agent-definition/) - Complete agent configuration
- [Quick Reference](/gh-claude/reference/quick-reference/) - Permission lookup table
