---
title: Testing Strategies
description: Strategies for developing and testing gh-claude agents safely
---

Develop and test agents safely before production deployment.

## Development Workflow

### 1. Start with workflow_dispatch

Always start with manual-only triggers:

```yaml
---
name: New Agent (Testing)
on:
  workflow_dispatch: {}  # Manual only during development
  # issues:
  #   types: [opened]    # Enable after testing
permissions:
  issues: read  # Start read-only
outputs:
  # Start with no outputs, just logging
---
Test agent logic safely before enabling automated triggers.
```

### 2. Use Dry-Run Pattern

Add a dry-run input for safe testing:

```yaml
---
name: Testing Agent
on:
  workflow_dispatch:
    inputs:
      dryRun:
        description: 'Dry run mode'
        type: boolean
        default: true
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
---

**DRY RUN MODE: {{ inputs.dryRun }}**

If dry run is true:
- Analyze and log what you WOULD do
- Add comment explaining planned actions
- DO NOT actually modify anything

If dry run is false:
- Execute actual operations
```

### 3. Gradual Permission Escalation

Progressively add permissions as you gain confidence:

```yaml
# Phase 1: Read-only
permissions:
  issues: read

# Phase 2: Add comments only
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }

# Phase 3: Full operations
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
  close-issue: true
```

## Local Testing

```bash
# Validate agent definition
gh claude validate .github/claude-agents/my-agent.md --strict

# Compile and review workflow
gh claude compile .github/claude-agents/my-agent.md --dry-run

# List all agents
gh claude list

# Test compilation of all agents
gh claude compile --all --dry-run
```

## Testing Checklist

- [ ] Test with workflow_dispatch manually
- [ ] Verify agent handles missing data gracefully
- [ ] Check rate limiting works as expected
- [ ] Test with minimum items threshold
- [ ] Validate all output actions work correctly
- [ ] Review generated workflow YAML
- [ ] Test access control (if using allowed-teams/actors)
- [ ] Verify path restrictions work (if using allowed-paths)
- [ ] Monitor API usage and costs

## CI/CD Integration

### Validate on PR

```yaml
# .github/workflows/validate-agents.yml
name: Validate Agents
on:
  pull_request:
    paths:
      - '.github/claude-agents/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: gh extension install lucasilverentand/gh-claude
      - run: gh claude validate --all --strict
```

### Auto-Compile on PR

```yaml
name: Compile Claude Agents
on:
  pull_request:
    paths:
      - '.github/claude-agents/**'

jobs:
  compile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: gh extension install lucasilverentand/gh-claude
      - run: gh claude validate --all --strict
      - run: gh claude compile --all
      - name: Commit compiled workflows
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .github/workflows/
          git diff --staged --quiet || git commit -m "chore: compile claude agents"
          git push
```

## See Also

- [Quick Start](/gh-claude/getting-started/quick-start/) - First agent setup
- [Troubleshooting](/gh-claude/guide/troubleshooting/) - Common issues
- [CLI Reference](/gh-claude/cli/) - Command documentation
