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
gh extension install yourusername/gh-claude
```

## Verify Installation

Check that the extension is installed:

```bash
gh claude --version
```

You should see the version number displayed.

## Setting Up API Key

gh-claude requires an Anthropic API key to use Claude. You'll need to add this as a repository secret:

1. Get your API key from [Anthropic Console](https://console.anthropic.com/)
2. Add it to your repository:

```bash
gh secret set ANTHROPIC_API_KEY
```

When prompted, paste your API key.

## Next Steps

Now that you have gh-claude installed, proceed to the [Quick Start](/getting-started/quick-start/) guide to create your first agent.
