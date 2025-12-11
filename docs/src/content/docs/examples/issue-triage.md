---
title: Issue Triage Agent
description: Automatically categorize and label new issues
---

This example shows how to create an agent that automatically triages new issues by categorizing them and adding appropriate labels.

## Agent Definition

Create `.github/claude-agents/issue-triage.md`:

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
claude:
  model: claude-3-5-sonnet-20241022
  temperature: 0.7
---

# Issue Triage Agent

When a new issue is opened, analyze it and perform the following tasks:

## Categorization

Determine the issue type and add ONE of these labels:
- `bug` - Something isn't working correctly
- `feature` - New functionality or enhancement request
- `documentation` - Documentation improvements or clarifications
- `question` - User needs help or has a question

## Priority Assessment

Based on the issue content, assess priority and add ONE label:
- `priority: high` - Critical bugs, security issues, or blocking problems
- `priority: medium` - Important improvements or non-blocking bugs
- `priority: low` - Nice-to-have features or minor issues

## Welcome Comment

Post a friendly welcome comment that:
1. Thanks the contributor
2. Confirms the categorization
3. Sets expectations (e.g., "A maintainer will review this soon")
4. Asks for additional information if needed

## Guidelines

- **Be welcoming**: First-time contributors should feel encouraged
- **Be clear**: Explain the categorization briefly
- **Be helpful**: If the issue is unclear, politely ask for clarification
- **Be concise**: Keep comments short and actionable

## Example Comments

### For a clear bug report:
"Thanks for reporting this issue! I've labeled this as a bug with medium priority. A maintainer will investigate and respond soon."

### For an unclear issue:
"Thanks for opening this issue! To help us understand better, could you provide:
- Steps to reproduce the problem
- Expected vs actual behavior
- Your environment (OS, browser, version)

I've labeled this as a question for now, and we'll update it once we have more details."

### For a feature request:
"Thanks for the feature suggestion! I've labeled this as a feature request with low priority. The maintainers will discuss this and provide feedback."
```

## How It Works

1. **Trigger**: Runs when a new issue is opened
2. **Analysis**: Claude reads the issue title and body
3. **Categorization**: Determines issue type and priority
4. **Action**: Adds labels and posts a welcome comment

## Compile the Agent

```bash
gh claude compile issue-triage.md
```

This generates `.github/workflows/claude-issue-triage.yml`.

## Deploy

```bash
git add .github/
git commit -m "Add issue triage agent"
git push
```

## Example Output

When a user opens this issue:

```
Title: Login button doesn't work on mobile

Description: When I tap the login button on my iPhone, nothing happens.
The button works fine on desktop.
```

The agent might:

1. Add labels: `bug`, `priority: medium`
2. Post comment:

```
Thanks for reporting this issue! I've labeled this as a bug with medium priority.
This appears to be a mobile-specific issue. A maintainer will investigate and
respond soon.

To help us debug this faster, could you share:
- iOS version
- Browser (Safari, Chrome, etc.)
- Any console errors if you can check
```

## Customization Ideas

### More Granular Labels

```markdown
Add specific category labels:
- `bug: ui` - UI/UX issues
- `bug: performance` - Performance problems
- `feature: api` - API-related features
- `feature: ui` - UI enhancements
```

### Team Assignment

```markdown
For high-priority bugs, add labels that notify specific teams:
- `team: frontend` - Frontend team
- `team: backend` - Backend team
- `team: security` - Security team
```

### Auto-Assignment

With the `assign-issue` output (if available):

```yaml
outputs:
  add-comment: { max: 1 }
  add-label: true
  assign-issue: true
```

```markdown
For security-related issues, assign to @security-lead
```

## Related Examples

- [PR Review](pr-review/) - Review pull requests
- [Daily Summary](daily-summary/) - Generate activity summaries
