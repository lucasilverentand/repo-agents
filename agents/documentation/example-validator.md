# Example Validator Agent

Tests code examples in documentation to ensure they still work correctly.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (weekly) + PR merge to main |
| **Schedule** | Saturday 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Example Validator ensures documentation accuracy by:

- **Extracting** code examples from documentation
- **Testing** examples against the current codebase
- **Identifying** broken imports, APIs, and syntax
- **Fixing** simple issues automatically
- **Creating** issues for complex problems

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "src/**"
      - "lib/**"
  schedule:
    - cron: '0 6 * * 6'  # Saturday 6am UTC
  workflow_dispatch: {}
```

Triggers on:
- **PR merge**: When source code changes
- **Weekly**: Full validation audit
- **Manual**: On-demand validation

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 1 | Fix broken examples |
| `create-issue` | 3 | Report unfixable issues |
| `update-file` | unlimited | Update doc files |
| `add-label` | unlimited | Categorize issues |

## Allowed Paths

```yaml
allowed-paths:
  - "docs/**"
  - "README.md"
  - "*.md"
```

Only modifies documentation files.

## Context Collection

```yaml
context:
  pull_requests:
    states: [merged]
    paths: ["src/**", "lib/**"]
    limit: 20
  since: "7d"
```

Focuses on code changes that might break examples.

## Validation Types

### 1. Import Validation

Check that imports exist and are correct:

```typescript
// Example in docs
import { createUser } from '@/api/users';

// Validation checks:
// ✓ Does '@/api/users' exist?
// ✓ Does it export 'createUser'?
// ✓ Is the export named correctly?
```

### 2. API Signature Validation

Check function calls match current signatures:

```typescript
// Example in docs
const user = await createUser('john@example.com');

// Current signature
function createUser(options: CreateUserOptions): Promise<User>

// Validation result: ❌ Signature mismatch
// Fix: createUser({ email: 'john@example.com' })
```

### 3. Type Validation

Check that types are used correctly:

```typescript
// Example in docs
const config: Config = {
  host: 'localhost',
  port: '3000',  // ❌ Should be number
};
```

### 4. Syntax Validation

Check for syntax errors:

```typescript
// Example in docs
const result = await fetchData(
  // ❌ Missing closing parenthesis
```

### 5. Output Validation

Check expected outputs match reality:

```typescript
// Example claims:
// Returns: { id: 'user_123', name: 'John' }

// Actual output:
// Returns: { id: 'user_123', name: 'John', createdAt: '...' }

// Result: ⚠️ Missing field in example
```

## Validation Process

```
┌─────────────────────────────────────┐
│   Trigger (PR merge/schedule)       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Extract Code Examples           │
│  - Scan markdown files              │
│  - Find code blocks                 │
│  - Identify language/context        │
│  - Note file and line location      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Categorize Examples             │
│  - Runnable (full snippets)         │
│  - Partial (fragments)              │
│  - Output-only (expected results)   │
│  - Pseudo-code (conceptual)         │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Validate Each Example           │
│  - Check imports exist              │
│  - Verify API signatures            │
│  - Type check if possible           │
│  - Syntax validation                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Categorize Issues               │
│  - Auto-fixable (simple changes)    │
│  - Manual fix (complex changes)     │
│  - False positive (intentional)     │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Take Action                     │
│  - Create PR for auto-fixes         │
│  - Create issues for manual fixes   │
│  - Report validation results        │
└─────────────────────────────────────┘
```

## Auto-Fixable Issues

| Issue | Example | Auto-Fix |
|-------|---------|----------|
| Renamed export | `import { foo }` → `import { bar }` | ✅ Yes |
| Added optional param | Missing new optional param | ✅ Yes |
| Type literal change | `'old'` → `'new'` | ✅ Yes |
| Simple syntax error | Missing semicolon | ✅ Yes |
| Deprecated import path | Old path → new path | ✅ Yes |

## Manual-Fix Issues

| Issue | Example | Why Manual |
|-------|---------|------------|
| API redesign | Completely different pattern | Needs context |
| Logic change | Different approach needed | Needs understanding |
| New required param | Need valid example value | Needs domain knowledge |
| Complex refactor | Multiple interrelated changes | Needs review |

## Comment Templates

### Validation Report

```markdown
## 📋 Example Validation Report

Validated **47** code examples across **12** documentation files.

### Summary

| Status | Count |
|--------|-------|
| ✅ Valid | 42 |
| 🔧 Auto-fixed | 3 |
| ❌ Needs attention | 2 |

### Auto-Fixed Examples

The following examples were automatically updated:

#### `docs/getting-started.md:45`
```diff
- import { createClient } from 'old-package';
+ import { createClient } from '@org/new-package';
```

#### `docs/api/users.md:78`
```diff
- const user = createUser(email);
+ const user = createUser({ email });
```

### Issues Created

- #234: Fix authentication example in `docs/auth.md`
- #235: Update webhook example with new payload format

### Skipped (Pseudo-code)

- `docs/concepts.md:23` - Conceptual example, not meant to run
```

## PR Template

```markdown
## Fix Broken Documentation Examples

### Summary

Fixes code examples that no longer work with the current codebase.

### Changes

#### Import Updates
| File | Line | Change |
|------|------|--------|
| `docs/getting-started.md` | 45 | Updated import path |
| `README.md` | 112 | Fixed export name |

#### API Signature Updates
| File | Line | Change |
|------|------|--------|
| `docs/api/users.md` | 78 | Updated to object parameter |
| `docs/guides/auth.md` | 34 | Added required options |

### Related Changes
- Source change: PR #230 renamed export
- Source change: PR #228 changed API signature

### Validation
- [x] All fixed examples validated
- [x] No new issues introduced
```

## Issue Template

```markdown
## Broken Example: [File:Line]

### Location
`docs/api/webhooks.md` line 45

### Current Example
```typescript
const webhook = await createWebhook({
  url: 'https://example.com/hook',
  events: ['user.created']
});
```

### Issue
The `createWebhook` function now requires an `auth` parameter.

### Current Signature
```typescript
function createWebhook(options: {
  url: string;
  events: string[];
  auth: { type: 'bearer'; token: string } | { type: 'basic'; credentials: string };
}): Promise<Webhook>
```

### Suggested Fix
```typescript
const webhook = await createWebhook({
  url: 'https://example.com/hook',
  events: ['user.created'],
  auth: { type: 'bearer', token: process.env.WEBHOOK_TOKEN }
});
```

### Why Manual
This fix requires choosing appropriate example values for the auth configuration.

---
Labels: `documentation`, `example-broken`, `good-first-issue`
```

## Agent Instructions

The full instructions for Claude should cover:

### Extraction Strategy

1. **Find all code blocks** - Look for ```language markers
2. **Identify context** - What is this example showing?
3. **Determine testability** - Can this be validated?
4. **Note location** - File and line number

### Validation Strategy

1. **Check imports** - Do they resolve?
2. **Check signatures** - Do calls match?
3. **Check types** - Are types correct?
4. **Check syntax** - Is it valid code?

### Fix Strategy

1. **Simple fixes only** - Don't guess complex changes
2. **Preserve intent** - Keep the example's purpose
3. **Match style** - Follow existing formatting
4. **Verify fix** - Re-validate after fixing

### Key Behaviors

- **Be conservative** - Don't break working examples
- **Create issues** for complex problems
- **Preserve pseudo-code** - Not everything should run
- **Track coverage** - Know what's validated

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | May be picked up by [Issue Implementer](./issue-implementer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| Code changes | `pull_request: closed` |
| Schedule | Cron (Saturday 6am UTC) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Works with [Documentation Sync](./documentation-sync.md)
- Complements [API Docs Generator](./api-docs-generator.md)
- Created issues are good for new contributors

## Example Scenarios

### Scenario 1: Renamed Export

**Detection:**
```typescript
// In docs/getting-started.md
import { oldName } from '@/utils';

// But source code now exports:
export { newName } from './utils';
```

**Action:**
1. Detect import failure
2. Find renamed export
3. Auto-fix: Update import to `newName`
4. Include in PR

### Scenario 2: Changed Signature

**Detection:**
```typescript
// In docs/api.md
createUser('email@example.com');

// But current signature is:
function createUser(options: { email: string }): User
```

**Action:**
1. Detect signature mismatch
2. Auto-fix: `createUser({ email: 'email@example.com' })`
3. Include in PR

### Scenario 3: Complex Change

**Detection:**
```typescript
// Example uses removed functionality
const result = await legacyApi.fetch();
// legacyApi no longer exists
```

**Action:**
1. Detect missing module
2. Cannot auto-fix (replacement unclear)
3. Create issue with details
4. Label as `good-first-issue`

## Frontmatter Reference

```yaml
---
name: Example Validator
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "src/**"
      - "lib/**"
  schedule:
    - cron: '0 6 * * 6'
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 1 }
  create-issue: { max: 3 }
  update-file: true
  add-label: true
allowed-paths:
  - "docs/**"
  - "README.md"
  - "*.md"
context:
  pull_requests:
    states: [merged]
    paths: ["src/**", "lib/**"]
    limit: 20
  since: "7d"
rate_limit_minutes: 30
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.4
---
```

## Customization Options

### Validation Strictness

Configure how strict validation should be.

### Language Support

Configure which code block languages to validate.

### Ignore Patterns

Skip certain examples (e.g., pseudo-code markers).

## Metrics to Track

- Examples validated per run
- Broken examples found
- Auto-fix success rate
- Manual fix turnaround time
- False positive rate
