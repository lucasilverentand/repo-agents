---
title: Agent Gallery
description: Explore Claude-powered agents you can create for your repositories
---

# Agent Gallery

gh-claude enables you to create intelligent automation agents that understand context, make decisions, and take action on your repository.

## Available Now

Ready-to-use agents with complete examples:

| Agent | Category | Trigger | Description |
|-------|----------|---------|-------------|
| [Issue Triage](/gh-claude/examples/issue-triage/) | Issue Management | Events | Categorize and label new issues |
| [PR Review](/gh-claude/examples/pr-review/) | Code Review | Events | Initial code review and feedback |
| [Daily Summary](/gh-claude/examples/daily-summary/) | Project Intelligence | Schedule | Activity reports and metrics |
| [Stale Issue Manager](/gh-claude/examples/daily-summary/) | Maintenance | Schedule | Clean up inactive issues |

## Coming Soon

We're expanding the agent ecosystem with more specialized agents:

- **Security Scanner** - Deep security analysis of code changes
- **Duplicate Detective** - Find and link duplicate issues
- **Changelog Curator** - Auto-generate release notes
- **Doc Sync** - Keep documentation in sync with code

See our full [Roadmap](roadmap/) for planned agents.

## Agent Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Issue Management** | Triage, categorize, respond | Issue Triage, Duplicate Detective |
| **Code Review** | Quality, security, style | PR Review, Security Scanner |
| **Maintenance** | Clean up, organize | Stale Issue Manager, Branch Janitor |
| **Documentation** | Keep docs updated | Doc Sync, API Documentarian |
| **Release** | Version management | Changelog Curator, Release Captain |
| **Intelligence** | Insights and analytics | Daily Summary, Velocity Tracker |

## Build Your Own

Every agent follows a simple pattern:

```yaml
---
name: My Agent
on:
  issues:
    types: [opened]
outputs:
  add-comment: { max: 1 }
  add-label: true
---

Your natural language instructions here...
```

**[→ Agent Definition Guide](/gh-claude/guide/agent-definition/)** - Learn how to create custom agents

## See Also

- [Examples](/gh-claude/examples/) - Complete working examples
- [Triggers](/gh-claude/triggers/) - When agents run
- [Outputs](/gh-claude/outputs/) - What agents can do
