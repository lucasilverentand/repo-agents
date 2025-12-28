---
title: Security
description: Security documentation for gh-claude
---

gh-claude is designed with security as a priority. This page provides an overview and links to detailed security documentation.

## Quick Start

Before deploying an agent, ensure you:

1. **Validate** your agent: `gh claude validate --strict`
2. **Review** the generated workflow: `gh claude compile --dry-run`
3. **Check** the [Security Checklist](/gh-claude/reference/security-checklist/)

## Security Documentation

| Document | Purpose |
|----------|---------|
| [Security Model](/gh-claude/reference/security-model/) | Architecture, threat model, protection layers |
| [Security Best Practices](/gh-claude/guide/security-best-practices/) | Implementation patterns, safe configurations |
| [Security Checklist](/gh-claude/reference/security-checklist/) | Pre-deployment validation |

## Key Security Controls

### Permission-Based Access

```yaml
permissions:
  issues: write        # Explicit permission required
```

Without permissions, agents have **read-only** access.

### Output Validation

```yaml
outputs:
  add-comment: { max: 1 }  # Constrained actions
```

Agents can only perform explicitly allowed actions.

### Path Restrictions

```yaml
allowed-paths:
  - docs/**  # File access limited
```

### User Authorization

```yaml
allowed-actors:
  - trusted-user
allowed-teams:
  - maintainers
```

### Rate Limiting

```yaml
rate_limit_minutes: 10  # Prevent abuse
```

## Reporting Security Issues

Found a vulnerability? Please report it responsibly:

1. **Do not** open a public issue
2. Email the security contact (see repository)
3. Provide details and reproduction steps

## Related Documentation

- [Permissions Guide](/gh-claude/guide/permissions/) - Permission configuration
- [Authentication](/gh-claude/guide/authentication/) - API credentials
- [Outputs Overview](/gh-claude/guide/outputs/) - Agent actions
- [Configuration](/gh-claude/reference/configuration/) - Repository settings
