---
title: Available Agents
description: Ready-to-use Claude-powered agents with complete examples
---

import { Card, CardGrid } from '@astrojs/starlight/components';

# Available Agents

These agents are fully documented with working examples. Click any agent to see the complete implementation.

---

## Issue Management

### Issue Triage Agent

**[View Complete Example →](/gh-claude/examples/issue-triage/)**

Automatically categorizes and prioritizes new issues, welcomes contributors, and adds appropriate labels.

```yaml
on:
  issues:
    types: [opened]
outputs:
  add-comment: { max: 1 }
  add-label: true
```

**Use cases:**
- Welcome first-time contributors
- Add priority and type labels
- Route issues to the right team
- Request missing information

---

## Code Review

### PR Review Agent

**[View Complete Example →](/gh-claude/examples/pr-review/)**

Performs initial code review on pull requests, checking for common issues, missing tests, and documentation gaps.

```yaml
on:
  pull_request:
    types: [opened, synchronize]
outputs:
  add-comment: { max: 1 }
  add-label: true
```

**Use cases:**
- Check code quality and style
- Identify missing tests
- Flag documentation gaps
- Suggest improvements

---

## Repository Maintenance

### Stale Issue Manager

**[View Complete Example →](/gh-claude/examples/daily-summary/)**

Identifies inactive issues, adds warning labels, and closes after extended inactivity.

```yaml
on:
  schedule:
    - cron: '0 9 * * 1'
inputs:
  issues:
    state: open
    labels: []
  since: "30d"
outputs:
  add-label: true
  add-comment: true
  close-issue: true
```

**Use cases:**
- Warn about stale issues
- Close abandoned issues
- Keep backlog clean
- Request updates from authors

---

## Project Intelligence

### Daily Summary Agent

**[View Complete Example →](/gh-claude/examples/daily-summary/)**

Generates daily activity summaries including new issues, merged PRs, and project metrics.

```yaml
on:
  schedule:
    - cron: '0 17 * * *'
inputs:
  issues:
    state: all
  pull_requests:
    state: all
  since: "24h"
outputs:
  create-discussion: { max: 1 }
```

**Use cases:**
- Daily activity reports
- Weekly summaries
- Metrics tracking
- Team updates

---

## Getting Started

1. **Choose an agent** from the examples above
2. **Copy the example** to `.github/claude-agents/`
3. **Customize** the instructions for your needs
4. **Compile and deploy** with `gh claude compile`

```bash
# Initialize gh-claude
gh claude init

# Copy an example agent
cp examples/issue-triage.md .github/claude-agents/

# Compile to workflow
gh claude compile --all
```

## See Also

- [Examples](/gh-claude/examples/) - Complete working examples with explanations
- [Roadmap](/gh-claude/agents/roadmap/) - Planned agents coming soon
- [Agent Definition](/gh-claude/guide/agent-definition/) - Build custom agents
