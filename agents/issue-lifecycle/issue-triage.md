# Issue Triage Agent

Automatically categorizes and prioritizes issues that are ready for triage, applying type, priority, and area labels.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | `ready-for-triage` label added |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `issues: write` |
| **Rate Limit** | 1 minute |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Issue Triage agent takes issues that have been validated by the Issue Analyzer and applies systematic categorization. This enables:

- **Filtering**: Teams can filter by type, priority, or area
- **Prioritization**: Critical issues are surfaced immediately
- **Assignment**: Area labels help route to the right team members
- **Metrics**: Track issue distribution across categories

## Trigger Configuration

```yaml
on:
  issues:
    types: [labeled]
trigger_labels: [ready-for-triage]
```

Only triggers when the `ready-for-triage` label is added, ensuring issues have passed initial analysis.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Summarize categorization |
| `add-label` | unlimited | Apply type, priority, area labels |
| `remove-label` | unlimited | Remove trigger label after processing |

## Labels Used

### Labels Set by This Agent

#### Type Labels

| Label | Description | Indicators |
|-------|-------------|------------|
| `bug` | Something isn't working | "error", "crash", "broken", "doesn't work" |
| `feature` | New feature request | "add", "new", "would be nice", "suggestion" |
| `enhancement` | Improvement to existing | "improve", "better", "update", "change" |
| `documentation` | Docs-related | "docs", "readme", "typo", "unclear" |
| `question` | Support request | "how do I", "help", "confused", "?" |
| `chore` | Maintenance task | "update deps", "refactor", "cleanup" |

#### Priority Labels

| Label | Description | Criteria |
|-------|-------------|----------|
| `priority:critical` | Immediate attention | Security, data loss, complete breakage |
| `priority:high` | Address soon | Major functionality broken, many affected |
| `priority:medium` | Normal queue | Standard bugs and features |
| `priority:low` | Nice to have | Minor issues, cosmetic, edge cases |

#### Area Labels (customize per project)

| Label | Description |
|-------|-------------|
| `area:frontend` | UI/UX related |
| `area:backend` | Server/API related |
| `area:api` | API endpoints/contracts |
| `area:infra` | Infrastructure/DevOps |
| `area:auth` | Authentication/Authorization |
| `area:database` | Database/Data layer |
| `area:cli` | Command-line interface |
| `area:docs` | Documentation |

#### State Labels

| Label | Description |
|-------|-------------|
| `triaged` | Has been categorized (added) |
| `ready-for-triage` | Ready for categorization (removed) |

### Labels That Trigger This Agent

| Label | Effect |
|-------|--------|
| `ready-for-triage` | Triggers triage process |

## Decision Logic

```
┌─────────────────────────────────────┐
│   ready-for-triage label added      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Analyze Issue Content           │
│  - Read title and body              │
│  - Identify keywords and patterns   │
│  - Consider context and tone        │
└─────────────────────────────────────┘
                   │
          ┌───────┴───────┬───────────┐
          │               │           │
          ▼               ▼           ▼
   ┌──────────┐    ┌──────────┐  ┌──────────┐
   │ Determine│    │ Assess   │  │ Identify │
   │ Type     │    │ Priority │  │ Area     │
   └──────────┘    └──────────┘  └──────────┘
          │               │           │
          └───────────────┴───────────┘
                         │
                         ▼
┌─────────────────────────────────────┐
│  Apply Labels:                      │
│  - Type (bug, feature, etc.)        │
│  - Priority (critical, high, etc.)  │
│  - Area (frontend, backend, etc.)   │
│  - Remove ready-for-triage          │
│  - Add triaged                      │
└─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────┐
│  Comment with Summary:              │
│  - Categorization explanation       │
│  - Next steps                       │
│  - Mention if needs additional      │
│    human review                     │
└─────────────────────────────────────┘
```

## Priority Assessment Criteria

### Critical Priority

- Security vulnerabilities
- Data loss or corruption
- Complete application failure
- Authentication bypass
- Payment/billing issues

### High Priority

- Major feature broken for many users
- Significant performance degradation
- Blocker for upcoming release
- Regression from recent changes

### Medium Priority

- Standard bugs with workarounds
- New feature requests with clear value
- Enhancement requests
- Minor functionality issues

### Low Priority

- Cosmetic issues
- Edge case bugs
- Nice-to-have features
- Minor documentation updates

## Comment Templates

### Standard Triage Summary

```markdown
This issue has been triaged with the following categorization:

- **Type**: `bug`
- **Priority**: `priority:medium`
- **Area**: `area:frontend`

**Next Steps**: This issue is now in the backlog and will be addressed based on priority.
Contributors are welcome to pick this up!
```

### Critical Issue Triage

```markdown
This issue has been triaged as **critical priority**.

- **Type**: `bug`
- **Priority**: `priority:critical`
- **Area**: `area:auth`

This issue affects security/core functionality and will be prioritized for immediate attention.
```

### Needs Human Review

```markdown
This issue has been initially triaged:

- **Type**: `feature`
- **Priority**: `priority:medium`
- **Area**: `area:api`

**Note**: This request may have broader implications. A maintainer should review
the scope and priority assessment.
```

## Agent Instructions

The full instructions for Claude should cover:

1. **Systematic Analysis**: Check title, body, and any error messages
2. **Keyword Recognition**: Map common phrases to categories
3. **Context Sensitivity**: Understand project-specific terminology
4. **Conservative Priority**: Don't over-prioritize; medium is the default
5. **Multi-Area Issues**: Apply multiple area labels when appropriate

### Key Behaviors

- **Apply exactly one** type label
- **Apply exactly one** priority label
- **Apply one or more** area labels as appropriate
- **Always remove** `ready-for-triage` after processing
- **Always add** `triaged` to mark completion
- **Note uncertainty** in comment when unsure about categorization

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Adds type/priority labels | Informs [Issue Implementer](./issue-implementer.md) prioritization |

### Triggered By

| Agent | Via |
|-------|-----|
| [Issue Analyzer](./issue-analyzer.md) | `ready-for-triage` label |

### Coordination Notes

- Works after Issue Analyzer validates completeness
- Labels inform Issue Implementer's prioritization when `approved`
- Area labels can be used for CODEOWNERS-style routing

## Example Scenarios

### Scenario 1: Security Bug

**Input Issue:**
```
Title: XSS vulnerability in comment field
Body: User input in comments is not sanitized, allowing script injection.
Steps to reproduce:
1. Post a comment with <script>alert('xss')</script>
2. View the comment
3. Script executes

Labels: ready-for-triage
```

**Agent Response:**
- Removes: `ready-for-triage`
- Adds: `bug`, `priority:critical`, `area:frontend`, `area:auth`, `triaged`
- Comments: Triaged as critical security issue

### Scenario 2: Feature Request

**Input Issue:**
```
Title: Add CSV export for reports
Body: It would be great to export report data as CSV for analysis in Excel.

Labels: ready-for-triage
```

**Agent Response:**
- Removes: `ready-for-triage`
- Adds: `feature`, `priority:medium`, `area:backend`, `triaged`
- Comments: Standard triage summary

### Scenario 3: Multi-Area Enhancement

**Input Issue:**
```
Title: Improve error messages across the application
Body: Error messages are too technical. Need user-friendly messages in UI
and better logging on server.

Labels: ready-for-triage
```

**Agent Response:**
- Removes: `ready-for-triage`
- Adds: `enhancement`, `priority:medium`, `area:frontend`, `area:backend`, `triaged`
- Comments: Notes multiple areas affected

## Frontmatter Reference

```yaml
---
name: Issue Triage
on:
  issues:
    types: [labeled]
trigger_labels: [ready-for-triage]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
  remove-label: true
rate_limit_minutes: 1
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 4096
  temperature: 0.4
---
```

## Customization Options

### Add Custom Area Labels

Modify the instructions to recognize project-specific areas:

```
Area labels for this project:
- area:parser - Parsing and schema validation
- area:generator - Workflow generation
- area:cli - Command-line interface
- area:outputs - Output handlers
```

### Adjust Priority Thresholds

Customize what constitutes each priority level for your project's context.

### Skip Comment for Minor Issues

For high-volume repositories, configure to only comment on high/critical priority.

## Metrics to Track

- Distribution of issues by type, priority, area
- Triage accuracy (human corrections to labels)
- Time from `ready-for-triage` to `triaged`
- Critical issues per time period
