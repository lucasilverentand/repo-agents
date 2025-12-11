---
title: Security
description: Security best practices for gh-claude
---

gh-claude is designed with security as a priority. This guide covers the security model and best practices.

## Security Model

### Permission-Based Access

Agents operate under explicit permissions:

```yaml
permissions:
  issues: write        # Can modify issues
  pull_requests: read  # Can only read PRs
```

Without permissions, agents have **read-only** access to public repository data.

### Output Validation

All actions go through validated output handlers:

```yaml
outputs:
  add-comment: { max: 1 }  # Limit to 1 comment
  add-label: true           # Can add labels
```

Claude cannot perform actions not explicitly listed in `outputs`.

### Path Restrictions

File modifications require explicit path allowlisting:

```yaml
allowed-paths:
  - docs/**
  - README.md
```

Prevents agents from modifying critical files like workflow definitions or secrets.

### Sandboxed Execution

Agents run in GitHub Actions with:
- No direct system access
- Controlled API access
- Audit logs in workflow runs

## Best Practices

### 1. Minimal Permissions

Grant only necessary permissions:

```yaml
# ✅ Good - minimal permissions
permissions:
  issues: write

# ❌ Avoid - excessive permissions
permissions:
  contents: write
  issues: write
  pull_requests: write
```

### 2. Constrain Outputs

Use limits to prevent abuse:

```yaml
outputs:
  add-comment: { max: 1 }    # Prevent comment spam
  create-issue: { max: 5 }   # Limit issue creation
```

### 3. Restrict File Access

Limit file modification scope:

```yaml
# ✅ Good - specific paths
allowed-paths:
  - docs/**
  - README.md

# ❌ Avoid - overly broad
allowed-paths:
  - "**"
```

### 4. Validate Before Deploy

Always validate agents:

```bash
gh claude validate --all --strict
```

### 5. Review Generated Workflows

Check compiled workflows before committing:

```bash
gh claude compile --dry-run --all
```

### 6. Use Team Restrictions

Limit who can trigger agents:

```yaml
allowed-actors:
  - trusted-user
allowed-teams:
  - maintainers
```

### 7. Secure API Keys

Store API keys in GitHub Secrets:

```bash
gh secret set ANTHROPIC_API_KEY
```

Never commit API keys to the repository.

## Common Security Patterns

### Read-Only Analysis

Agent analyzes but takes no actions:

```yaml
# No outputs - read-only
permissions:
  issues: read
```

Results appear in workflow logs only.

### Controlled Interaction

Agent can comment but not modify:

```yaml
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
```

### Documentation Updates

Agent can update docs but nothing else:

```yaml
permissions:
  contents: write
  pull_requests: write
allowed-paths:
  - docs/**
outputs:
  update-file: { sign: true }
  create-pr: { sign: true, max: 1 }
```

## Security Checklist

Before deploying an agent:

- [ ] Minimal required permissions specified
- [ ] Outputs explicitly defined with limits
- [ ] File paths restricted (if using `update-file`)
- [ ] Agent validated with `--strict` mode
- [ ] Generated workflow reviewed
- [ ] API key stored in secrets
- [ ] Team/actor restrictions considered
- [ ] Instructions reviewed for safety

## Threat Model

### What gh-claude Protects Against

- **Unauthorized actions**: Output validation prevents unexpected actions
- **Excessive API usage**: Token limits and output constraints
- **File corruption**: Path restrictions and git history
- **Privilege escalation**: Permission-based access control

### What You Should Protect Against

- **Malicious instructions**: Review agent instructions carefully
- **Social engineering**: Validate PR changes to agents
- **API key exposure**: Use secrets, never commit keys
- **Workflow tampering**: Protect `.github/` directory

## Reporting Security Issues

Found a security vulnerability? Please report it responsibly:

1. **Do not** open a public issue
2. Email security contact (see repository)
3. Provide details and reproduction steps

## Audit and Compliance

### Workflow Logs

All agent runs are logged:
- Claude API calls
- Actions performed
- Errors and failures

Access via GitHub Actions logs.

### Git History

All file changes are committed:
- Full attribution
- Reversible via git
- Signed commits available

## Related Resources

- [Permissions](../../guide/permissions/)
- [Outputs](../../guide/outputs/)
- [Configuration](configuration/)
