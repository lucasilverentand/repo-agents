---
title: Pre-Flight Stage
description: Security checks and validation before agent execution
---

The pre-flight stage runs security and validation checks before allowing agent execution. If any check fails, the workflow stops and the agent doesn't run.

## Purpose

- Verify required secrets are configured
- Validate the triggering user has permission
- Check trigger label requirements
- Enforce rate limiting between runs

## Steps

### 1. Generate GitHub Token

Creates a GitHub App token if configured, otherwise uses the default `GITHUB_TOKEN`.

Using a GitHub App provides:
- Branded identity (commits appear as "YourApp[bot]")
- PRs created by the agent can trigger CI workflows
- Higher rate limits

### 2. Check Secrets

Verifies that one of the required authentication secrets exists:

- `ANTHROPIC_API_KEY` — Anthropic API key
- `CLAUDE_CODE_OAUTH_TOKEN` — Claude OAuth token

If neither is configured, the workflow fails immediately.

### 3. Check User Authorization

Validates the triggering user has permission to run the agent.

**Default allowed users:**
- Repository admins
- Users with write access
- Organization members

You can restrict this further with `allowed-actors` and `allowed-teams` in your agent definition.

### 4. Check Required Labels

If `trigger_labels` is configured, verifies the issue/PR has one of the required labels. The agent only runs if a matching label is present.

### 5. Check Rate Limit

Prevents excessive runs by enforcing a minimum interval between executions. The default is 5 minutes, configurable via `rate_limit_minutes`.

Uses the GitHub API to check when the workflow last ran successfully.

## Outputs

| Output | Description |
|--------|-------------|
| `should-run` | `true` if all checks pass, `false` otherwise |
| `rate-limited` | `true` if skipped due to rate limiting |
| `github-token` | Token for subsequent jobs |

## Failure Scenarios

| Check | Failure Reason | Resolution |
|-------|---------------|------------|
| Secrets | Missing API key | Run `repo-agents setup-token` |
| Authorization | User not allowed | Add to `allowed-actors` or grant write access |
| Labels | Required label missing | Add the trigger label to issue/PR |
| Rate Limit | Too soon since last run | Wait for cooldown or adjust `rate_limit_minutes` |

## See Also

- [Permissions Guide](/repo-agents/guide/permissions/) - User authorization
- [Security Model](/repo-agents/reference/security-model/) - Security architecture
- [Triggers Overview](/repo-agents/triggers/) - Rate limiting details
