---
title: Authentication
description: Set up Claude API authentication for gh-claude workflows
---

gh-claude workflows require authentication to call the Claude API. This guide covers how to set up and manage API credentials for your GitHub Actions workflows.

## Authentication Methods

gh-claude supports two authentication methods:

1. **API Key** (ANTHROPIC_API_KEY) - Traditional API key for Anthropic API access
2. **OAuth Token** (CLAUDE_CODE_OAUTH_TOKEN) - OAuth token from Claude Pro/Team subscription

Both methods work identically in workflows. Choose based on your access type.

## GitHub Token (Optional Enhancement)

In addition to Claude API authentication, you can optionally configure a **GitHub App** to enhance your agents with:

- **Branded Identity**: Commits/comments appear as your app (e.g., "MyApp[bot]")
- **CI Triggering**: PRs created by agents can trigger CI workflows
- **Fine-grained Permissions**: More control over repository access

**[→ Learn how to set up a GitHub App](../../cli/setup-app/)**

This is **optional** - agents work fine with the default `GITHUB_TOKEN`, but the GitHub App provides additional capabilities.

## Quick Setup

The easiest way to set up authentication:

```bash
gh claude setup-token
```

This interactive command:
1. Detects if you have a Claude subscription
2. Authenticates with Claude (subscription users)
3. Automatically sets the appropriate GitHub secret

## Setup Methods

### Method 1: API Key (Recommended for API Access)

If you have direct API access through Anthropic:

#### Step 1: Get Your API Key

1. Visit the [Anthropic Console](https://console.anthropic.com/settings/keys)
2. Sign in to your account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-`)

#### Step 2: Set Repository Secret

```bash
gh secret set ANTHROPIC_API_KEY
```

Paste your API key when prompted.

#### Step 3: Verify Setup

```bash
gh secret list
```

You should see `ANTHROPIC_API_KEY` in the list.

### Method 2: OAuth Token (Claude Pro/Team Subscriptions)

If you have a Claude Pro or Claude Team subscription:

#### Step 1: Install Claude CLI

The Claude Code CLI must be installed to extract OAuth credentials:

```bash
npm install -g @anthropic-ai/claude-code
```

#### Step 2: Run Setup Command

```bash
gh claude setup-token
```

Follow the interactive prompts:
1. Confirm you have a Claude subscription (y)
2. Complete the OAuth flow in your browser
3. The tool automatically extracts and sets the secret

This sets the `CLAUDE_CODE_OAUTH_TOKEN` repository secret.

#### Step 3: Verify Setup

```bash
gh secret list
```

You should see `CLAUDE_CODE_OAUTH_TOKEN` in the list.

## Organization-Level Secrets

For multiple repositories, set secrets at the organization level:

### Using GitHub Web UI

1. Go to your organization settings
2. Navigate to **Secrets and variables** → **Actions**
3. Click **New organization secret**
4. Name: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
5. Value: Your API key or OAuth token
6. Select **Repository access** (all repos or specific repos)

### Using GitHub CLI

```bash
# Set organization secret (requires org admin access)
gh secret set ANTHROPIC_API_KEY --org your-org-name

# Make it available to specific repositories
gh api orgs/your-org-name/actions/secrets/ANTHROPIC_API_KEY/repositories \
  -X PUT \
  -f repository_ids[]="123456789"
```

Organization secrets automatically cascade to all permitted repositories.

## How Workflows Use Secrets

Generated workflows automatically check for both authentication methods:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

The workflow validates that at least one is set during the pre-flight checks.

## Differences Between Methods

| Feature | API Key | OAuth Token |
|---------|---------|-------------|
| **Source** | Anthropic Console | Claude Pro/Team subscription |
| **Setup** | Manual copy/paste | Automated via CLI |
| **Secret Name** | `ANTHROPIC_API_KEY` | `CLAUDE_CODE_OAUTH_TOKEN` |
| **Billing** | API usage charges | Subscription included |
| **Rate Limits** | API tier limits | Subscription limits |
| **Expiration** | Permanent (until revoked) | Periodic refresh needed |

## Updating Secrets

### Overwrite Existing Secret

```bash
gh secret set ANTHROPIC_API_KEY --force
```

Or use the setup command with force flag:

```bash
gh claude setup-token --force
```

### Switch Between Methods

You can have both secrets set. Workflows prioritize `CLAUDE_CODE_OAUTH_TOKEN` when both are present.

To switch from API key to OAuth token:

```bash
# Set up OAuth token
gh claude setup-token

# Remove old API key (optional)
gh secret remove ANTHROPIC_API_KEY
```

## Security Best Practices

### Never Commit Secrets

API keys and tokens should **never** be committed to your repository:

```bash
# ❌ NEVER do this
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
git add .env

# ✅ Always use GitHub Secrets
gh secret set ANTHROPIC_API_KEY
```

### Use Minimal Access Scope

For organization secrets, limit repository access to only repos that need it.

### Regular Rotation

Rotate API keys periodically:

1. Create new API key in Anthropic Console
2. Update GitHub secret
3. Revoke old key after verification

For OAuth tokens, re-run `gh claude setup-token` periodically.

### Monitor Usage

Track API usage in your Anthropic Console to detect:
- Unexpected high usage
- Failed authentication attempts
- Quota exhaustion

## Troubleshooting

### Error: No Claude authentication found

**Symptom**: Workflow fails with "No Claude authentication found"

**Solutions**:

1. Verify secret is set:
   ```bash
   gh secret list
   ```

2. Check secret name matches exactly:
   - `ANTHROPIC_API_KEY` (not `ANTHROPIC_KEY` or `API_KEY`)
   - `CLAUDE_CODE_OAUTH_TOKEN` (not `CLAUDE_TOKEN`)

3. For organization secrets, verify repository access is granted

### Error: Invalid API key format

**Symptom**: Setup command rejects your API key

**Solution**: Ensure the API key:
- Starts with `sk-ant-`
- Is copied completely (no truncation)
- Has no extra spaces or newlines

### Error: Failed to extract token from keychain

**Symptom**: OAuth setup fails after authentication

**Solutions**:

1. Re-run Claude CLI authentication:
   ```bash
   claude setup-token
   ```

2. Verify Claude CLI is properly installed:
   ```bash
   claude --version
   ```

3. Check macOS keychain access (macOS only)

### Workflow runs but produces no output

**Symptom**: Workflow completes but Claude doesn't respond

**Solutions**:

1. Check API key validity in Anthropic Console
2. Verify API quota hasn't been exhausted
3. Check workflow logs for authentication errors
4. Test API key directly:
   ```bash
   curl https://api.anthropic.com/v1/messages \
     -H "x-api-key: $ANTHROPIC_API_KEY" \
     -H "anthropic-version: 2023-06-01" \
     -H "content-type: application/json" \
     -d '{"model":"claude-3-5-sonnet-20241022","max_tokens":1024,"messages":[{"role":"user","content":"test"}]}'
   ```

### Permission denied setting secret

**Symptom**: `gh secret set` fails with permission error

**Solutions**:

1. Verify you have write access to the repository
2. For organization secrets, ensure you have organization admin access
3. Re-authenticate GitHub CLI:
   ```bash
   gh auth refresh -s admin:org
   ```

## Testing Authentication

After setting up authentication, verify it works:

### Test 1: Secret Visibility

```bash
gh secret list
```

Should show your authentication secret.

### Test 2: Dry Run Compile

```bash
gh claude compile --dry-run examples/issue-triage.md
```

Should generate workflow YAML without errors.

### Test 3: Test Workflow Run

Create a minimal test agent:

```markdown
---
name: Auth Test
on:
  workflow_dispatch:
permissions:
  issues: read
---

Reply with "Authentication successful!"
```

Compile and trigger manually:

```bash
gh claude compile .github/claude-agents/auth-test.md
git add .github/workflows/
git commit -m "Add auth test workflow"
git push
gh workflow run "Auth Test"
```

Check the workflow run logs for successful Claude API calls.

## Key Rotation

To rotate your API credentials safely:

### For API Keys

1. **Create new key** in Anthropic Console
2. **Test new key** locally or in a test repository
3. **Update secret**:
   ```bash
   gh secret set ANTHROPIC_API_KEY
   ```
4. **Verify workflows** run successfully with new key
5. **Revoke old key** in Anthropic Console

### For OAuth Tokens

1. **Run setup again**:
   ```bash
   gh claude setup-token --force
   ```
2. **Complete OAuth flow** (may require re-authentication)
3. **Verify workflows** run successfully

## Advanced Configuration

### Environment-Specific Secrets

Use different secrets for different environments:

```yaml
# In workflow file (advanced users only)
env:
  ANTHROPIC_API_KEY: ${{ secrets[format('ANTHROPIC_API_KEY_{0}', github.ref_name)] }}
```

### Audit Logging

GitHub Actions automatically logs:
- When secrets are accessed (not the values)
- Which workflows used which secrets
- Timing of secret access

Access via: Repository Settings → Actions → General → Audit log

## GitHub App Setup (Optional)

For enhanced capabilities, you can configure a GitHub App:

```bash
gh claude setup-app
```

### Benefits of Using a GitHub App

**Branded Identity**
- Commits appear as "YourApp[bot]" instead of "github-actions[bot]"
- Comments show your custom app name
- Professional appearance for public repositories

**CI Triggering**
- PRs created by agents can trigger your CI workflows
- Default GITHUB_TOKEN cannot trigger workflows (security limitation)
- Essential for agents that create PRs with code changes

**Fine-grained Permissions**
- Control exactly which repos the app can access
- More granular than repository-level GITHUB_TOKEN
- Better audit trail of app activities

### When to Use a GitHub App

**Use a GitHub App when:**
- Your agents create pull requests that should trigger CI
- You want a branded identity for your automation
- You're using agents across multiple repositories
- You need more granular permission control

**Default GITHUB_TOKEN is fine when:**
- Your agents only comment or label issues/PRs
- You don't need CI triggering on created PRs
- You're testing or starting out
- You don't need custom branding

### Setting Up

See the [setup-app CLI reference](../../cli/setup-app/) for complete setup instructions.

Quick setup:

```bash
# Single repository
gh claude setup-app

# Organization-wide (all repos)
gh claude setup-app --org your-org-name
```

After setup, recompile your agents to use the new token:

```bash
gh claude compile --all
```

## Next Steps

After setting up authentication:

- [Create your first agent](../agent-definition/)
- [Understand security model](../../reference/security/)
- [Explore examples](../../examples/issue-triage/)
- [Configure a GitHub App (optional)](../../cli/setup-app/)
