# Issue Implementer Agent

Implements approved issues by analyzing requirements, writing code, and creating pull requests.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | `approved` or `ready-to-implement` label added |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `contents: write`, `issues: write`, `pull_requests: write` |
| **Rate Limit** | 10 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Issue Implementer is the core automation agent that transforms approved issues into working code. It:

- **Reads** and deeply understands the issue requirements
- **Explores** the codebase to understand architecture and patterns
- **Implements** the requested changes following existing conventions
- **Tests** the changes by writing or updating tests
- **Creates** a pull request with comprehensive documentation

## Trigger Configuration

```yaml
on:
  issues:
    types: [labeled]
trigger_labels: [approved, ready-to-implement]
```

Only triggers when a human explicitly approves an issue for implementation.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 1 | Create pull request with implementation |
| `add-comment` | 2 | Update issue with progress/PR link |
| `add-label` | unlimited | Mark implementation status |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "test/**"
  - "docs/**"
  - "*.md"
  - "*.json"
  - "*.yaml"
  - "*.yml"
```

Files outside these paths cannot be modified.

## Labels Used

### Labels Set by This Agent

| Label | When Applied |
|-------|--------------|
| `implementation-in-progress` | When starting implementation |

### Labels That Trigger This Agent

| Label | Effect |
|-------|--------|
| `approved` | Triggers implementation |
| `ready-to-implement` | Alternative trigger |

## Implementation Process

```
┌─────────────────────────────────────┐
│   approved label added              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Understand Requirements         │
│  - Read issue title and body        │
│  - Analyze acceptance criteria      │
│  - Identify scope and constraints   │
│  - Note any linked issues/PRs       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Explore Codebase                │
│  - Find related files               │
│  - Understand architecture          │
│  - Identify patterns to follow      │
│  - Locate test examples             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Plan Implementation             │
│  - List files to modify/create      │
│  - Determine approach               │
│  - Identify potential risks         │
│  - Plan test coverage               │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Implement Changes               │
│  - Write/modify source code         │
│  - Follow existing conventions      │
│  - Add appropriate comments         │
│  - Handle edge cases                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Write Tests                     │
│  - Add unit tests for new code      │
│  - Update existing tests if needed  │
│  - Cover happy path and edge cases  │
│  - Follow existing test patterns    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  6. Create Pull Request             │
│  - Create feature branch            │
│  - Commit all changes               │
│  - Write PR description             │
│  - Link to issue                    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  7. Update Issue                    │
│  - Add implementation-in-progress   │
│  - Comment with PR link             │
└─────────────────────────────────────┘
```

## Pull Request Format

### Branch Naming

```
issue-{number}-{short-description}
```

Examples:
- `issue-42-add-dark-mode`
- `issue-123-fix-login-redirect`
- `issue-89-update-api-docs`

### PR Title

```
{type}: {description} (#{issue-number})
```

Examples:
- `feat: add dark mode toggle (#42)`
- `fix: resolve login redirect loop (#123)`
- `docs: update API authentication guide (#89)`

### PR Body Template

```markdown
## Summary

[Brief description of what this PR implements]

Closes #{issue-number}

## Changes

- [Change 1]
- [Change 2]
- [Change 3]

## Implementation Details

[Explanation of the approach taken and why]

## Test Plan

- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Edge cases considered

### How to Test

1. [Step 1]
2. [Step 2]
3. [Expected result]

## Screenshots

[If applicable, include screenshots of UI changes]

## Checklist

- [ ] Code follows project conventions
- [ ] Tests pass locally
- [ ] Documentation updated (if needed)
- [ ] No breaking changes (or documented if any)
```

## Agent Instructions

The full instructions for Claude should cover:

### 1. Requirement Understanding

- Parse issue description thoroughly
- Identify explicit and implicit requirements
- Note any constraints or limitations mentioned
- Check for linked issues or related context

### 2. Codebase Exploration

- Search for related files and patterns
- Understand the module structure
- Find similar implementations for reference
- Identify shared utilities to reuse

### 3. Implementation Guidelines

- Follow existing code style exactly
- Use existing utilities and helpers
- Maintain consistent error handling
- Keep changes focused and minimal
- Don't over-engineer the solution

### 4. Testing Requirements

- Write tests for all new functionality
- Cover both success and failure cases
- Follow existing test patterns
- Ensure tests are deterministic

### 5. PR Quality

- Clear, concise descriptions
- Explain the "why" not just the "what"
- Include test plan for reviewers
- Link to relevant documentation

### Key Behaviors

- **Understand before coding** - Never start without full understanding
- **Follow conventions** - Match existing patterns exactly
- **Test thoroughly** - Don't skip tests for "simple" changes
- **Document clearly** - Future maintainers need context
- **Stay focused** - Only implement what's requested

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| Human | `approved` or `ready-to-implement` label |

### Coordination Notes

- Uses labels from [Issue Triage](./issue-triage.md) to understand priority
- Benefits from [Issue Formatter](./issue-formatter.md) structured content
- Created PRs are reviewed by [PR Reviewer](./pr-reviewer.md)

## Example Scenarios

### Scenario 1: Bug Fix

**Input Issue:**
```
Title: Login button unresponsive on mobile

## Summary
On mobile devices, the login button sometimes doesn't respond to taps.

## Steps to Reproduce
1. Open app on mobile browser
2. Tap login button
3. First tap often doesn't register

## Expected Behavior
Login button should respond on first tap.

## Environment
- iOS Safari, Android Chrome
- Affects all mobile viewports

Labels: bug, priority:high, area:frontend, approved
```

**Implementation:**
- Identifies touch event handling issue
- Adds proper touch event listeners
- Tests on multiple viewport sizes
- Creates PR: `fix: improve login button touch responsiveness (#45)`

### Scenario 2: Feature Implementation

**Input Issue:**
```
Title: Add CSV export for reports

## Summary
Users need to export report data as CSV files.

## Proposed Solution
- Add "Export CSV" button to report page
- Include all visible columns in export
- Name file with report name and date

## Acceptance Criteria
- Button visible on all report types
- Export includes headers
- Works with filtered data

Labels: feature, priority:medium, area:backend, area:frontend, approved
```

**Implementation:**
- Creates CSV generation utility
- Adds API endpoint for export
- Adds frontend button and download handling
- Writes tests for CSV formatting
- Creates PR: `feat: add CSV export for reports (#78)`

### Scenario 3: Documentation Update

**Input Issue:**
```
Title: Update API authentication documentation

## Summary
Current docs don't explain the new OAuth flow.

## What's Needed
- Add OAuth 2.0 section
- Include code examples
- Document error responses

Labels: documentation, priority:low, approved
```

**Implementation:**
- Reviews current auth implementation
- Writes comprehensive OAuth docs
- Adds code examples in multiple languages
- Creates PR: `docs: add OAuth 2.0 authentication guide (#92)`

## Frontmatter Reference

```yaml
---
name: Issue Implementer
on:
  issues:
    types: [labeled]
trigger_labels: [approved, ready-to-implement]
permissions:
  contents: write
  issues: write
  pull_requests: write
outputs:
  create-pr: { max: 1 }
  add-comment: { max: 2 }
  add-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "test/**"
  - "docs/**"
  - "*.md"
  - "*.json"
  - "*.yaml"
  - "*.yml"
rate_limit_minutes: 10
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.4
---
```

## Customization Options

### Expand Allowed Paths

Add project-specific paths:
```yaml
allowed-paths:
  - "packages/**"
  - "apps/**"
  - "config/**"
```

### Adjust Model Settings

- Increase `maxTokens` for larger implementations
- Lower `temperature` for more deterministic code

### Custom Branch Naming

Modify instructions to use different branch naming conventions.

### Draft vs Ready PRs

Change instructions to create draft PRs if preferred.

## Safety Considerations

### What the Agent Cannot Do

- Modify workflow files (`.github/workflows/`)
- Change lock files (`package-lock.json`, `bun.lockb`)
- Access environment files (`.env*`)
- Modify files outside `allowed-paths`

### Human Oversight

- Requires human `approved` label to start
- All PRs require human review before merge
- Can be stopped by removing the label

## Metrics to Track

- Issues implemented vs approved ratio
- PR merge rate (quality indicator)
- Time from approval to PR creation
- Human modifications needed post-PR
- Test coverage of implementations
