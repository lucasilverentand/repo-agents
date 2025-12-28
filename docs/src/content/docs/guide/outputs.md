---
title: Outputs Overview
description: Actions your agent can take
---

Outputs define what actions your agent is allowed to take. Each output type requires explicit configuration to enable.

## Quick Example

```yaml
outputs:
  add-comment: { max: 3 }
  add-label: true
  create-issue: { max: 1 }
```

## Available Output Types

| Type | Description | Permission Required |
|------|-------------|---------------------|
| `add-comment` | Comment on issues/PRs | None |
| `add-label` | Add labels | None |
| `remove-label` | Remove labels | None |
| `create-issue` | Create new issues | `issues: write` |
| `close-issue` | Close issues | `issues: write` |
| `create-pr` | Create pull requests | `contents: write` |
| `close-pr` | Close pull requests | `pull_requests: write` |
| `update-file` | Modify files | `contents: write` |
| `create-discussion` | Create discussions | `discussions: write` |

## Key Configuration Options

### Maximum Limits

Prevent runaway behavior with `max`:

```yaml
outputs:
  add-comment: { max: 1 }   # Only one comment per run
  create-issue: { max: 3 }  # At most 3 issues
```

### Path Restrictions

File modifications require explicit path allowlisting:

```yaml
allowed-paths:
  - docs/**/*.md
  - README.md
outputs:
  update-file: true
```

### Commit Signing

Sign commits for file operations:

```yaml
outputs:
  update-file: { sign: true }
  create-pr: { sign: true }
```

## Complete Documentation

For detailed configuration, examples, and best practices:

**[Complete Outputs Reference](/gh-claude/outputs/)**

Individual output type documentation:
- [Comments](/gh-claude/outputs/comments/)
- [Labels](/gh-claude/outputs/labels/)
- [Issues](/gh-claude/outputs/issues/)
- [Pull Requests](/gh-claude/outputs/pull-requests/)
- [Files](/gh-claude/outputs/files/)
- [Discussions](/gh-claude/outputs/discussions/)

## See Also

- [Permissions](/gh-claude/guide/permissions/) - Required permissions for each output
- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Secure output configuration
