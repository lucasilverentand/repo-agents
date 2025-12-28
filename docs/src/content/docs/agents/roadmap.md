---
title: Agent Roadmap
description: Planned agents and future capabilities for gh-claude
---

import { Card, CardGrid } from '@astrojs/starlight/components';

# Agent Roadmap

We're continuously expanding the agent ecosystem. Here's what's coming next.

:::note
These agents are planned but not yet available. Want to help? [Contribute on GitHub](https://github.com/lucasilverentand/gh-claude).
:::

---

## Near Term

### Duplicate Detective Agent

Analyzes new issues against existing open and closed issues to detect potential duplicates.

```yaml
on:
  issues:
    types: [opened, edited]
outputs:
  add-comment: { max: 1 }
  add-label: true
  close-issue: true
```

**Capabilities:**
- Semantic similarity matching across issue titles and bodies
- Links to potential duplicates with confidence scores
- Suggests merging discussions when appropriate

---

### Security Scanner Agent

Deep security analysis of code changes in pull requests.

```yaml
on:
  pull_request:
    types: [opened, synchronize]
outputs:
  add-comment: { max: 3 }
  add-label: true
```

**Capabilities:**
- OWASP Top 10 vulnerability detection
- Secrets and credential exposure scanning
- Dependency vulnerability cross-referencing
- Security-focused code suggestions

---

### Changelog Curator Agent

Automatically generates and maintains changelogs from merged PRs.

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
outputs:
  update-file: true
  create-pr: { max: 1 }
allowed-paths:
  - "CHANGELOG.md"
```

**Capabilities:**
- PR categorization (features, fixes, breaking changes)
- Conventional commit parsing
- Release note prose generation
- Contributor attribution

---

## Medium Term

### Architecture Guardian Agent

Enforces architectural decisions and patterns in code changes.

```yaml
on:
  pull_request:
    types: [opened, synchronize]
outputs:
  add-comment: { max: 1 }
  add-label: true
```

**Capabilities:**
- Layer boundary enforcement
- Dependency direction validation
- Pattern consistency checking
- Custom architecture rule definitions

---

### Doc Sync Agent

Monitors code changes and identifies documentation that needs updating.

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
outputs:
  create-issue: { max: 3 }
  add-comment: { max: 1 }
```

**Capabilities:**
- API change to doc mapping
- README staleness detection
- Example code validation
- Documentation coverage analysis

---

### Tech Debt Tracker Agent

Identifies and tracks technical debt across the codebase.

```yaml
on:
  schedule:
    - cron: '0 0 1 * *'
outputs:
  create-issue: { max: 10 }
  add-label: true
```

**Capabilities:**
- TODO/FIXME/HACK comment tracking
- Code complexity hotspot identification
- Dependency age analysis
- Refactoring opportunity detection

---

### Issue Decomposer Agent

Breaks down large, complex issues into smaller, actionable tasks.

```yaml
on:
  issues:
    types: [labeled]
    labels: [epic, large]
outputs:
  create-issue: { max: 10 }
  add-comment: { max: 1 }
```

**Capabilities:**
- Identifies components and dependencies
- Creates well-structured sub-issues
- Establishes parent-child relationships
- Suggests milestone assignments

---

## Future Vision

### Multi-Agent Orchestration

Chain agents together for complex workflows:

```
PR Opened
    ↓
[Security Scanner] → Issues found? → Block merge
    ↓
[PR Review] → Comments posted
    ↓
[Test Coverage Advisor] → Suggestions added
    ↓
PR Merged
    ↓
[Doc Sync] → Doc issues created
    ↓
[Changelog Curator] → CHANGELOG updated
```

### Agent Marketplace

Share and discover community-built agents:
- Verified agent templates
- One-click installation
- Configuration presets
- Usage analytics

### Custom Tool Integrations

Connect agents to external services:
- Slack notifications
- Jira synchronization
- Custom webhooks
- Database queries

---

## Suggest an Agent

Have an idea for a new agent? We'd love to hear it!

[Open an issue](https://github.com/lucasilverentand/gh-claude/issues/new?labels=agent-idea) with the `agent-idea` label describing:
- What the agent would do
- When it would run (triggers)
- What actions it would take (outputs)
- Example use cases

## See Also

- [Available Agents](gallery/) - Ready-to-use agents
- [Examples](/gh-claude/examples/) - Complete working examples
- [Agent Definition](/gh-claude/guide/agent-definition/) - Build custom agents
