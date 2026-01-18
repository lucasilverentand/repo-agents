# Breaking Change Detector Agent

Identifies semantic API breaking changes in pull requests that could affect consumers.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR opened, synchronize |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `pull_requests: write`, `contents: read` |
| **Rate Limit** | 5 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Breaking Change Detector protects API consumers by:

- **Identifying** changes that break backward compatibility
- **Classifying** the type and severity of breaking changes
- **Suggesting** non-breaking alternatives when possible
- **Documenting** required migration steps
- **Enforcing** semantic versioning practices

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

Triggers on:
- **opened**: Analyze new PRs for breaking changes
- **synchronize**: Re-analyze when commits are pushed

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Breaking change analysis |
| `add-label` | unlimited | Breaking change labels |

## Context Collection

```yaml
context:
  pull_requests:
    states: [open]
    limit: 1
```

Analyzes the PR diff against the base branch.

## Breaking Change Categories

### 1. Function/Method Changes

| Change | Breaking? | Example |
|--------|-----------|---------|
| Remove function | Yes | `export function foo()` removed |
| Rename function | Yes | `foo()` → `bar()` |
| Add required parameter | Yes | `foo(a)` → `foo(a, b)` |
| Remove parameter | Maybe | Depends on usage |
| Change parameter type | Yes | `foo(n: number)` → `foo(n: string)` |
| Change return type | Yes | Returns `string` → `number` |
| Add optional parameter | No | `foo(a, b?)` |

### 2. Type/Interface Changes

| Change | Breaking? | Example |
|--------|-----------|---------|
| Remove type | Yes | `export type Foo` removed |
| Remove property | Yes | `{ name: string }` → `{}` |
| Add required property | Yes | `{}` → `{ name: string }` |
| Change property type | Yes | `name: string` → `name: number` |
| Narrow union type | Yes | `'a' | 'b'` → `'a'` |
| Add optional property | No | `{}` → `{ name?: string }` |
| Widen union type | No | `'a'` → `'a' | 'b'` |

### 3. Class Changes

| Change | Breaking? | Example |
|--------|-----------|---------|
| Remove public method | Yes | Public method deleted |
| Remove public property | Yes | Public property deleted |
| Change method signature | Yes | Parameters or return changed |
| Make public → private | Yes | Visibility reduced |
| Change inheritance | Maybe | Depends on usage |
| Add abstract method | Yes | Subclasses must implement |

### 4. Module/Export Changes

| Change | Breaking? | Example |
|--------|-----------|---------|
| Remove export | Yes | `export { foo }` removed |
| Rename export | Yes | `export { foo }` → `export { bar }` |
| Change default export | Yes | Different default |
| Move to different path | Yes | Import path changed |
| Add new export | No | New functionality |

### 5. Behavior Changes

| Change | Breaking? | Example |
|--------|-----------|---------|
| Change error type | Yes | Different exception thrown |
| Change default value | Maybe | Could affect behavior |
| Change side effects | Maybe | Different observable behavior |
| Performance regression | Maybe | Significant slowdown |

## Detection Process

```
┌─────────────────────────────────────┐
│   PR opened/synchronized            │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Identify Public API Files       │
│  - Find exported modules            │
│  - Identify public interfaces       │
│  - Map API surface area             │
│  - Note package entry points        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Analyze Changes                 │
│  - Compare before/after signatures  │
│  - Check type definitions           │
│  - Review export statements         │
│  - Examine class hierarchies        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Classify Breaking Changes       │
│  - Removal: Something deleted       │
│  - Modification: Signature changed  │
│  - Behavioral: Logic changed        │
│  - Structural: Organization changed │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Assess Impact                   │
│  - How many consumers affected?     │
│  - Is there a migration path?       │
│  - Can it be made non-breaking?     │
│  - What version bump needed?        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Report Findings                 │
│  - List all breaking changes        │
│  - Suggest alternatives             │
│  - Provide migration guide          │
│  - Recommend version bump           │
└─────────────────────────────────────┘
```

## Severity Classification

| Severity | Criteria | Version Bump |
|----------|----------|--------------|
| **Major** | Public API removed or changed incompatibly | Major (1.0 → 2.0) |
| **Minor** | New functionality, deprecations | Minor (1.0 → 1.1) |
| **Patch** | Bug fixes, internal changes | Patch (1.0.0 → 1.0.1) |

## Comment Templates

### Breaking Changes Found

```markdown
## ⚠️ Breaking Change Detection

This PR contains **breaking changes** that will affect API consumers.

### Breaking Changes Detected

#### 1. Removed Function: `parseConfig`

**File**: `src/config.ts`
**Type**: Removal

```diff
- export function parseConfig(path: string): Config {
-   // ...
- }
```

**Impact**: Any code calling `parseConfig()` will fail.

**Migration**:
```typescript
// Before
const config = parseConfig('./config.json');

// After
const config = await loadConfig('./config.json');
```

---

#### 2. Changed Parameter: `createUser`

**File**: `src/users.ts`
**Type**: Signature Change

```diff
- export function createUser(name: string, email: string): User
+ export function createUser(options: CreateUserOptions): User
```

**Impact**: All existing calls need to be updated.

**Migration**:
```typescript
// Before
createUser('John', 'john@example.com');

// After
createUser({ name: 'John', email: 'john@example.com' });
```

---

### Recommended Actions

1. **Version Bump**: This requires a **major version** bump (semver)
2. **Changelog**: Document these changes in CHANGELOG.md
3. **Migration Guide**: Consider adding a migration guide

### Alternatives to Consider

- Add new function alongside old (deprecate old)
- Make new parameters optional with defaults
- Use function overloads for backward compatibility

---

Labels: `breaking-change`, `semver:major`
```

### No Breaking Changes

```markdown
## ✅ Breaking Change Analysis: None Detected

This PR does not appear to contain breaking changes to the public API.

### Analysis Summary

| Category | Status |
|----------|--------|
| Exports | ✅ No removals or renames |
| Function signatures | ✅ Compatible changes only |
| Type definitions | ✅ No narrowing changes |
| Default values | ✅ No behavior changes |

### Changes Reviewed
- `src/utils.ts`: New helper function added (non-breaking)
- `src/types.ts`: Optional property added (non-breaking)

---

**Recommended version bump**: Patch or Minor
```

### Deprecation Warning

```markdown
## 📋 Deprecation Notice

This PR deprecates existing APIs (not immediately breaking).

### Deprecated APIs

#### `oldFunction` → `newFunction`

```typescript
/**
 * @deprecated Use `newFunction` instead. Will be removed in v3.0.
 */
export function oldFunction() {
  console.warn('oldFunction is deprecated, use newFunction');
  return newFunction();
}
```

**Migration deadline**: v3.0.0
**Replacement**: `newFunction()`

---

Good practice: The deprecated function still works but warns users.
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Identify API surface** - What's exported/public?
2. **Compare signatures** - What changed?
3. **Trace dependencies** - What uses this?
4. **Consider semantics** - Does behavior change?

### Detection Guidelines

1. **Focus on public API** - Internal changes are less critical
2. **Check entry points** - package.json main/exports
3. **Review types** - TypeScript definitions are contracts
4. **Consider runtime** - Not just compile-time changes

### Reporting Guidelines

1. **Be precise** - Exact change and location
2. **Show diff** - Before and after
3. **Provide migration** - How to update
4. **Suggest alternatives** - Non-breaking options

### Key Behaviors

- **Don't block** non-breaking changes
- **Educate** on semver practices
- **Suggest** backward-compatible alternatives
- **Document** migration paths

## Language-Specific Patterns

### TypeScript/JavaScript

- Export statements
- Type definitions (`.d.ts`)
- `package.json` exports field
- Default vs named exports

### Python

- `__all__` exports
- Public vs `_private` naming
- Type hints (if used)
- `__init__.py` exports

### Go

- Exported (capitalized) identifiers
- Interface changes
- Struct field changes
- Module path changes

### Rust

- `pub` visibility
- Trait implementations
- Feature flags
- Re-exports

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| New PRs | `pull_request: opened` |
| PR updates | `pull_request: synchronize` |

### Coordination Notes

- Runs alongside [PR Reviewer](./pr-reviewer.md)
- Informs [Release Notes Generator](./release-notes-generator.md)
- Breaking changes should be documented in changelog

## Example Scenarios

### Scenario 1: Function Removal

**PR Change:**
```diff
- export function formatDate(date: Date): string {
-   return date.toISOString();
- }
```

**Action:**
1. Detect exported function removal
2. Label: `breaking-change`, `semver:major`
3. Comment with migration suggestion
4. Recommend keeping with deprecation warning

### Scenario 2: Type Narrowing

**PR Change:**
```diff
- export type Status = 'pending' | 'active' | 'archived' | 'deleted';
+ export type Status = 'pending' | 'active' | 'archived';
```

**Action:**
1. Detect union type narrowing
2. Label: `breaking-change`
3. Explain impact on existing code using 'deleted'

### Scenario 3: Safe Addition

**PR Change:**
```diff
  export interface Config {
    host: string;
    port: number;
+   timeout?: number;
  }
```

**Action:**
1. Detect optional property addition
2. Confirm non-breaking
3. Label: `semver:minor`

## Frontmatter Reference

```yaml
---
name: Breaking Change Detector
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
  contents: read
outputs:
  add-comment: { max: 1 }
  add-label: true
rate_limit_minutes: 5
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.3
---
```

## Customization Options

### API Paths

Configure which paths contain public API:
```yaml
api_paths:
  - "src/index.ts"
  - "src/public/**"
```

### Ignore Patterns

Skip certain changes:
```yaml
ignore:
  - "**/*.test.ts"
  - "**/internal/**"
```

### Strictness Level

Configure how strict detection should be.

## Metrics to Track

- Breaking changes detected per release
- False positive rate
- Time from detection to resolution
- Semver compliance rate
- Consumer-reported breaks (misses)
