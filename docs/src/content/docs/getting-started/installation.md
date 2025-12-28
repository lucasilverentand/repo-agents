---
title: Installation
description: How to install gh-claude
---

## Prerequisites

Before installing gh-claude, ensure you have:

- **Node.js 20.0.0 or higher**
- **GitHub CLI** (`gh`) installed and authenticated
- An **Anthropic API key** for Claude

## Installing the Extension

Install gh-claude as a GitHub CLI extension:

```bash
gh extension install lucasilverentand/gh-claude
```

## Verify Installation

Check that the extension is installed:

```bash
gh claude --version
```

You should see the version number displayed.

## Authentication

Configure Claude API access:

```bash
gh claude setup-token
```

This guides you through adding your Anthropic API key as a repository secret.

**[Complete Authentication Guide](/gh-claude/guide/authentication/)** - OAuth, GitHub App setup, and advanced options.

## Next Steps

Now that you have gh-claude installed, proceed to the [Quick Start](../quick-start/) guide to create your first agent.
