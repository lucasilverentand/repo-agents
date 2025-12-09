---
title: Quick Start
description: Get started with gh-claude in minutes
---

This guide will walk you through creating your first Claude-powered GitHub Actions workflow.

## 1. Initialize Your Repository

Navigate to your repository and initialize gh-claude:

```bash
cd your-repo
gh claude init --examples
```

This creates:
- `.github/claude-agents/` - Directory for agent markdown files
- `.github/claude.yml` - Configuration file
- Example agent templates

## 2. Configure API Key

Add your Anthropic API key as a repository secret:

```bash
gh secret set ANTHROPIC_API_KEY
```

## 3. Create Your First Agent

Create a new file at `.github/claude-agents/issue-triage.md`:

```markdown
---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Issue Triage Agent

Analyze new issues and:

1. Categorize with appropriate labels (bug, feature, documentation, question)
2. Assess priority (high, medium, low)
3. Welcome the contributor with a friendly comment

Be helpful and welcoming!
```

## 4. Compile to Workflow

Generate the GitHub Actions workflow:

```bash
gh claude compile --all
```

This creates `.github/workflows/claude-issue-triage.yml` with the complete workflow definition.

## 5. Commit and Deploy

Commit your changes and push to GitHub:

```bash
git add .github/
git commit -m "Add Claude issue triage agent"
git push
```

## Test Your Agent

Create a new issue in your repository. The agent should automatically:
- Add appropriate labels
- Post a welcoming comment

## What's Next?

- Learn about [Agent Definition](/guide/agent-definition/) format
- Explore [Triggers](/guide/triggers/) for different events
- See more [Examples](/examples/issue-triage/)
