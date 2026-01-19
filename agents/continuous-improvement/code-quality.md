# Code Quality Agent

Proactively scans the codebase for code quality issues and creates PRs to fix them.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (weekly) + manual dispatch |
| **Schedule** | Monday 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 60 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Code Quality Agent continuously improves code health by:

- **Finding** code smells, style violations, and quality issues
- **Creating** focused PRs that address specific categories
- **Documenting** complex issues that need human decisions
- **Maintaining** consistent code quality over time

## Trigger Configuration

```yaml
on:
  schedule:
    - cron: '0 6 * * 1'  # Monday 6am UTC
  workflow_dispatch: {}
```

Runs weekly on Monday mornings, or can be triggered manually.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 3 | Create PRs for fixable issues |
| `create-issue` | 2 | Document complex issues |
| `add-label` | unlimited | Categorize created PRs/issues |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
```

Only scans and modifies source code, not tests or configuration.

## Context Collection

```yaml
context:
  commits:
    branches: [main]
    limit: 50
  since: "7d"
  min_items: 1
```

Reviews commits from the past week to focus on recently active areas.

## Issues Detected

### Linting & Style

| Issue | Example | Fix |
|-------|---------|-----|
| Inconsistent formatting | Mixed tabs/spaces | Apply formatter |
| Unused imports | `import { unused } from 'lib'` | Remove import |
| Incorrect casing | `myVariable` vs `my_variable` | Rename consistently |
| Missing semicolons | `const x = 1` vs `const x = 1;` | Add/remove per style |

### Code Smells

| Issue | Example | Fix |
|-------|---------|-----|
| Long functions | 100+ line functions | Extract helpers |
| Deep nesting | 4+ levels of indentation | Refactor logic |
| Magic numbers | `if (status === 3)` | Extract constant |
| Duplicate strings | Same string in multiple places | Extract constant |
| God objects | Classes with 20+ methods | Note for refactoring |

### Maintainability

| Issue | Example | Fix |
|-------|---------|-----|
| TODO comments | `// TODO: fix later` | Implement or create issue |
| FIXME markers | `// FIXME: hack` | Fix or document |
| Commented code | Large blocks of comments | Remove |
| Dead branches | `if (false) { ... }` | Remove unreachable code |

### Type Safety

| Issue | Example | Fix |
|-------|---------|-----|
| Missing types | `function foo(x)` | Add type annotations |
| Any types | `const data: any` | Add proper type |
| Type assertions | `as unknown as Type` | Fix underlying issue |
| Non-null assertions | `value!.property` | Add proper check |

### Deprecated APIs

| Issue | Example | Fix |
|-------|---------|-----|
| Deprecated methods | Using deprecated APIs | Update to current API |
| Old patterns | Callbacks vs Promises | Modernize code |
| Legacy syntax | `var` vs `const/let` | Update syntax |

## Detection Process

```
┌─────────────────────────────────────┐
│   Scheduled run (Monday 6am)        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Collect Context                 │
│  - Get recent commits               │
│  - Identify active areas            │
│  - List files to analyze            │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Analyze Code                    │
│  - Scan for code smells             │
│  - Check style consistency          │
│  - Find TODO/FIXME comments         │
│  - Identify type issues             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Categorize Issues               │
│  - Group by type                    │
│  - Prioritize by impact             │
│  - Separate fixable vs complex      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Create PRs                      │
│  - One category per PR              │
│  - Clear explanations               │
│  - Focused, reviewable changes      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Create Issues                   │
│  - Complex refactoring needs        │
│  - Design decisions required        │
│  - Technical debt documentation     │
└─────────────────────────────────────┘
```

## PR Categories

The agent creates separate PRs for each category:

### 1. Style & Formatting PR

```markdown
## Summary

Fixes code style and formatting inconsistencies across the codebase.

## Changes

- Removed 15 unused imports across 8 files
- Fixed indentation in `src/api/handlers.ts`
- Applied consistent naming convention in `src/utils/`

## Why These Changes?

Consistent code style improves readability and reduces cognitive load
when reviewing code. These changes have no functional impact.
```

### 2. Code Quality PR

```markdown
## Summary

Improves code quality by addressing code smells.

## Changes

- Extracted magic numbers to named constants
- Removed 3 blocks of commented-out code
- Reduced nesting depth in `processData()` function

## Why These Changes?

These improvements make the code more maintainable and easier to
understand for future contributors.
```

### 3. Type Safety PR

```markdown
## Summary

Improves type safety by adding missing type annotations.

## Changes

- Added return types to 12 functions
- Replaced `any` types with specific types in 5 places
- Fixed type assertion in `parseConfig()`

## Why These Changes?

Better typing catches errors at compile time and improves
IDE support for developers.
```

## Issue Templates

### Technical Debt Issue

```markdown
## Technical Debt: [Brief Description]

### Overview
[Description of the issue]

### Locations
- `src/module/file.ts:45-120` - [Description]
- `src/other/file.ts:30-50` - [Description]

### Impact
- [Impact 1]
- [Impact 2]

### Suggested Approach
[Recommendation for fixing]

### Why Not Auto-Fixed?
[Explanation of why this needs human decision]

---
Labels: tech-debt, code-quality
```

## Agent Instructions

The full instructions for Claude should cover:

### Scanning Strategy

1. **Focus on active areas** - Recent commits indicate active development
2. **Be systematic** - Check each category methodically
3. **Prioritize impact** - High-impact issues first
4. **Stay current** - Use up-to-date best practices

### PR Guidelines

1. **One category per PR** - Don't mix formatting with logic changes
2. **Keep PRs small** - Under 500 lines changed when possible
3. **Clear descriptions** - Explain what and why
4. **No functional changes** - Only quality improvements
5. **Preserve behavior** - Tests should still pass

### Issue Guidelines

1. **Be specific** - Include file locations and line numbers
2. **Explain impact** - Why does this matter?
3. **Suggest approach** - How might this be fixed?
4. **Don't duplicate** - Check for existing issues

### Key Behaviors

- **Conservative fixes** - When in doubt, create issue instead
- **Respect context** - Some "smells" are intentional
- **Incremental improvement** - Don't try to fix everything at once
- **Clear commit messages** - Explain each change

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | May be picked up by [Issue Implementer](./issue-implementer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| Schedule | Cron (Monday 6am UTC) |
| Human | workflow_dispatch |

### Coordination Notes

- Works alongside [Dead Code Finder](./dead-code-finder.md) (Tuesdays)
- Created PRs go through standard review process
- Complex issues may inform [Refactoring Agent](./refactoring.md) work

## Example Scenarios

### Scenario 1: Unused Imports

**Detection:**
```typescript
import { foo, bar, baz } from './utils';
// Only 'foo' is used in the file
```

**PR Created:**
- Title: `chore: remove unused imports`
- Changes: Remove `bar, baz` from import
- Labels: `automated`, `code-quality`

### Scenario 2: Magic Numbers

**Detection:**
```typescript
if (response.status === 429) {
  await sleep(60000);
}
```

**PR Created:**
- Title: `refactor: extract magic numbers to constants`
- Changes:
  ```typescript
  const RATE_LIMIT_STATUS = 429;
  const RATE_LIMIT_DELAY_MS = 60000;

  if (response.status === RATE_LIMIT_STATUS) {
    await sleep(RATE_LIMIT_DELAY_MS);
  }
  ```

### Scenario 3: Complex Refactoring Needed

**Detection:**
```typescript
// 200+ line function with complex branching
async function processOrder(order) {
  // ... extensive logic
}
```

**Issue Created:**
- Title: "Refactor: Break down `processOrder` function"
- Body: Explains the complexity, suggests splitting approach
- Labels: `tech-debt`, `code-quality`, `refactoring`

## Frontmatter Reference

```yaml
---
name: Code Quality Agent
on:
  schedule:
    - cron: '0 6 * * 1'  # Monday 6am UTC
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 3 }
  create-issue: { max: 2 }
  add-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
context:
  commits:
    branches: [main]
    limit: 50
  since: "7d"
  min_items: 1
rate_limit_minutes: 60
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.4
---
```

## Customization Options

### Change Schedule

Run more or less frequently:
```yaml
schedule:
  - cron: '0 6 * * *'  # Daily
  - cron: '0 6 1 * *'  # Monthly
```

### Expand Scope

Include tests:
```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
```

### Adjust Detection

Customize which issues to detect via instructions.

## Metrics to Track

- Issues detected per run
- PRs created vs merged
- Issues created vs resolved
- Code quality trend over time
- Time spent on manual code cleanup (before/after)
