---
title: Frequently Asked Questions
description: Common questions about gh-claude
---

Quick answers to common questions. For detailed guides, see the linked documentation.

## General Questions

### What is gh-claude?

gh-claude is a GitHub CLI extension that transforms natural language markdown files into GitHub Actions workflows powered by Claude AI. Write simple markdown instructions, and gh-claude compiles them into executable workflows.

### How much does this cost?

gh-claude is free and open-source. You pay only for Anthropic API usage:

- Simple issue triage: ~$0.01-0.05 per run
- PR review: ~$0.05-0.20 per run
- Daily reports: ~$0.10-0.50 per run

**[→ Cost Estimation Guide](/gh-claude/guide/cost-estimation/)**

### What's the difference between this and GitHub Copilot?

| Feature | GitHub Copilot | gh-claude |
|---------|---------------|-----------|
| Purpose | IDE code completion | Repository automation |
| Runs in | Your local editor | GitHub Actions |
| Triggers | Your keystrokes | GitHub events |
| Actions | Suggests code | Comments, labels, creates PRs |
| Pricing | Subscription | Pay-per-use API |

They serve different purposes and can be used together.

### What Claude models are supported?

All Claude models via the Anthropic API:

- `claude-3-5-sonnet-20241022` (default) - Best balance
- `claude-3-opus-20240229` - Most capable
- `claude-3-haiku-20240307` - Fastest, cheapest

**[→ Model Configuration](/gh-claude/guide/agent-definition/#model-configuration)**

### Can agents run on private repositories?

Yes. Requirements:
- GitHub Actions enabled
- `ANTHROPIC_API_KEY` secret configured

Note: Repository data is sent to Anthropic's API for processing.

## Security and Permissions

### Can agents commit code?

Yes, when configured with `contents: write` permission and `allowed-paths`:

```yaml
permissions:
  contents: write
allowed-paths:
  - docs/**
outputs:
  update-file: true
```

**Best practice:** Use `create-pr` instead of direct commits for manual review.

**[→ Security Best Practices](/gh-claude/guide/security-best-practices/)**

### Who can trigger agents?

By default: repository admins, users with write access, and org members.

Restrict with:

```yaml
allowed-actors:
  - trusted-user
allowed-teams:
  - maintainers
```

**[→ Permissions Guide](/gh-claude/guide/permissions/)**

### What happens if an agent misbehaves?

Safety mechanisms include:
- Explicit permission requirements
- Output validation and limits
- Path restrictions
- Rate limiting

To stop an agent: disable the workflow in Actions tab or delete the workflow file.

**[→ Troubleshooting](/gh-claude/guide/troubleshooting/)**

## Configuration

### How do I update an existing agent?

1. Edit the agent markdown file
2. Run `gh claude compile my-agent.md`
3. Commit and push

**[→ CLI Reference](/gh-claude/cli/)**

### Should I use a GitHub App?

**Use a GitHub App when:**
- Agents create PRs that need to trigger CI
- You want branded identity (e.g., "MyApp[bot]")
- You're deploying across multiple repositories

**Default token is sufficient when:**
- Agents only comment or label
- You're just testing
- You don't need CI triggering

**[→ GitHub App Setup](/gh-claude/cli/setup-app/)**

### Can multiple agents run on the same trigger?

Yes. Each agent runs independently. Use `trigger_labels` to separate responsibilities.

### What are the rate limits?

- **gh-claude**: Default 5 minutes between runs (configurable with `rate_limit_minutes`)
- **Anthropic API**: Varies by account tier
- **GitHub API**: 5,000 requests/hour

**[→ Rate Limiting](/gh-claude/triggers/#rate-limiting)**

## Technical Questions

### How does the workflow structure work?

gh-claude generates a multi-job workflow:

1. **pre-flight**: Validates secrets, authorization, rate limits
2. **collect-inputs** (optional): Gathers GitHub data
3. **claude-agent**: Runs Claude with your instructions
4. **execute-outputs** (optional): Posts comments, adds labels, etc.

**[→ How It Works](/gh-claude/guide/how-it-works/)**

### What tools does Claude have access to?

- File operations: `Read`, `Glob`, `Grep`
- Git commands (read-only unless `contents: write`)
- GitHub CLI commands

Claude cannot access external networks or execute arbitrary code.

### Can I customize the generated workflow?

Not recommended - changes are overwritten on recompile. Instead, modify the agent markdown or use `workflow_dispatch` inputs.

### How do scheduled agents work?

Use cron syntax with inputs for data collection:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM UTC
inputs:
  issues:
    states: [open]
  since: last-run
  min_items: 1
```

**[→ Schedule Trigger](/gh-claude/triggers/schedule/)**

## Getting Started

### What's the quickest way to get started?

```bash
gh extension install lucasilverentand/gh-claude
cd your-repo
gh claude init --examples
gh claude setup-token
gh claude compile --all
git add .github/ && git commit -m "Add agents" && git push
```

**[→ Quick Start Guide](/gh-claude/getting-started/quick-start/)**

### Where can I find examples?

- [Issue Triage](/gh-claude/examples/issue-triage/)
- [PR Review](/gh-claude/examples/pr-review/)
- [Daily Summary](/gh-claude/examples/daily-summary/)

### What if I get stuck?

1. **Validate:** `gh claude validate --all --strict`
2. **Check:** [Troubleshooting](/gh-claude/guide/troubleshooting/)
3. **Search:** [GitHub Issues](https://github.com/lucasilverentand/gh-claude/issues)
4. **Ask:** Open an issue with your configuration and logs

## See Also

- [Installation](/gh-claude/getting-started/installation/)
- [Agent Definition](/gh-claude/guide/agent-definition/)
- [Security](/gh-claude/reference/security/)
- [Configuration](/gh-claude/reference/configuration/)
