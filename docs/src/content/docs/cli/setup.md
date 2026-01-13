---
title: gh claude setup
description: Interactive setup wizard for gh-claude
---

The `setup` command provides an interactive wizard that guides you through the complete setup process for gh-claude in your repository.

## Usage

```bash
gh claude setup [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--force` | Overwrite existing configuration |
| `--skip-auth` | Skip Claude authentication setup |
| `--skip-app` | Skip GitHub App setup |

## What It Does

The setup wizard walks you through four steps:

### Step 1: Prerequisites Check

- Verifies GitHub CLI is authenticated
- Checks if repository is initialized with gh-claude
- Offers to run `gh claude init --examples` if needed

### Step 2: Claude Authentication

- Checks for existing `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
- Guides you through authentication setup if not configured
- Supports both API key and OAuth token methods

### Step 3: GitHub App (Optional)

- Checks for existing GitHub App configuration
- Explains benefits of GitHub App setup:
  - Branded identity for Claude (e.g., "Claude[bot]")
  - Ability to trigger CI workflows from Claude-created PRs
- Guides you through app setup if desired

### Step 4: Next Steps

- Shows what to do after setup is complete
- Instructions for creating agents, compiling, and deploying

## Examples

### Full Interactive Setup

```bash
gh claude setup
```

### Skip Optional Steps

```bash
# Skip GitHub App setup (only configure auth)
gh claude setup --skip-app

# Skip authentication (only configure GitHub App)
gh claude setup --skip-auth
```

### Reconfigure Existing Setup

```bash
# Force reconfiguration of all settings
gh claude setup --force
```

## When to Use

Use `setup` when:
- Setting up gh-claude for the first time
- You want a guided walkthrough of all configuration options
- You're unsure which individual commands to run

Use individual commands when:
- You only need to configure one specific thing
- Automating setup in scripts (use `setup-token`, `setup-app`, `init`)

## Related Commands

- [init](../init/) - Initialize repository structure only
- [setup-token](../setup-token/) - Configure Claude authentication only
- [setup-app](../setup-app/) - Configure GitHub App only
- [add](../add/) - Add agents from the library

## See Also

- [Quick Start](/gh-claude/getting-started/quick-start/) - Complete getting started guide
- [Authentication Guide](/gh-claude/guide/authentication/) - Detailed authentication options
