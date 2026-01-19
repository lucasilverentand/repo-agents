# Migration Assistant Agent

Helps upgrade frameworks, libraries, and patterns with automated code transformations.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Issue labeled `migration`, workflow_dispatch |
| **Schedule** | N/A (on-demand) |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Migration Assistant reduces upgrade burden by:

- **Analyzing** codebase for migration requirements
- **Transforming** code patterns to new APIs
- **Updating** configuration files and dependencies
- **Testing** changes to ensure correctness
- **Documenting** manual steps that couldn't be automated

## Trigger Configuration

```yaml
on:
  issues:
    types: [labeled]
  workflow_dispatch:
    inputs:
      migration_type:
        description: 'Type of migration'
        required: true
        type: choice
        options:
          - framework-upgrade
          - library-replacement
          - pattern-modernization
      target:
        description: 'Target version or library'
        required: true
```

Triggers on:
- **labeled**: When issue gets `migration` label
- **workflow_dispatch**: Manual trigger with parameters

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 1 | Migration implementation |
| `add-comment` | 2 | Progress updates on issue |
| `update-file` | unlimited | Code transformations |
| `add-label` | unlimited | Status labels |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "package.json"
  - "tsconfig.json"
  - "*.config.js"
  - "*.config.ts"
```

Can modify source, tests, and configuration files.

## Context Collection

```yaml
context:
  issues:
    labels: [migration]
    states: [open]
    limit: 1
```

Focuses on the specific migration issue.

## Migration Types

### 1. Framework Upgrades

| Migration | Example | Complexity |
|-----------|---------|------------|
| React 17 → 18 | New root API, Suspense changes | Medium |
| Vue 2 → 3 | Composition API, new reactivity | High |
| Angular major versions | Various breaking changes | High |
| Next.js 13 → 14 | App router, server components | Medium |
| Express 4 → 5 | Async middleware, removed APIs | Low |

### 2. Library Replacements

| From | To | Reason |
|------|-----|--------|
| Moment.js | date-fns / dayjs | Bundle size, maintenance |
| Request | Axios / fetch | Deprecated |
| Lodash | Native methods | Bundle size |
| Class components | Hooks | Modern patterns |
| Callbacks | Async/await | Readability |

### 3. Pattern Modernization

| Old Pattern | New Pattern | Benefit |
|-------------|-------------|---------|
| CommonJS | ES Modules | Tree shaking |
| var | const/let | Scoping |
| Callbacks | Promises/async | Readability |
| Class components | Functional | Simplicity |
| REST | GraphQL | Flexibility |

## Migration Process

```
┌─────────────────────────────────────┐
│   Migration issue created/labeled   │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Migration Scope         │
│  - Parse issue for requirements     │
│  - Identify affected files          │
│  - Check current versions           │
│  - Estimate complexity              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Create Migration Plan           │
│  - List all transformations needed  │
│  - Order by dependency              │
│  - Identify manual steps            │
│  - Note testing requirements        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Execute Transformations         │
│  - Update dependencies              │
│  - Transform code patterns          │
│  - Update configuration             │
│  - Modify imports/exports           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Verify Changes                  │
│  - Run type checker                 │
│  - Execute test suite               │
│  - Check for runtime errors         │
│  - Validate build process           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Create PR with Documentation    │
│  - Detailed changelog               │
│  - Manual steps remaining           │
│  - Testing instructions             │
│  - Rollback procedure               │
└─────────────────────────────────────┘
```

## Transformation Examples

### React 17 → 18

```typescript
// Before
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// After
import { createRoot } from 'react-dom/client';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

### Moment.js → date-fns

```typescript
// Before
import moment from 'moment';
const formatted = moment(date).format('YYYY-MM-DD');
const diff = moment(date1).diff(date2, 'days');

// After
import { format, differenceInDays } from 'date-fns';
const formatted = format(date, 'yyyy-MM-dd');
const diff = differenceInDays(date1, date2);
```

### CommonJS → ES Modules

```typescript
// Before
const fs = require('fs');
const { join } = require('path');
module.exports = { myFunction };

// After
import fs from 'fs';
import { join } from 'path';
export { myFunction };
```

### Class → Functional Components

```typescript
// Before
class Counter extends React.Component {
  state = { count: 0 };

  increment = () => {
    this.setState({ count: this.state.count + 1 });
  };

  render() {
    return <button onClick={this.increment}>{this.state.count}</button>;
  }
}

// After
function Counter() {
  const [count, setCount] = useState(0);

  const increment = () => setCount(count + 1);

  return <button onClick={increment}>{count}</button>;
}
```

## PR Template

```markdown
## Migration: [Framework/Library] v[X] → v[Y]

### Summary

This PR migrates the codebase from [old] to [new].

### Changes Made

#### Dependencies
- Updated `[package]` from `X.X.X` to `Y.Y.Y`
- Removed deprecated `[package]`
- Added new dependency `[package]`

#### Code Transformations

| Pattern | Files Changed | Status |
|---------|---------------|--------|
| New root API | 1 | ✅ Automated |
| Suspense boundaries | 3 | ✅ Automated |
| useId hook | 5 | ✅ Automated |
| Concurrent features | 2 | ⚠️ Manual review needed |

#### Configuration
- Updated `tsconfig.json` for new JSX transform
- Modified `vite.config.ts` for React 18 compatibility

### Manual Steps Required

The following changes couldn't be automated and need manual review:

1. **Concurrent rendering opt-in** (`src/App.tsx:15`)
   - Review if Suspense boundaries are correctly placed
   - Consider adding startTransition for non-urgent updates

2. **StrictMode double-rendering** (`src/index.tsx`)
   - Verify effects handle mount/unmount correctly

### Testing

```bash
# Verify the migration
bun test
bun run build
bun run typecheck
```

### Rollback

If issues arise:
```bash
git revert HEAD
bun install
```

### Breaking Changes for Consumers

None - this is an internal upgrade.

### References

- [React 18 Upgrade Guide](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
- [Migration Issue](#123)
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Understand requirements** - What's the target state?
2. **Audit current state** - What versions/patterns exist?
3. **Map dependencies** - What depends on what?
4. **Plan order** - What must change first?

### Transformation Guidelines

1. **Be conservative** - Preserve behavior
2. **Transform consistently** - Same pattern everywhere
3. **Keep working** - Ensure build passes at each step
4. **Test thoroughly** - Run full test suite

### Documentation Guidelines

1. **List all changes** - Nothing hidden
2. **Explain manual steps** - Be specific
3. **Provide rollback** - How to undo
4. **Reference guides** - Link to official docs

### Key Behaviors

- **Never break** the build
- **Always preserve** functionality
- **Document** anything manual
- **Test** before creating PR

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Updates code | [Test Coverage Agent](./test-coverage.md) may add tests |

### Triggered By

| Source | Via |
|--------|-----|
| Issue labeled | `issues: labeled` with `migration` |
| Human | `workflow_dispatch` |

### Coordination Notes

- Large migrations may need multiple PRs
- [Breaking Change Detector](./breaking-change-detector.md) should review
- May generate work for [Test Coverage Agent](./test-coverage.md)

## Example Scenarios

### Scenario 1: React Upgrade

**Issue:**
```markdown
Title: Upgrade React 17 to 18

We need to upgrade to React 18 for concurrent features.
Currently on react@17.0.2.
```

**Action:**
1. Analyze: 45 components, 12 using class syntax
2. Plan: Update deps → transform root → update Suspense
3. Execute: All transformations
4. Verify: Tests pass, build works
5. PR: Detailed migration PR

### Scenario 2: Library Replacement

**Issue:**
```markdown
Title: Replace Moment.js with date-fns

Moment.js is too large. Replace with date-fns.
```

**Action:**
1. Analyze: 23 files using moment
2. Map: moment methods → date-fns equivalents
3. Transform: All usages
4. Remove: moment from dependencies
5. PR: With size comparison

### Scenario 3: Pattern Modernization

**Issue:**
```markdown
Title: Convert callbacks to async/await

Modernize our async code to use async/await.
```

**Action:**
1. Find: All callback-based async code
2. Transform: To async/await pattern
3. Update: Error handling
4. Test: Verify behavior unchanged

## Frontmatter Reference

```yaml
---
name: Migration Assistant
on:
  issues:
    types: [labeled]
  workflow_dispatch:
    inputs:
      migration_type:
        description: 'Type of migration'
        required: true
      target:
        description: 'Target version'
        required: true
trigger_labels: [migration]
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 1 }
  add-comment: { max: 2 }
  update-file: true
  add-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "package.json"
  - "tsconfig.json"
  - "*.config.js"
  - "*.config.ts"
context:
  issues:
    labels: [migration]
    states: [open]
    limit: 1
rate_limit_minutes: 30
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.4
---
```

## Customization Options

### Supported Migrations

Configure which migrations are supported.

### Transformation Rules

Add custom transformation patterns.

### Verification Steps

Configure required checks before PR.

## Metrics to Track

- Migrations completed successfully
- Manual intervention rate
- Test failure rate after migration
- Rollback frequency
- Time saved vs manual migration
