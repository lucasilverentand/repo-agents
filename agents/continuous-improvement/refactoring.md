# Refactoring Agent

Identifies and implements structural improvements to the codebase, reducing complexity and improving maintainability.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (monthly) + manual dispatch |
| **Schedule** | 1st of each month, 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 120 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Refactoring Agent improves code architecture by:

- **Identifying** structural issues and design smells
- **Extracting** duplicated code into shared utilities
- **Simplifying** overly complex components
- **Modernizing** patterns and architectures
- **Documenting** major refactoring opportunities

## Trigger Configuration

```yaml
on:
  schedule:
    - cron: '0 6 1 * *'  # 1st of each month
  workflow_dispatch: {}
```

Runs monthly to avoid overwhelming with structural changes.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 2 | Implement safe refactorings |
| `create-issue` | 5 | Document major opportunities |
| `add-label` | unlimited | Categorize PRs/issues |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
```

Only modifies source code, not tests or configuration.

## Context Collection

```yaml
context:
  commits:
    branches: [main]
    limit: 200
  issues:
    labels: [tech-debt, refactoring]
    states: [open]
    limit: 20
  since: "30d"
  min_items: 1
```

Analyzes monthly commit patterns and existing tech debt issues.

## Refactoring Categories

### 1. Extract Common Code

| Pattern | Before | After |
|---------|--------|-------|
| Duplicated logic | Same code in 3+ places | Shared utility function |
| Similar classes | Copy-pasted class with small changes | Base class + inheritance |
| Repeated validation | Same checks everywhere | Validation utility |

### 2. Simplify Complexity

| Pattern | Before | After |
|---------|--------|-------|
| Deep nesting | 5+ levels of if/else | Early returns, guard clauses |
| Long functions | 100+ line functions | Smaller, focused functions |
| God objects | Class with 20+ methods | Split into focused classes |
| Switch statements | Large switch on type | Polymorphism or strategy |

### 3. Improve Architecture

| Pattern | Before | After |
|---------|--------|-------|
| Tight coupling | Direct dependencies | Dependency injection |
| Mixed concerns | Business logic in controllers | Separate service layer |
| Inconsistent patterns | Different approaches | Unified pattern |
| Circular dependencies | A → B → A | Restructured modules |

### 4. Modernize Code

| Pattern | Before | After |
|---------|--------|-------|
| Callbacks | Callback-based APIs | Async/await |
| Old syntax | `var`, `function()` | `const`, arrow functions |
| Deprecated APIs | Using removed features | Current alternatives |
| Manual iteration | `for` loops | `.map()`, `.filter()`, etc. |

## Analysis Process

```
┌─────────────────────────────────────┐
│   Monthly run (1st of month)        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Codebase Structure      │
│  - Map module dependencies          │
│  - Identify hot spots (frequent     │
│    changes)                         │
│  - Calculate complexity metrics     │
│  - Find duplication patterns        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Review Tech Debt Issues         │
│  - Check existing refactoring       │
│    issues                           │
│  - Identify patterns in reports     │
│  - Prioritize by impact             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Identify Opportunities          │
│  - Rank by:                         │
│    - Complexity reduction           │
│    - Change frequency               │
│    - Risk level                     │
│    - Effort required                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Take Action                     │
│  - Safe refactorings: Create PR     │
│  - Complex changes: Create issue    │
│  - Risky changes: Document only     │
└─────────────────────────────────────┘
```

## Risk Assessment

### Low Risk (Create PR)

- Extract duplicated code to utility
- Rename for clarity (with find/replace)
- Simplify conditions with early returns
- Remove dead branches
- Modernize syntax (same behavior)

### Medium Risk (Create PR with review note)

- Extract base class from similar classes
- Split large function into smaller ones
- Introduce dependency injection
- Consolidate similar utilities

### High Risk (Create Issue Only)

- Change core data structures
- Modify public API signatures
- Restructure module boundaries
- Change async patterns fundamentally

## PR Templates

### Safe Refactoring PR

```markdown
## Summary

Refactors [component] to improve [metric: readability/maintainability/etc.].

## Changes

### Extracted Utilities
- Created `src/utils/validation.ts` with shared validation logic
- Removed duplicate validation from 5 files

### Simplified Functions
- Split `processOrder()` (150 lines) into 4 focused functions
- Reduced cyclomatic complexity from 25 to 8

## Before/After

### Before
```typescript
// Duplicated in orders.ts, payments.ts, refunds.ts
function validateAmount(amount: number) {
  if (amount < 0) throw new Error('Invalid');
  if (amount > 1000000) throw new Error('Too large');
  return Math.round(amount * 100) / 100;
}
```

### After
```typescript
// src/utils/validation.ts - single source
export function validateAmount(amount: number): number {
  // ... same logic, one location
}

// All files now import from utility
import { validateAmount } from '@/utils/validation';
```

## Verification

- [ ] All tests pass
- [ ] No behavior changes (refactor only)
- [ ] Reviewed for unintended side effects
- [ ] Performance unchanged
```

### Architecture Refactoring PR

```markdown
## Summary

Introduces service layer to separate business logic from controllers.

## Motivation

Controllers currently contain business logic, making:
- Testing difficult (HTTP context required)
- Logic hard to reuse
- Concerns mixed together

## Changes

### New Structure
```
src/
├── controllers/     # HTTP handling only
│   └── users.ts     # Request parsing, response formatting
├── services/        # Business logic
│   └── UserService.ts  # All user operations
└── repositories/    # Data access
    └── UserRepository.ts  # Database queries
```

### Migration
- Extracted `UserService` from `UsersController`
- Controller now delegates to service
- Added dependency injection for testability

## Testing Impact
- Added unit tests for `UserService`
- Controller tests simplified (mock service)

## Risk Assessment
**Medium** - Changes internal structure but maintains external behavior.
All existing API contracts unchanged.
```

## Issue Templates

### Major Refactoring Opportunity

```markdown
## Refactoring Proposal: [Component/Area]

### Current State
[Description of current architecture/code]

### Problems
1. [Problem 1] - impact
2. [Problem 2] - impact
3. [Problem 3] - impact

### Proposed Changes
[Description of proposed refactoring]

### Benefits
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

### Risks
- [Risk 1] - mitigation
- [Risk 2] - mitigation

### Effort Estimate
[T-shirt size: S/M/L/XL] - [brief justification]

### Files Affected
- `src/module/file1.ts` - [change type]
- `src/module/file2.ts` - [change type]
- [etc.]

### Dependencies
- Should be done after: [other work]
- Blocks: [dependent work]

---
Labels: refactoring, tech-debt, [priority]
```

### Code Smell Documentation

```markdown
## Tech Debt: [Description]

### Location
`src/feature/handler.ts:45-200`

### Smell Type
[God Object / Deep Nesting / Duplication / etc.]

### Details
[Specific description of the issue]

### Impact
- Maintenance difficulty: [description]
- Bug risk: [description]
- Onboarding friction: [description]

### Suggested Approach
[Brief recommendation]

### Related
- Similar issue in: [other locations]
- Related PR: #[number]

---
Labels: tech-debt, code-smell
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Map the codebase** - Understand module structure
2. **Identify hot spots** - Frequently changed files
3. **Calculate complexity** - Find problematic areas
4. **Check patterns** - Look for inconsistencies

### Refactoring Principles

1. **Preserve behavior** - Refactoring ≠ bug fixes
2. **Small steps** - Incremental improvements
3. **Test coverage** - Ensure tests exist before refactoring
4. **One thing at a time** - Don't mix concerns in PRs

### Safety Guidelines

1. **Never change** public API without discussion
2. **Always ensure** tests pass
3. **Document** any behavior that might look different
4. **Create issue** for anything risky

### Key Behaviors

- **Be conservative** - structure changes are risky
- **Explain clearly** - why this improves things
- **Consider history** - why might it be this way?
- **Think dependencies** - what else might break?

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | May inform future [Issue Implementer](./issue-implementer.md) work |

### Triggered By

| Source | Via |
|--------|-----|
| Schedule | Cron (1st of month) |
| Human | workflow_dispatch |

### Coordination Notes

- Works monthly to allow time for reviews
- May reference issues from [Code Quality Agent](./code-quality.md)
- Large refactorings need human approval before implementation

## Example Scenarios

### Scenario 1: Duplicated Validation

**Detection:**
```typescript
// Found in 5 files:
if (!email.includes('@')) throw new Error('Invalid email');
if (email.length > 255) throw new Error('Email too long');
```

**Action:**
1. Create utility function
2. Update all usages
3. Create PR: "refactor: extract email validation utility"

### Scenario 2: Complex Function

**Detection:**
```typescript
async function processOrder(order) {
  // 200 lines of mixed concerns
  // Validation, business logic, API calls, formatting
}
```

**Action:**
1. Create issue documenting the complexity
2. Suggest splitting strategy
3. Label as `refactoring`, `tech-debt`

### Scenario 3: Inconsistent Patterns

**Detection:**
- `src/handlers/users.ts` uses callbacks
- `src/handlers/orders.ts` uses async/await
- `src/handlers/products.ts` uses Promises

**Action:**
1. Create PR modernizing to async/await
2. Focus on one handler per PR
3. Document pattern in CONTRIBUTING.md

## Frontmatter Reference

```yaml
---
name: Refactoring Agent
on:
  schedule:
    - cron: '0 6 1 * *'  # 1st of each month
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 2 }
  create-issue: { max: 5 }
  add-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
context:
  commits:
    branches: [main]
    limit: 200
  issues:
    labels: [tech-debt, refactoring]
    states: [open]
    limit: 20
  since: "30d"
  min_items: 1
rate_limit_minutes: 120
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.4
---
```

## Customization Options

### Frequency

Adjust schedule for project needs:
```yaml
schedule:
  - cron: '0 6 * * 1'  # Weekly instead of monthly
```

### Scope

Include or exclude certain directories.

### Aggressiveness

Modify instructions for more/fewer auto-PRs.

## Metrics to Track

- Complexity metrics over time
- Duplication percentage
- Files changed frequency
- Refactoring PRs merged
- Tech debt issues created/resolved
- Developer feedback on code quality
