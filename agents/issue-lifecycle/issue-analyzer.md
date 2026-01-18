# Issue Analyzer Agent

Analyzes newly created issues for completeness and quality, providing feedback to reporters and preparing issues for triage.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Issue opened |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `issues: write` |
| **Rate Limit** | 1 minute |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Issue Analyzer is the first agent in the issue lifecycle. It acts as a quality gate, ensuring issues have sufficient information before entering the triage and implementation pipeline. By catching incomplete issues early, it saves time for maintainers and increases the likelihood of issues being resolved quickly.

## Trigger Configuration

```yaml
on:
  issues:
    types: [opened]
```

Triggers immediately when a new issue is created. Does not trigger on edits to allow reporters to address feedback without re-triggering.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Acknowledge issue and provide feedback |
| `add-label` | unlimited | Categorize issue state |

## Labels Used

### Labels Set by This Agent

| Label | When Applied |
|-------|--------------|
| `needs-info` | Issue is missing critical information |
| `ready-for-triage` | Issue has sufficient information for categorization |
| `good-first-issue` | Issue appears approachable for newcomers |

### Labels That Block This Agent

None - runs on all new issues.

## Analysis Criteria

### For Bug Reports

The agent checks for:

1. **Problem Statement**: Clear description of what's wrong
2. **Reproduction Steps**: How to reproduce the issue
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment Info**: Version, OS, browser (when relevant)
6. **Error Messages**: Stack traces, logs, screenshots

### For Feature Requests

The agent checks for:

1. **Use Case**: Why this feature is needed
2. **Proposed Solution**: What the requester envisions
3. **Alternatives Considered**: Other approaches thought about
4. **Scope**: Clear boundaries of the request

### For Questions

The agent checks for:

1. **Clear Question**: What exactly is being asked
2. **Context**: Relevant background information
3. **What Was Tried**: Efforts already made to find answer

## Decision Logic

```
┌─────────────────────────────────────┐
│         New Issue Created           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Analyze Title and Body          │
│  - Detect issue type (bug/feature)  │
│  - Check for required information   │
│  - Evaluate clarity                 │
└─────────────────────────────────────┘
                   │
          ┌───────┴───────┐
          │               │
          ▼               ▼
    Missing Info?    Complete?
          │               │
          ▼               ▼
   ┌──────────┐    ┌──────────────┐
   │ Add      │    │ Add          │
   │ needs-   │    │ ready-for-   │
   │ info     │    │ triage       │
   └──────────┘    └──────────────┘
          │               │
          ▼               ▼
   ┌──────────────────────────────┐
   │  Comment with:               │
   │  - Acknowledgment            │
   │  - Specific questions (if    │
   │    needs-info)               │
   │  - Appreciation (if ready)   │
   └──────────────────────────────┘
```

## Comment Templates

### When Information is Missing

```markdown
Thank you for opening this issue! To help us understand and address this effectively,
could you please provide some additional information?

**Missing details:**
- [Specific item 1]
- [Specific item 2]
- [Specific item 3]

Once you've added this information, we'll be able to triage and prioritize this issue.
```

### When Issue is Complete

```markdown
Thank you for the detailed issue report! This has been marked as ready for triage
and will be categorized shortly.

[If applicable: This looks like a great first issue for new contributors!]
```

## Agent Instructions

The full instructions for Claude should cover:

1. **Tone**: Welcoming, constructive, never discouraging
2. **Specificity**: Ask for specific missing items, not vague "more info"
3. **Context Awareness**: Recognize technical vs. non-technical reporters
4. **Pattern Recognition**: Identify common issue types from keywords
5. **Efficiency**: Don't ask for information already provided

### Key Behaviors

- **Never** be dismissive or harsh
- **Always** thank the reporter
- **Focus** on what's missing, not what's wrong
- **Provide** examples when asking for reproduction steps
- **Recognize** when an issue is actually a question and handle appropriately

## Inter-Agent Relationships

### Triggers Other Agents

| Label | Triggers |
|-------|----------|
| `ready-for-triage` | [Issue Triage](./issue-triage.md) |

### Triggered By

None - this is the first agent in the issue pipeline.

### Coordination Notes

- The `needs-info` label pauses the pipeline until the reporter responds
- When reporter edits the issue with more info, a maintainer can manually add `ready-for-triage`
- The `good-first-issue` label is informational and doesn't trigger other agents

## Example Scenarios

### Scenario 1: Incomplete Bug Report

**Input Issue:**
```
Title: App crashes
Body: The app crashes when I click the button.
```

**Agent Response:**
- Adds label: `needs-info`
- Comments asking for: reproduction steps, which button, error messages, environment

### Scenario 2: Complete Feature Request

**Input Issue:**
```
Title: Add dark mode support
Body:
## Problem
Working late at night, the bright interface causes eye strain.

## Proposed Solution
Add a dark mode toggle in settings that:
- Switches color scheme to dark colors
- Persists preference in local storage
- Respects system preference by default

## Alternatives
- Browser extensions (but doesn't work on mobile)
- OS-level dark mode (inconsistent results)
```

**Agent Response:**
- Adds label: `ready-for-triage`
- Comments with appreciation for detailed request

### Scenario 3: Question Disguised as Issue

**Input Issue:**
```
Title: How do I configure the API endpoint?
Body: I'm trying to set up the project but can't figure out where to configure the API.
```

**Agent Response:**
- Adds labels: `ready-for-triage`, `question`
- Comments acknowledging it's a question and that it will be triaged

## Frontmatter Reference

```yaml
---
name: Issue Analyzer
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
rate_limit_minutes: 1
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 4096
  temperature: 0.5
---
```

## Customization Options

### Adjust Strictness

- **Stricter**: Require all fields for bug reports (version, OS, etc.)
- **Looser**: Accept issues with just a clear problem statement

### Change Model

- Use `claude-haiku` for faster, cheaper analysis of simple issues
- Use `claude-sonnet` for more nuanced understanding (default)

### Modify Labels

Customize the label names in the instructions to match your repository's conventions.

## Metrics to Track

- Issues marked `ready-for-triage` vs `needs-info` ratio
- Time from issue creation to triage completion
- Reporter response rate to `needs-info` requests
- False positive rate (issues marked `needs-info` that were actually complete)
