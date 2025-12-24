---
title: gh claude setup-app
description: Configure a GitHub App for branded agent identity and CI triggering
---

Configure a GitHub App to provide your Claude agents with enhanced capabilities including branded identity and the ability to trigger CI workflows.

## Synopsis

```bash
gh claude setup-app [options]
```

## Description

The `setup-app` command helps you create and configure a GitHub App that provides your Claude agents with:

- **Branded Identity**: Commits and comments appear as your app (e.g., "MyApp[bot]") instead of "github-actions[bot]"
- **CI Triggering**: Pull requests created by agents can trigger your CI workflows (default GITHUB_TOKEN cannot)
- **Fine-grained Permissions**: More granular control over what the app can access
- **Cross-repository Access**: One app can be used across multiple repositories in your organization

This command walks you through the entire setup process interactively.

## Options

### `--force`

Overwrite existing GitHub App secrets (GH_APP_ID and GH_APP_PRIVATE_KEY) without prompting.

```bash
gh claude setup-app --force
```

### `--org <organization>`

Specify the organization name explicitly. If not provided, the command auto-detects from the current repository.

```bash
gh claude setup-app --org my-org
```

When used with an organization, secrets are stored at the org level and available to all repositories.

## Interactive Setup Flow

The command guides you through:

1. **App Creation**
   - Opens GitHub App creation page in your browser
   - Provides exact configuration settings to use
   - Lists required permissions

2. **Credential Collection**
   - Prompts for the App ID from GitHub
   - Collects the private key (via copy/paste)
   - Validates the key format

3. **Secret Storage**
   - Stores `GH_APP_ID` as a repository or organization secret
   - Stores `GH_APP_PRIVATE_KEY` as a repository or organization secret
   - Handles existing secrets with confirmation prompts

## GitHub App Configuration

When creating your GitHub App, the command will guide you to configure:

### Repository Permissions

Required permissions for Claude agents:

- **Contents**: Read and write (for creating commits, branches)
- **Issues**: Read and write (for issue operations)
- **Pull requests**: Read and write (for PR operations)
- **Workflows**: Read and write (enables CI triggering)
- **Metadata**: Read-only (auto-selected by GitHub)

Optional permissions based on your needs:

- **Discussions**: Read and write (if using discussion features)

### Webhook Settings

Webhooks are not required for gh-claude. Uncheck "Active" when creating the app.

### Installation

The app must be installed on repositories where you want to use it:

1. After creating the app, go to app settings
2. Click "Install App"
3. Select repositories to install on

For organizations, you can install on all repositories or select specific ones.

## Examples

### Setup for Single Repository

```bash
# In your repository
cd my-project
gh claude setup-app
```

This stores secrets at the repository level.

### Setup for Organization

```bash
# In any repo in your org
gh claude setup-app --org my-organization
```

This stores secrets at the organization level, making them available to all repositories in the org.

### Force Update Existing App

```bash
gh claude setup-app --force
```

Replaces existing GitHub App secrets without prompting.

## How It Works

### 1. Secret Storage

The command stores two secrets:

- `GH_APP_ID`: Your GitHub App's numeric ID
- `GH_APP_PRIVATE_KEY`: The private key (PEM format) for authentication

### 2. Token Generation in Workflows

Generated workflows automatically detect these secrets and:

1. Generate a JWT token using the App ID and private key
2. Exchange it for an installation access token
3. Use the token for all GitHub API operations
4. Fall back to `GITHUB_TOKEN` if App is not configured

### 3. Git Identity

When using a GitHub App, workflows automatically configure git with the app's identity:

```bash
git config user.name "myapp[bot]"
git config user.email "123456+myapp[bot]@users.noreply.github.com"
```

This ensures commits and PRs appear as your branded app.

## Verification

After setup, verify the configuration:

### 1. Check Secrets

```bash
gh secret list
```

You should see `GH_APP_ID` and `GH_APP_PRIVATE_KEY`.

### 2. Recompile Agents

Workflows must be recompiled to use the new app:

```bash
gh claude compile --all
git add .github/workflows/
git commit -m "Update workflows to use GitHub App"
git push
```

### 3. Test a Workflow

Trigger an agent and verify:

- Comments appear as "YourApp[bot]"
- Commits show the app identity
- PRs created by the agent trigger CI

## Organization vs Repository Secrets

### Repository-Level Secrets

**When to use:**
- Single repository setup
- Testing or development
- Repository-specific apps

**How to set:**
```bash
gh claude setup-app
```

**Scope:**
- Available only to the specific repository

### Organization-Level Secrets

**When to use:**
- Multiple repositories
- Consistent app identity across projects
- Centralized credential management

**How to set:**
```bash
gh claude setup-app --org my-org
```

**Scope:**
- Available to all repositories in the organization (or selected repos)
- Requires organization admin permissions

## Security Considerations

### Private Key Protection

- The private key is stored as a GitHub secret (encrypted at rest)
- Never committed to the repository
- Only accessible to workflow runs
- Rotatable by updating the secret

### Least Privilege

When creating your app, only grant permissions your agents actually need. For example:

- If agents only comment on issues, don't grant PR permissions
- If agents don't modify files, don't grant Contents write
- Use read-only permissions where possible

### App Installation Scope

Install the app only on repositories that need it:

1. Go to app settings > Install App
2. Select "Only select repositories"
3. Choose specific repositories

This limits the blast radius if credentials are compromised.

## Troubleshooting

### Error: Failed to get installation ID

**Symptom**: Token generation fails with "Failed to get installation ID"

**Solution**: Ensure the GitHub App is installed on the repository:

1. Go to your GitHub App settings
2. Click "Install App"
3. Install on the target repository

### Error: Invalid App ID

**Symptom**: Setup rejects your App ID

**Solution**:
- Ensure you're entering the numeric App ID (e.g., `123456`)
- Find it at the top of your app settings page
- Not the app slug or name

### Error: Invalid private key format

**Symptom**: Setup rejects your private key

**Solution**:
- Ensure you copied the entire key including headers:
  ```
  -----BEGIN RSA PRIVATE KEY-----
  ...key content...
  -----END RSA PRIVATE KEY-----
  ```
- No extra spaces or characters
- Use the downloaded `.pem` file contents

### Error: Permission denied setting secret

**Symptom**: `gh secret set` fails

**Solution**:
- **Repository secrets**: Ensure you have admin or write access
- **Organization secrets**: Ensure you have organization admin access
- Re-authenticate with additional scopes:
  ```bash
  gh auth refresh -s admin:org
  ```

### Workflow still uses github-actions[bot]

**Symptom**: After setup, commits still show "github-actions[bot]"

**Solutions**:

1. **Recompile workflows**:
   ```bash
   gh claude compile --all
   ```

2. **Verify secrets are set**:
   ```bash
   gh secret list
   ```

3. **Check workflow logs** for token generation step - should say "Generated GitHub App token"

## Advanced Usage

### Using Different Apps per Environment

You can use different apps for different environments:

```bash
# Production repo
cd production-repo
gh claude setup-app --org production-org

# Staging repo
cd staging-repo
gh claude setup-app --org staging-org
```

### Rotating App Credentials

To rotate your app's private key:

1. Go to GitHub App settings
2. Delete the old private key
3. Generate a new private key
4. Download the new key
5. Run:
   ```bash
   gh claude setup-app --force
   ```
6. Paste the new key when prompted

### Monitoring App Usage

View app usage and audit logs:

1. Go to GitHub App settings
2. Click "Advanced" > "Audit log"
3. Review token generations and API calls

## Next Steps

After setting up your GitHub App:

- [Recompile your agents](./compile) to use the new token
- [Learn about authentication](../guide/authentication) options
- [Understand the security model](../reference/security)
- [Explore advanced topics](../guide/advanced)

## Related Commands

- [`gh claude setup-token`](./setup-token) - Configure Claude API authentication
- [`gh claude compile`](./compile) - Compile agents (needed after app setup)
- [`gh secret`](https://cli.github.com/manual/gh_secret) - Manage GitHub secrets

## See Also

- [GitHub App Documentation](https://docs.github.com/en/developers/apps)
- [Creating GitHub Apps](https://docs.github.com/en/developers/apps/creating-a-github-app)
- [App Installation Tokens](https://docs.github.com/en/developers/apps/authenticating-with-github-apps)
