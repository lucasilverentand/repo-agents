---
title: Security Model
description: Technical security architecture and threat model for gh-claude
---

gh-claude implements a defense-in-depth security model with multiple layers of protection.

## Core Security Architecture

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

### Sandboxed Execution

Agents run in GitHub Actions with:
- No direct system access
- Controlled API access
- Audit logs in workflow runs

## Threat Model

### What gh-claude Protects Against

#### Unauthorized Actions
- **Output validation**: Agents can only perform actions explicitly listed in `outputs`
- **Action limits**: Configurable `max` constraints prevent spam
- **No implicit actions**: Without `outputs`, agents are read-only

#### Unauthorized Users
- **User authorization checks**: Only admins, write users, org members, or allowed users
- **Team-based access**: `allowed-teams` restricts to specific GitHub teams
- **Actor allowlists**: `allowed-actors` limits to specific usernames

#### Excessive Resource Usage
- **Rate limiting**: Default 5-minute minimum between runs
- **Token limits**: Claude API token limits constrain response length
- **Output constraints**: Limits on comments, issues, PRs prevent abuse

#### File System Tampering
- **Path restrictions**: `allowed-paths` defines modifiable paths
- **Git history protection**: All changes committed with attribution
- **Workflow isolation**: Cannot modify `.github/workflows/` by default

#### Privilege Escalation
- **Permission-based access**: Explicit `permissions` required for writes
- **Minimal defaults**: Read-only by default
- **Sandboxed execution**: Isolated GitHub Actions runners

#### Code Injection
- **No arbitrary code execution**: Controlled tool access only
- **Tool allowlist**: Only `Bash(git*)`, `Bash(gh*)`, `Read`, `Glob`, `Grep`
- **YAML validation**: Schemas validated before compilation

### What You Should Protect Against

#### Malicious Agent Instructions
- Review agent markdown files like code
- Audit changes in PRs
- Test with `--dry-run` before deploying

#### Social Engineering
- Validate PR changes carefully
- Protect `.github/claude-agents/` with required reviews
- Monitor workflow runs for suspicious activity

#### Credential Exposure
- Never commit API keys
- Rotate keys regularly
- Use repository-level secrets

#### Workflow Tampering
- Require PR reviews for main branch
- Enable branch protection for `.github/`
- Sign commits for agent changes

## See Also

- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Implementation patterns
- [Security Checklist](/gh-claude/reference/security-checklist/) - Pre-deployment validation
- [Permissions](/gh-claude/guide/permissions/) - Permission configuration
