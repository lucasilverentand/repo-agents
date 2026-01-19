# Documentation Sync Agent

Keeps documentation in sync with code changes, identifying gaps and creating updates.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR merge to main + weekly schedule |
| **Schedule** | Friday 8am UTC |
| **Permissions** | `contents: write`, `issues: write`, `pull_requests: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Documentation Sync Agent maintains documentation accuracy by:

- **Detecting** when code changes require doc updates
- **Identifying** outdated examples and broken links
- **Creating** issues for documentation gaps
- **Updating** straightforward documentation directly

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
  schedule:
    - cron: '0 8 * * 5'  # Friday 8am UTC
  workflow_dispatch: {}
```

Triggers on:
- **PR merge**: Check if merged changes need doc updates
- **Weekly**: Audit overall documentation health
- **Manual**: On-demand documentation review

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-issue` | 5 | Document gaps requiring human work |
| `create-pr` | 2 | Straightforward doc fixes |
| `add-comment` | 1 | Note on merged PRs |
| `add-label` | unlimited | Categorize issues |

## Allowed Paths

```yaml
allowed-paths:
  - "docs/**"
  - "README.md"
  - "CONTRIBUTING.md"
  - "*.md"
```

Only modifies documentation files.

## Context Collection

```yaml
context:
  pull_requests:
    states: [merged]
    limit: 50
  since: "7d"
  min_items: 1
```

Reviews merged PRs to understand recent changes.

## Documentation Checks

### 1. API Documentation

| Check | Example | Action |
|-------|---------|--------|
| New endpoints | Added `/api/v2/users` | Create issue: Document endpoint |
| Changed parameters | Modified request body | Create issue: Update parameters |
| Deprecated endpoints | Marked for removal | Create issue: Add deprecation notice |
| Response changes | New fields in response | Create issue: Update examples |

### 2. README Accuracy

| Check | Example | Action |
|-------|---------|--------|
| Installation steps | Changed from npm to bun | Create PR: Update steps |
| Feature list | New feature added | Create issue: Add to features |
| Requirements | Node version changed | Create PR: Update requirements |
| Quick start | Example broken | Create PR: Fix example |

### 3. Code Examples

| Check | Example | Action |
|-------|---------|--------|
| Outdated imports | Changed export names | Create PR: Update imports |
| Deprecated APIs | Old method usage | Create issue: Update example |
| Missing examples | New feature undocumented | Create issue: Add example |
| Broken examples | Code doesn't compile | Create PR: Fix example |

### 4. Configuration Documentation

| Check | Example | Action |
|-------|---------|--------|
| New options | Added config field | Create issue: Document option |
| Changed defaults | Default value changed | Create PR: Update docs |
| Removed options | Config deprecated | Create issue: Update docs |
| Environment variables | New env var added | Create issue: Document var |

### 5. Structural Issues

| Check | Example | Action |
|-------|---------|--------|
| Broken links | Link to deleted page | Create PR: Fix link |
| Missing pages | Feature without docs | Create issue: Create page |
| Orphaned pages | Docs for removed feature | Create issue: Remove/archive |
| Navigation gaps | New page not in nav | Create PR: Add to nav |

## Sync Process

### On PR Merge

```
┌─────────────────────────────────────┐
│   PR merged to main                 │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Changes                 │
│  - Read PR diff                     │
│  - Identify changed components      │
│  - Check for API changes            │
│  - Note new exports/features        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Check Documentation Impact      │
│  - Find related docs                │
│  - Check if docs mention changed    │
│    code                             │
│  - Identify gaps                    │
└─────────────────────────────────────┘
                   │
          ┌───────┴───────┐
          │               │
          ▼               ▼
   Has doc impact?   No impact?
          │               │
          ▼               ▼
   Create issue      No action
   or comment
```

### On Weekly Schedule

```
┌─────────────────────────────────────┐
│   Scheduled run (Friday 8am)        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Audit Documentation             │
│  - Check all links                  │
│  - Verify code examples             │
│  - Compare API to docs              │
│  - Review completeness              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Identify Issues                 │
│  - Broken links                     │
│  - Outdated examples                │
│  - Missing sections                 │
│  - Inconsistencies                  │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Take Action                     │
│  - Simple fixes: Create PR          │
│  - Complex gaps: Create issue       │
│  - Note findings in summary         │
└─────────────────────────────────────┘
```

## PR Templates

### Documentation Fix PR

```markdown
## Summary

Fixes documentation issues identified during sync review.

## Changes

### Link Fixes
- Fixed broken link to API reference in README.md
- Updated internal links in docs/getting-started.md

### Example Updates
- Updated import statement in docs/examples/basic.md
- Fixed deprecated method usage in docs/api/users.md

### Accuracy Fixes
- Updated Node.js version requirement to 18+
- Corrected installation command (npm → bun)

## Verification

- [ ] All links verified working
- [ ] Examples tested and working
- [ ] Consistent with current codebase
```

## Issue Templates

### API Documentation Gap

```markdown
## Documentation Needed: [API/Feature Name]

### Context
PR #123 added/modified [description] which requires documentation updates.

### What's Missing
- [ ] Endpoint documentation for `POST /api/v2/users`
- [ ] Request/response examples
- [ ] Error code documentation
- [ ] Migration guide from v1

### Relevant Files
- Source: `src/api/v2/users.ts`
- Current docs: `docs/api/users.md`

### Suggested Content
[Brief outline of what docs should cover]

---
Labels: documentation, api-docs
```

### Example Update Needed

```markdown
## Outdated Example: [Location]

### Context
Code example in [docs/guide/example.md] uses deprecated API.

### Current Example
```javascript
// This no longer works
import { oldMethod } from 'package';
oldMethod();
```

### Should Be
```javascript
// Current API
import { newMethod } from 'package';
newMethod();
```

### Related Changes
- PR #456 deprecated `oldMethod`
- PR #457 added `newMethod`

---
Labels: documentation, outdated-example
```

### Missing Feature Documentation

```markdown
## Documentation Needed: [Feature Name]

### Context
[Feature] was added in PR #789 but has no documentation.

### What's Needed
- [ ] Feature overview
- [ ] Configuration options
- [ ] Usage examples
- [ ] Common use cases
- [ ] Troubleshooting

### Source Files
- `src/features/new-feature.ts`
- `src/config/feature-config.ts`

### Priority
[High/Medium/Low] - [Reason]

---
Labels: documentation, new-feature
```

## Agent Instructions

The full instructions for Claude should cover:

### PR Merge Analysis

1. **Read the diff** - Understand what changed
2. **Identify public changes** - APIs, exports, configs
3. **Find related docs** - Search for mentions
4. **Assess impact** - Does this break/outdated docs?

### Weekly Audit

1. **Check links** - Verify all external and internal links
2. **Test examples** - Ensure code examples are valid
3. **Compare to code** - API docs match implementation
4. **Review structure** - Navigation and organization

### Action Guidelines

1. **Create PR** for simple, mechanical fixes
2. **Create issue** for content requiring expertise
3. **Comment on PR** when changes may need docs
4. **Be specific** about what needs updating

### Key Behaviors

- **Be comprehensive** - Check all impacted areas
- **Be specific** - Point to exact files and lines
- **Prioritize** - Critical docs before nice-to-have
- **Don't duplicate** - Check for existing issues

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | May be picked up by [Issue Implementer](./issue-implementer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| All agents | When their PRs merge to main |
| Schedule | Cron (Friday 8am UTC) |
| Human | workflow_dispatch |

### Coordination Notes

- Reviews work from all other agents
- Works end-of-week for accumulated changes
- Issues can be assigned to docs team

## Example Scenarios

### Scenario 1: API Change in Merged PR

**PR Merged:**
- Changes `createUser(email)` to `createUser(email, options?)`

**Agent Actions:**
1. Detects API signature change
2. Finds `docs/api/users.md` references the old signature
3. Creates issue: "Update createUser documentation with new options parameter"

### Scenario 2: Broken Link Found

**Weekly Audit:**
- Link to `https://old-docs.example.com/guide` returns 404

**Agent Actions:**
1. Identifies broken link in README.md
2. Searches for correct URL
3. Creates PR fixing the link

### Scenario 3: New Feature Without Docs

**PR Merged:**
- Adds new `export function processWebhook()`
- No documentation changes in PR

**Agent Actions:**
1. Detects new public API
2. Searches docs - no mention found
3. Creates issue: "Document new webhook processing feature"

## Frontmatter Reference

```yaml
---
name: Documentation Sync
on:
  pull_request:
    types: [closed]
    branches: [main]
  schedule:
    - cron: '0 8 * * 5'  # Friday 8am UTC
  workflow_dispatch: {}
permissions:
  contents: write
  issues: write
  pull_requests: write
outputs:
  create-issue: { max: 5 }
  create-pr: { max: 2 }
  add-comment: { max: 1 }
  add-label: true
allowed-paths:
  - "docs/**"
  - "README.md"
  - "CONTRIBUTING.md"
  - "*.md"
context:
  pull_requests:
    states: [merged]
    limit: 50
  since: "7d"
  min_items: 1
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.5
---
```

## Customization Options

### Documentation Locations

Adjust allowed-paths for your project structure:
```yaml
allowed-paths:
  - "website/docs/**"
  - "packages/*/README.md"
```

### Link Checking

Configure external domains to skip (paywalled, internal).

### Auto-Fix Scope

Expand or restrict what can be auto-fixed vs issue-created.

## Metrics to Track

- Documentation issues created per week
- Issues resolved vs created ratio
- Time from code change to doc update
- Broken links found and fixed
- User feedback on doc accuracy
