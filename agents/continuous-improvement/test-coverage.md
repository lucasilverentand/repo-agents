# Test Coverage Agent

Identifies areas lacking test coverage and generates tests to improve code reliability.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (weekly) + manual dispatch |
| **Schedule** | Wednesday 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write` |
| **Rate Limit** | 60 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Test Coverage Agent improves code reliability by:

- **Analyzing** code to find untested areas
- **Generating** meaningful tests for critical paths
- **Following** existing test patterns and conventions
- **Prioritizing** high-value coverage (complex logic, edge cases)

## Trigger Configuration

```yaml
on:
  schedule:
    - cron: '0 6 * * 3'  # Wednesday 6am UTC
  workflow_dispatch: {}
```

Runs weekly on Wednesdays to maintain steady coverage improvement.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 3 | Add new test files/cases |
| `add-label` | unlimited | Categorize PRs |

## Allowed Paths

```yaml
allowed-paths:
  - "tests/**"
  - "test/**"
  - "src/**/*.test.ts"
  - "src/**/*.spec.ts"
  - "**/__tests__/**"
```

Only creates or modifies test files.

## Context Collection

```yaml
context:
  commits:
    branches: [main]
    limit: 50
  pull_requests:
    states: [merged]
    limit: 20
  since: "7d"
  min_items: 1
```

Focuses on recently changed code that may lack tests.

## Coverage Analysis

### Priority Levels

| Priority | Criteria | Example |
|----------|----------|---------|
| **Critical** | Core business logic | Payment processing |
| **High** | Complex algorithms | Data transformations |
| **Medium** | Utility functions | String formatting |
| **Low** | Simple getters/setters | Config accessors |

### Detection Criteria

1. **No Test File**: Source file has no corresponding test
2. **Low Coverage**: Existing tests don't cover key paths
3. **Missing Edge Cases**: Happy path tested, errors not
4. **New Code**: Recently added without tests
5. **Complex Logic**: High cyclomatic complexity

## Test Generation Process

```
┌─────────────────────────────────────┐
│   Scheduled run (Wednesday 6am)     │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Identify Coverage Gaps          │
│  - Map source files to test files   │
│  - Find files without tests         │
│  - Analyze test completeness        │
│  - Check recent changes             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Prioritize Targets              │
│  - Score by complexity              │
│  - Weight by recent changes         │
│  - Consider business importance     │
│  - Limit scope for manageability    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Analyze Source Code             │
│  - Understand function purpose      │
│  - Identify inputs and outputs      │
│  - Map edge cases and errors        │
│  - Note dependencies to mock        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Study Existing Patterns         │
│  - Read existing test files         │
│  - Match testing framework style    │
│  - Use project conventions          │
│  - Identify shared test utilities   │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Generate Tests                  │
│  - Write test cases                 │
│  - Include happy path               │
│  - Cover error conditions           │
│  - Add edge cases                   │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  6. Create PR                       │
│  - Group related tests              │
│  - Document test strategy           │
│  - Explain coverage improvement     │
└─────────────────────────────────────┘
```

## Test Structure

### Test File Organization

```typescript
// tests/unit/feature/handler.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handler } from '@/feature/handler';
import { mockDependency } from '@/tests/mocks';

describe('handler', () => {
  describe('when given valid input', () => {
    it('should return expected result', () => {
      // Arrange
      const input = { /* valid data */ };

      // Act
      const result = handler(input);

      // Assert
      expect(result).toEqual(/* expected */);
    });
  });

  describe('when given invalid input', () => {
    it('should throw ValidationError', () => {
      // Arrange
      const input = { /* invalid data */ };

      // Act & Assert
      expect(() => handler(input)).toThrow(ValidationError);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => { /* ... */ });
    it('should handle null values', () => { /* ... */ });
    it('should handle maximum values', () => { /* ... */ });
  });
});
```

### Test Categories

#### Unit Tests

Test individual functions in isolation:

```typescript
describe('calculateTotal', () => {
  it('should sum all item prices', () => {
    const items = [{ price: 10 }, { price: 20 }];
    expect(calculateTotal(items)).toBe(30);
  });

  it('should apply discount correctly', () => {
    const items = [{ price: 100 }];
    expect(calculateTotal(items, { discount: 0.1 })).toBe(90);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });
});
```

#### Integration Tests

Test component interactions:

```typescript
describe('UserService', () => {
  it('should create user and send welcome email', async () => {
    const emailService = vi.fn();
    const service = new UserService({ emailService });

    await service.createUser({ email: 'test@example.com' });

    expect(emailService).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    );
  });
});
```

#### Error Handling Tests

Test failure modes:

```typescript
describe('fetchUser', () => {
  it('should throw NotFoundError for missing user', async () => {
    const db = { findUser: vi.fn().mockResolvedValue(null) };

    await expect(fetchUser(db, 'unknown-id'))
      .rejects.toThrow(NotFoundError);
  });

  it('should handle database connection errors', async () => {
    const db = { findUser: vi.fn().mockRejectedValue(new Error('Connection failed')) };

    await expect(fetchUser(db, 'any-id'))
      .rejects.toThrow('Database unavailable');
  });
});
```

## PR Templates

### New Test File PR

```markdown
## Summary

Adds test coverage for `src/feature/handler.ts` which previously had no tests.

## Coverage Added

| Function | Test Cases | Coverage |
|----------|------------|----------|
| `processInput` | 5 | Happy path, validation, errors |
| `formatOutput` | 3 | Basic, edge cases |
| `handleError` | 2 | Known errors, unknown errors |

## Test Strategy

- Unit tests for pure functions
- Mocked dependencies for service methods
- Focused on critical business logic

## How to Run

```bash
npm test -- tests/unit/feature/handler.test.ts
```

## Notes

- Used existing mock utilities from `tests/mocks/`
- Followed patterns from similar test files
- Prioritized error handling coverage
```

### Additional Coverage PR

```markdown
## Summary

Adds missing test cases to existing test files for better edge case coverage.

## Changes

### `tests/api/users.test.ts`
- Added: `should handle concurrent updates`
- Added: `should validate email format`
- Added: `should reject duplicate usernames`

### `tests/utils/parser.test.ts`
- Added: `should handle malformed JSON`
- Added: `should handle empty input`

## Why These Tests?

These cases were identified as gaps in the current test suite:
- No concurrent operation testing
- Input validation edge cases missing
- Error paths not covered
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Map coverage** - Find source files without test files
2. **Identify complexity** - Prioritize complex functions
3. **Check recency** - Recently changed code is priority
4. **Understand context** - Read related tests for patterns

### Test Writing Guidelines

1. **Follow conventions** - Match existing test style exactly
2. **Use project utilities** - Leverage shared mocks and helpers
3. **Be descriptive** - Clear test names explain behavior
4. **Cover boundaries** - Empty, null, max values
5. **Test errors** - Every throw should have a test

### Quality Standards

1. **Meaningful assertions** - Not just "doesn't throw"
2. **Isolated tests** - No test depends on another
3. **Deterministic** - Same result every run
4. **Fast** - No unnecessary async waits
5. **Maintainable** - Easy to understand and update

### Key Behaviors

- **Study patterns** first - read 3+ existing test files
- **Don't over-mock** - test real behavior when possible
- **Focus on behavior** - not implementation details
- **Prioritize value** - critical paths over trivial code

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| Schedule | Cron (Wednesday 6am UTC) |
| Human | workflow_dispatch |

### Coordination Notes

- Reviews PRs from [Issue Implementer](./issue-implementer.md) for test gaps
- Works mid-week when codebase is stable
- Created tests reviewed by [PR Reviewer](./pr-reviewer.md)

## Example Scenarios

### Scenario 1: Untested Utility File

**Detection:**
- `src/utils/format.ts` exists
- No `tests/utils/format.test.ts` found

**Action:**
1. Read `format.ts` to understand functions
2. Check existing test patterns
3. Generate comprehensive test file
4. Create PR with new test file

### Scenario 2: Missing Edge Cases

**Detection:**
- `tests/api/orders.test.ts` exists
- Tests only happy path
- No error handling tests

**Action:**
1. Identify untested error paths
2. Add error handling test cases
3. Add boundary condition tests
4. Create PR adding cases to existing file

### Scenario 3: Recently Changed Code

**Context:**
- PR merged adding `processPayment` function
- No tests included in that PR

**Action:**
1. Identify new function as priority
2. Generate targeted tests
3. Include in next coverage PR

## Frontmatter Reference

```yaml
---
name: Test Coverage Agent
on:
  schedule:
    - cron: '0 6 * * 3'  # Wednesday 6am UTC
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
outputs:
  create-pr: { max: 3 }
  add-label: true
allowed-paths:
  - "tests/**"
  - "test/**"
  - "src/**/*.test.ts"
  - "src/**/*.spec.ts"
  - "**/__tests__/**"
context:
  commits:
    branches: [main]
    limit: 50
  pull_requests:
    states: [merged]
    limit: 20
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

### Test Framework

Adjust instructions for your framework:
- Jest
- Vitest
- Mocha
- Bun test

### Coverage Targets

Set minimum coverage thresholds to target.

### Exclusion Patterns

Skip generated code, migrations, etc.

## Metrics to Track

- Coverage percentage over time
- Tests added per run
- Test pass rate of generated tests
- Time to review test PRs
- Coverage gaps identified vs fixed
