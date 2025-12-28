---
title: Authentication
description: Set up Claude API authentication for gh-claude workflows
---

gh-claude workflows require authentication to call the Claude API.

## Authentication Methods

| Method | Secret Name | Source |
|--------|-------------|--------|
| **API Key** | `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com/settings/keys) |
| **OAuth Token** | `CLAUDE_CODE_OAUTH_TOKEN` | Claude Pro/Team subscription |

Both methods work identically. Choose based on your access type.

## Quick Setup

```bash
gh claude setup-token
```

This interactive command:
1. Detects if you have a Claude subscription
2. Authenticates with Claude (subscription users)
3. Automatically sets the appropriate GitHub secret

## Manual Setup

### API Key (Anthropic Console)

1. Get your API key from the [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Set the repository secret:
   ```bash
   gh secret set ANTHROPIC_API_KEY
   ```
3. Paste your API key when prompted

### OAuth Token (Claude Pro/Team)

1. Install Claude CLI: `npm install -g @anthropic-ai/claude-code`
2. Run: `gh claude setup-token`
3. Complete the OAuth flow in your browser

## Organization-Level Secrets

For multiple repositories:

```bash
# Set organization secret
gh secret set ANTHROPIC_API_KEY --org your-org-name
```

Or use GitHub's web UI: Organization Settings → Secrets and variables → Actions

## Verify Setup

```bash
gh secret list
```

You should see your authentication secret listed.

## How Workflows Use Secrets

Generated workflows check for both authentication methods:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

At least one must be set. `CLAUDE_CODE_OAUTH_TOKEN` is prioritized if both exist.

## Updating Secrets

```bash
# Overwrite existing secret
gh secret set ANTHROPIC_API_KEY --force

# Or use the setup command
gh claude setup-token --force
```

## Key Rotation

1. Create new key in Anthropic Console (or re-run `setup-token`)
2. Update the GitHub secret
3. Verify workflows run successfully
4. Revoke the old key

## Troubleshooting

### "No Claude authentication found"

- Verify secret is set: `gh secret list`
- Check secret name matches exactly (`ANTHROPIC_API_KEY` not `API_KEY`)
- For org secrets, verify repository access is granted

### "Invalid API key format"

- Key should start with `sk-ant-`
- Ensure no extra spaces or truncation

### "Failed to extract token from keychain"

- Re-run: `claude setup-token`
- Verify Claude CLI: `claude --version`

**[→ Full Troubleshooting Guide](/gh-claude/guide/troubleshooting/)**

## GitHub App (Optional)

For branded identity and CI triggering, configure a GitHub App:

```bash
gh claude setup-app
```

**[→ GitHub App Setup Guide](/gh-claude/cli/setup-app/)**

## Security Best Practices

- Never commit secrets to your repository
- Use organization secrets with limited repository access
- Rotate API keys periodically
- Monitor usage in [Anthropic Console](https://console.anthropic.com)

**[→ Security Best Practices](/gh-claude/guide/security-best-practices/)**

## See Also

- [Agent Definition](/gh-claude/guide/agent-definition/) - Create your first agent
- [Security](/gh-claude/reference/security/) - Security overview
- [setup-token CLI](/gh-claude/cli/setup-token/) - CLI reference
