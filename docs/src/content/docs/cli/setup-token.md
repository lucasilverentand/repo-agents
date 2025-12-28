---
title: setup-token
description: Configure Claude API authentication
---

Configure authentication for Claude API access in your GitHub Actions workflows. Supports both API key and OAuth token authentication methods.

## Usage

```bash
gh claude setup-token [options]
```

## Description

The `setup-token` command helps you configure Claude API authentication for gh-claude workflows. It supports two authentication methods:

1. **API Key** (`ANTHROPIC_API_KEY`) - Traditional API key from Anthropic Console
2. **OAuth Token** (`CLAUDE_CODE_OAUTH_TOKEN`) - OAuth token from Claude Pro/Team subscription

The command guides you through the setup process and automatically stores credentials as GitHub repository secrets.

## Options

| Option | Description |
|--------|-------------|
| `--api-key` | Use API key authentication method |
| `--oauth` | Use OAuth token authentication method |
| `--org <name>` | Store secret at organization level (requires org admin) |
| `--repo` | Store secret at repository level (default) |
| `--force` | Overwrite existing secret without confirmation |

## Authentication Methods

### API Key Method

For users with direct API access through Anthropic:

```bash
gh claude setup-token --api-key
```

**Interactive prompts:**
1. Enter your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Confirm repository or organization level storage
3. Secret is created as `ANTHROPIC_API_KEY`

**Manual API key setup:**

```bash
# Get your API key from Anthropic Console
# Visit: https://console.anthropic.com/settings/keys

# Set as repository secret
gh secret set ANTHROPIC_API_KEY
# Paste your key when prompted
```

### OAuth Token Method

For users with Claude Pro or Claude Team subscriptions:

```bash
gh claude setup-token --oauth
```

**Interactive prompts:**
1. Confirm you have a Claude subscription
2. Complete OAuth flow in browser
3. Tool automatically extracts and sets token
4. Secret is created as `CLAUDE_CODE_OAUTH_TOKEN`

**Prerequisites:**
- Active Claude Pro or Claude Team subscription
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)

## Examples

### Interactive Setup (Recommended)

Let the command detect your access type:

```bash
gh claude setup-token
```

The command will:
1. Check if you have Claude subscription
2. Guide you through appropriate authentication method
3. Store credentials automatically

### API Key Setup

```bash
# Interactive API key setup
gh claude setup-token --api-key

# You'll be prompted to paste your API key
```

### OAuth Token Setup

```bash
# Interactive OAuth setup
gh claude setup-token --oauth

# Opens browser for authentication
# Automatically extracts and stores token
```

### Organization-Level Setup

For multiple repositories in an organization:

```bash
# Set up OAuth token at org level
gh claude setup-token --oauth --org my-org-name

# Set up API key at org level
gh claude setup-token --api-key --org my-org-name
```

**Note:** Requires organization admin permissions.

### Force Update Existing Secret

```bash
# Overwrite existing secret without confirmation
gh claude setup-token --force

# Useful for key rotation
gh claude setup-token --api-key --force
```

## How Secrets Are Used

Generated workflows automatically check for authentication secrets:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

The workflow validates that at least one is set during pre-flight checks.

## Verifying Setup

After running `setup-token`, verify the secret was created:

```bash
# List repository secrets
gh secret list

# Should show one of:
# - ANTHROPIC_API_KEY
# - CLAUDE_CODE_OAUTH_TOKEN
```

For organization secrets:

```bash
# List organization secrets
gh secret list --org my-org-name
```

## Differences Between Methods

| Feature | API Key | OAuth Token |
|---------|---------|-------------|
| **Source** | Anthropic Console | Claude Pro/Team subscription |
| **Setup** | Manual copy/paste | Automated via CLI |
| **Secret Name** | `ANTHROPIC_API_KEY` | `CLAUDE_CODE_OAUTH_TOKEN` |
| **Billing** | API usage charges | Subscription included |
| **Rate Limits** | API tier limits | Subscription limits |
| **Expiration** | Permanent (until revoked) | Periodic refresh needed |
| **Best For** | Direct API customers | Claude subscription users |

## Updating or Rotating Credentials

### Overwrite Existing Secret

```bash
# Update with force flag
gh claude setup-token --force
```

### Switch Between Methods

You can have both secrets set. Workflows prioritize `CLAUDE_CODE_OAUTH_TOKEN` when both are present.

Switch from API key to OAuth token:

```bash
# Set up OAuth token
gh claude setup-token --oauth

# Remove old API key (optional)
gh secret remove ANTHROPIC_API_KEY
```

### Regular Rotation

**For API keys:**
1. Create new key in Anthropic Console
2. Run: `gh claude setup-token --api-key --force`
3. Verify workflows run successfully
4. Revoke old key in Anthropic Console

**For OAuth tokens:**
```bash
# Re-authenticate periodically
gh claude setup-token --oauth --force
```

## Troubleshooting

### Error: No Claude authentication found

**Symptom:** Workflow fails with "No Claude authentication found"

**Solutions:**
1. Verify secret exists: `gh secret list`
2. Check secret name matches exactly (case-sensitive)
3. For org secrets, verify repository access is granted

### Error: Invalid API key format

**Symptom:** Setup command rejects your API key

**Solutions:**
- Ensure key starts with `sk-ant-`
- Check for complete copy (no truncation)
- Remove extra spaces or newlines

### Error: Failed to extract token from keychain

**Symptom:** OAuth setup fails after browser authentication

**Solutions:**
1. Re-authenticate Claude CLI: `claude setup-token`
2. Verify Claude CLI installation: `claude --version`
3. Check macOS keychain access (macOS only)

### Permission denied setting secret

**Symptom:** `gh secret set` fails with permission error

**Solutions:**
1. Verify write access to repository
2. For org secrets, ensure org admin access
3. Re-authenticate GitHub CLI: `gh auth refresh -s admin:org`

## Security Best Practices

### Never Commit Secrets

```bash
# ❌ NEVER do this
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
git add .env

# ✅ Always use GitHub Secrets
gh claude setup-token
```

### Use Minimal Access Scope

For organization secrets:
1. Limit to specific repositories that need access
2. Use repository-level secrets when possible
3. Regular audit of secret access

### Monitor Usage

Track API usage in Anthropic Console:
- Watch for unexpected high usage
- Monitor failed authentication attempts
- Set up quota alerts

## Environment Variables

The command respects these environment variables:

- `GH_TOKEN` - GitHub personal access token (for gh CLI)
- `ANTHROPIC_API_KEY` - Can be set for testing (not recommended)
- `CLAUDE_CODE_OAUTH_TOKEN` - Can be set for testing (not recommended)

**Note:** For production, always use GitHub Secrets, not environment variables.

## Related Commands

- [setup-app](setup-app/) - Configure GitHub App for branded identity
- [init](init/) - Initialize gh-claude in repository
- [compile](compile/) - Compile agents to workflows

## See Also

- [Authentication Guide](../guide/authentication/) - Complete authentication documentation
- [Security Best Practices](../reference/security/) - Security considerations
- [Troubleshooting](../guide/troubleshooting/) - Common issues and solutions
- [Quick Start](../getting-started/quick-start/) - Complete setup walkthrough
