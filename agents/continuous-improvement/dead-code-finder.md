# Dead Code Finder Agent

Identifies and removes unused code, dependencies, and files from the codebase.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (weekly) + manual dispatch |
| **Schedule** | Tuesday 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 60 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Dead Code Finder keeps the codebase lean by:

- **Detecting** unused exports, functions, and variables
- **Identifying** orphaned files and test files
- **Finding** unused dependencies
- **Removing** safely deletable code via PRs
- **Documenting** uncertain cases for human review

## Trigger Configuration

```yaml
on:
  schedule:
    - cron: '0 6 * * 2'  # Tuesday 6am UTC
  workflow_dispatch: {}
```

Runs weekly on Tuesdays, staggered from other improvement agents.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 2 | Remove confirmed dead code |
| `create-issue` | 3 | Document uncertain cases |
| `add-label` | unlimited | Categorize created PRs/issues |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
  - "package.json"
```

Can modify source code and package.json for dependency removal.

## Context Collection

```yaml
context:
  commits:
    branches: [main]
    limit: 100
  since: "7d"
  min_items: 1
```

Uses commit history to understand code evolution.

## Dead Code Categories

### 1. Unused Exports

| Pattern | Example | Detection |
|---------|---------|-----------|
| Unused function | `export function helper()` | No imports found |
| Unused constant | `export const CONFIG = {}` | No references |
| Unused type | `export type Options = {}` | No usage |
| Unused class | `export class Util {}` | Never instantiated |

### 2. Unreachable Code

| Pattern | Example | Detection |
|---------|---------|-----------|
| After return | Code after `return` statement | Never executed |
| Dead branches | `if (false) { ... }` | Constant condition |
| Unused catch | Empty or log-only catch | No handling |
| Impossible conditions | `if (x && !x)` | Always false |

### 3. Unused Dependencies

| Pattern | Example | Detection |
|---------|---------|-----------|
| Installed but unused | Package in dependencies | No imports |
| Dev deps in prod | Test lib in dependencies | Wrong location |
| Duplicate functionality | Two libs for same purpose | Redundant |
| Deprecated packages | Packages with deprecation | Security/maintenance |

### 4. Orphaned Files

| Pattern | Example | Detection |
|---------|---------|-----------|
| Orphaned test | `old-feature.test.ts` | Tests deleted feature |
| Orphaned types | `types.d.ts` | No imports |
| Orphaned config | Module-specific config | Module deleted |
| Backup files | `file.ts.bak` | Not in use |

### 5. Commented-Out Code

| Pattern | Example | Detection |
|---------|---------|-----------|
| Function blocks | `// function old() {...}` | Large comment blocks |
| Import statements | `// import { old }` | Commented imports |
| Logic blocks | `/* if (condition) {...} */` | Commented logic |

## Detection Process

```
┌─────────────────────────────────────┐
│   Scheduled run (Tuesday 6am)       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Build Dependency Graph          │
│  - Parse all imports/exports        │
│  - Track references                 │
│  - Map file dependencies            │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Identify Unused Code            │
│  - Find unreferenced exports        │
│  - Detect orphaned files            │
│  - Check package.json deps          │
│  - Find commented code blocks       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Assess Confidence               │
│  - High: No references anywhere     │
│  - Medium: Only test references     │
│  - Low: Dynamic usage possible      │
│  - Uncertain: Reflection/eval use   │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Take Action                     │
│  - High confidence: Create PR       │
│  - Low confidence: Create issue     │
│  - Uncertain: Skip with note        │
└─────────────────────────────────────┘
```

## Confidence Assessment

### High Confidence (Create PR)

- No imports or references in entire codebase
- Not exported from main entry point
- Not mentioned in configuration files
- Not used via string interpolation

### Medium Confidence (Create PR with note)

- Only referenced in tests (test removed)
- Deprecated in favor of new implementation
- Marked with TODO: remove comments

### Low Confidence (Create Issue)

- Has dynamic property access nearby
- Part of public API (semver implications)
- Referenced in documentation
- Used via reflection or eval

### Uncertain (Skip)

- Part of framework conventions
- Lifecycle methods that may be called
- Decorator targets
- Template references

## PR Templates

### Dead Code Removal PR

```markdown
## Summary

Removes unused code identified in the codebase.

## Removals

### Unused Exports
- `src/utils/old-helpers.ts`: `formatDate()` - no references found
- `src/api/deprecated.ts`: `legacyEndpoint()` - replaced by v2

### Orphaned Files
- `src/features/removed-feature/` - entire directory (feature removed in #123)

### Commented Code
- `src/handlers/user.ts:45-67` - commented function block

## Confidence Level

**High** - These items have zero references in the codebase.

## Impact

- Reduces bundle size by ~5KB
- Removes maintenance burden
- Clarifies active codebase

## Verification

I verified that:
- [ ] No dynamic imports reference these items
- [ ] No configuration files reference these items
- [ ] No documentation links to these items
- [ ] Tests don't rely on these items
```

### Dependency Removal PR

```markdown
## Summary

Removes unused dependencies from package.json.

## Removals

| Package | Reason |
|---------|--------|
| `lodash` | Replaced with native methods |
| `moment` | Not imported anywhere |
| `old-plugin` | Referenced plugin removed |

## Impact

- Reduces install size
- Reduces security surface
- Faster CI builds

## Verification

- Ran `npm install` successfully
- All tests pass
- Build completes without errors
```

## Issue Templates

### Uncertain Dead Code Issue

```markdown
## Potential Dead Code: [Location]

### Overview
This code appears unused but requires human verification.

### Location
`src/api/handlers.ts:45-90`

```typescript
export function maybeUnused() {
  // ...
}
```

### Why It Might Be Dead
- No direct imports found
- No references in codebase

### Why It Might Be Used
- Part of public API
- May be used dynamically: `handlers[name]()`

### Recommendation
Please verify whether this code is:
1. Still needed (document usage)
2. Safe to remove (approve for deletion)

---
Labels: dead-code, needs-review
```

## Agent Instructions

The full instructions for Claude should cover:

### Detection Strategy

1. **Start with exports** - Find all exported items
2. **Trace references** - Search for all usages
3. **Check dynamics** - Look for string-based access
4. **Verify entry points** - Check public API exposure

### Safety Guidelines

1. **Be conservative** - When in doubt, create issue
2. **Check public API** - External usage may exist
3. **Watch for magic** - Reflection, eval, decorators
4. **Consider semver** - Removing exports is breaking

### PR Guidelines

1. **Group related removals** - One PR per category
2. **Document reasoning** - Explain how unused was determined
3. **Include verification** - Show what was checked
4. **Keep small** - Easier to review

### Key Behaviors

- **Never remove** code that might be dynamically accessed
- **Always check** test files before removing test utilities
- **Consider** public API implications
- **Document** uncertainty in issues

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | Available for human review |

### Triggered By

| Source | Via |
|--------|-----|
| Schedule | Cron (Tuesday 6am UTC) |
| Human | workflow_dispatch |

### Coordination Notes

- Complements [Code Quality Agent](./code-quality.md) (Mondays)
- May inform [Refactoring Agent](./refactoring.md) work
- Works after codebase is stable from weekend

## Example Scenarios

### Scenario 1: Clearly Unused Function

**Detection:**
```typescript
// src/utils/helpers.ts
export function formatLegacyDate(date: Date): string {
  // Only referenced in deleted file
}
```

**Search Results:**
- 0 imports of `formatLegacyDate`
- Not in entry point exports
- No dynamic access patterns

**Action:** Create PR to remove

### Scenario 2: Potentially Dynamic Usage

**Detection:**
```typescript
// src/handlers/index.ts
export const create = () => {};
export const read = () => {};
export const update = () => {};
export const delete_ = () => {};

// Elsewhere
const action = handlers[operation]();
```

**Action:** Create issue, dynamic access pattern detected

### Scenario 3: Unused Dependency

**Detection:**
```json
{
  "dependencies": {
    "lodash": "^4.17.21",
    "axios": "^1.0.0"
  }
}
```

**Search Results:**
- `lodash`: 0 imports
- `axios`: 15 imports

**Action:** Create PR to remove lodash

## Frontmatter Reference

```yaml
---
name: Dead Code Finder
on:
  schedule:
    - cron: '0 6 * * 2'  # Tuesday 6am UTC
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 2 }
  create-issue: { max: 3 }
  add-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
  - "package.json"
context:
  commits:
    branches: [main]
    limit: 100
  since: "7d"
  min_items: 1
rate_limit_minutes: 60
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.3
---
```

## Customization Options

### Include Test Files

```yaml
allowed-paths:
  - "src/**"
  - "tests/**"
```

### Adjust Confidence Threshold

Modify instructions to be more/less aggressive.

### Exclude Patterns

Add patterns to skip (e.g., plugin interfaces).

## Metrics to Track

- Lines of code removed per run
- Dependencies removed
- PRs merged vs rejected
- False positive rate
- Bundle size reduction
