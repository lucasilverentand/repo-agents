---
title: Security Checklist
description: Pre-deployment security validation checklist
---

Use this checklist before deploying any agent to production.

## Permissions and Outputs

- [ ] Minimal required permissions specified
- [ ] Outputs explicitly defined with `max` limits
- [ ] No unnecessary permissions granted
- [ ] `contents: write` only if absolutely needed

## File Access

- [ ] `allowed-paths` restricted to specific directories
- [ ] No access to `.github/`, `package.json`, or credential files
- [ ] File modifications create PRs rather than direct commits (when possible)

## User Authorization

- [ ] `allowed-actors` or `allowed-teams` configured for sensitive operations
- [ ] Default authorization appropriate for use case
- [ ] Tested with non-admin users to verify authorization

## Rate Limiting

- [ ] `rate_limit_minutes` set appropriately
- [ ] Higher limits (30+) for high-frequency triggers
- [ ] Rate limiting not disabled without good reason

## Validation and Testing

- [ ] Agent validated: `gh claude validate --strict`
- [ ] Workflow reviewed: `gh claude compile --dry-run`
- [ ] Test run completed in development repo
- [ ] Reviewed workflow logs for unexpected behavior

## Credentials and Secrets

- [ ] API key set in GitHub Secrets
- [ ] Secrets not committed to repository
- [ ] Organization secrets have appropriate access
- [ ] Key rotation plan in place

## Instructions and Logic

- [ ] Agent instructions reviewed for safety
- [ ] No instructions to read/output sensitive files
- [ ] No direct copying of user-provided input
- [ ] Examples provided for expected behavior

## Monitoring and Audit

- [ ] Workflow notifications enabled
- [ ] Plan for reviewing logs regularly
- [ ] API usage monitoring configured
- [ ] Commit attribution working correctly

## Common Pitfalls

### Avoid These Patterns

```yaml
# ❌ Overly permissive paths
allowed-paths:
  - "**"

# ❌ No output limits
outputs:
  add-comment: true

# ❌ Rate limiting disabled
rate_limit_minutes: 0

# ❌ Excessive permissions
permissions:
  contents: write
  issues: write
  pull_requests: write
```

### Use These Instead

```yaml
# ✅ Specific paths
allowed-paths:
  - "docs/**"

# ✅ Limited outputs
outputs:
  add-comment: { max: 1 }

# ✅ Appropriate rate limit
rate_limit_minutes: 10

# ✅ Minimal permissions
permissions:
  issues: write
```

## See Also

- [Security Model](/gh-claude/reference/security-model/) - Architecture and threat model
- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Implementation patterns
- [Permissions](/gh-claude/guide/permissions/) - Permission configuration
