# PR Reviewer Agent

Automatically reviews pull requests for code quality, security vulnerabilities, test coverage, and best practices.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR opened, synchronized, or marked ready |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `pull_requests: write` |
| **Rate Limit** | 3 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The PR Reviewer provides fast, consistent first-pass reviews on all pull requests. It:

- **Catches** common issues before human reviewers spend time
- **Educates** contributors about project standards
- **Accelerates** the review cycle with immediate feedback
- **Documents** review criteria consistently

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
```

Reviews on:
- **opened**: First review when PR is created
- **synchronize**: Re-review when new commits are pushed
- **ready_for_review**: Review when draft is marked ready

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 2 | Provide review feedback |
| `add-label` | unlimited | Categorize review result |
| `request-review` | 1 | Request human review when needed |

## Labels Used

### Labels Set by This Agent

#### Review Status Labels

| Label | Description | Criteria |
|-------|-------------|----------|
| `review:approved` | No significant issues found | Passes all checks |
| `review:changes-requested` | Issues that should be addressed | Has blocking issues |

#### Additional Review Labels

| Label | Description | When Applied |
|-------|-------------|--------------|
| `needs-tests` | Missing test coverage | New code without tests |
| `needs-docs` | Documentation updates needed | API changes without docs |
| `security-concern` | Security issues found | Vulnerabilities detected |
| `breaking-change` | Contains breaking changes | API/behavior changes |

## Review Criteria

### 1. Code Quality

The agent checks for:

- **Complexity**: Overly complex functions, deep nesting
- **Readability**: Clear naming, appropriate comments
- **Maintainability**: Single responsibility, loose coupling
- **Duplication**: Copy-pasted code that should be abstracted
- **Error Handling**: Proper error handling and edge cases
- **Type Safety**: Correct typing (for typed languages)

### 2. Security

The agent scans for:

- **Injection Vulnerabilities**: SQL, command, XSS injection
- **Authentication Issues**: Hardcoded credentials, weak auth
- **Data Exposure**: Sensitive data in logs, responses
- **Dependency Risks**: Known vulnerable patterns
- **Input Validation**: Missing or insufficient validation
- **OWASP Top 10**: Common security anti-patterns

### 3. Testing

The agent evaluates:

- **Coverage**: New code has corresponding tests
- **Quality**: Tests are meaningful, not just for coverage
- **Edge Cases**: Error conditions and boundaries tested
- **Isolation**: Tests don't have external dependencies

### 4. Documentation

The agent checks:

- **Code Comments**: Complex logic is explained
- **API Documentation**: Public APIs are documented
- **README Updates**: New features documented
- **Changelog**: Breaking changes noted

### 5. Best Practices

The agent verifies:

- **Conventions**: Follows project style guide
- **Performance**: No obvious performance issues
- **Compatibility**: Backward compatibility maintained
- **Dependencies**: New deps are justified

## Review Process

```
┌─────────────────────────────────────┐
│   PR opened/updated                 │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Gather Context                  │
│  - Read PR description              │
│  - Get list of changed files        │
│  - Read file diffs                  │
│  - Check linked issues              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Analyze Changes                 │
│  - Review each changed file         │
│  - Check for security issues        │
│  - Evaluate code quality            │
│  - Assess test coverage             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Categorize Findings             │
│  - Critical: Must fix               │
│  - Suggestion: Should consider      │
│  - Nitpick: Minor improvements      │
│  - Praise: Good practices           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Generate Review                 │
│  - Write structured feedback        │
│  - Reference specific lines         │
│  - Explain the "why"                │
│  - Suggest improvements             │
└─────────────────────────────────────┘
                   │
          ┌───────┴───────┐
          │               │
          ▼               ▼
   Has critical      No blocking
     issues?          issues?
          │               │
          ▼               ▼
   ┌──────────────┐  ┌──────────────┐
   │ Add label:   │  │ Add label:   │
   │ review:      │  │ review:      │
   │ changes-     │  │ approved     │
   │ requested    │  └──────────────┘
   └──────────────┘
```

## Review Comment Format

### Structure

```markdown
## Review Summary

[Overall assessment of the PR]

### ✅ What's Good
- [Positive observation 1]
- [Positive observation 2]

### 🔴 Critical Issues
[Must be addressed before merge]

**[File:Line] Issue Title**
```suggestion
[Suggested fix if applicable]
```
[Explanation of why this is important]

### 🟡 Suggestions
[Should consider but not blocking]

**[File:Line] Suggestion Title**
[Explanation and recommendation]

### 💭 Nitpicks
[Minor improvements, optional]

- [Nitpick 1]
- [Nitpick 2]

---

**Labels added:** `needs-tests`

[If applicable: Human review requested for [reason]]
```

### Severity Levels

| Severity | Icon | Description | Blocks Merge |
|----------|------|-------------|--------------|
| Critical | 🔴 | Security, bugs, breaking | Yes |
| Suggestion | 🟡 | Improvements, best practices | No |
| Nitpick | 💭 | Style, minor optimizations | No |
| Praise | ✅ | Good patterns, nice work | No |

## Agent Instructions

The full instructions for Claude should cover:

### Review Philosophy

1. **Be constructive**: Explain why, not just what
2. **Be specific**: Reference exact lines and code
3. **Be balanced**: Acknowledge good work too
4. **Be educational**: Help contributors learn
5. **Be efficient**: Focus on what matters most

### Critical Issue Examples

- Security vulnerabilities (always critical)
- Logic errors that would cause bugs
- Missing error handling for failures
- Breaking changes without documentation
- Removing required functionality

### Suggestion Examples

- Performance optimizations
- Better error messages
- Additional test cases
- Code organization improvements
- Documentation enhancements

### Nitpick Examples

- Naming conventions
- Code formatting
- Comment grammar
- Import ordering
- Whitespace

### Key Behaviors

- **Never block on nitpicks** alone
- **Always explain** the reasoning
- **Provide solutions** not just problems
- **Recognize context** (hotfix vs feature)
- **Request human review** for complex cases

## Inter-Agent Relationships

### Triggers Other Agents

| Label | Triggers |
|-------|----------|
| `review:changes-requested` | [PR Fixer](./pr-fixer.md) (with human label) |

### Triggered By

| Agent | Via |
|-------|-----|
| [Issue Implementer](./issue-implementer.md) | PR creation |
| [Code Quality Agent](./code-quality.md) | PR creation |
| [Test Coverage Agent](./test-coverage.md) | PR creation |
| All improvement agents | PR creation |

### Coordination Notes

- Reviews all PRs including those from other agents
- Works with [PR Fixer](./pr-fixer.md) to address feedback
- May request human review for sensitive changes

## Example Scenarios

### Scenario 1: Clean PR

**PR Changes:**
- Well-structured feature implementation
- Comprehensive tests
- Clear documentation

**Review Response:**
```markdown
## Review Summary

Excellent implementation of the CSV export feature. The code is clean,
well-tested, and follows project conventions.

### ✅ What's Good
- Clean separation of concerns between CSV generation and API layer
- Comprehensive test coverage including edge cases
- Good error handling for malformed data

### 💭 Nitpicks
- Line 45: Consider extracting the date format string to a constant

---

**Labels added:** `review:approved`
```

### Scenario 2: Security Issue

**PR Changes:**
- Database query with string concatenation
- Missing input validation

**Review Response:**
```markdown
## Review Summary

This PR has a critical security vulnerability that must be addressed.

### 🔴 Critical Issues

**src/api/users.ts:23** SQL Injection Vulnerability
```typescript
// Current (vulnerable)
const query = `SELECT * FROM users WHERE name = '${name}'`;

// Suggested (safe)
const query = 'SELECT * FROM users WHERE name = ?';
await db.query(query, [name]);
```
User input is directly concatenated into SQL query, allowing SQL injection attacks.

**src/api/users.ts:20** Missing Input Validation
The `name` parameter should be validated before use.

---

**Labels added:** `review:changes-requested`, `security-concern`

Human review requested for security-sensitive changes.
```

### Scenario 3: Missing Tests

**PR Changes:**
- New feature implementation
- No test files modified

**Review Response:**
```markdown
## Review Summary

The implementation looks good but lacks test coverage.

### ✅ What's Good
- Clean implementation following existing patterns
- Good error handling

### 🟡 Suggestions

**Missing Tests**
This PR adds new functionality but doesn't include tests. Please add:
- Unit tests for the new `exportData()` function
- Integration test for the export API endpoint

### 💭 Nitpicks
- Consider adding JSDoc comments to the new functions

---

**Labels added:** `needs-tests`
```

## Frontmatter Reference

```yaml
---
name: PR Reviewer
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
permissions:
  pull_requests: write
outputs:
  add-comment: { max: 2 }
  add-label: true
  request-review: true
rate_limit_minutes: 3
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.4
---
```

## Customization Options

### Adjust Review Depth

- **Quick**: Focus only on critical issues
- **Standard**: Critical + suggestions (default)
- **Thorough**: Include all nitpicks

### Custom Security Rules

Add project-specific security patterns to check.

### Skip Certain Files

Configure to skip auto-generated files, dependencies, etc.

### Adjust Thresholds

Customize when to request human review vs. approve automatically.

## Metrics to Track

- PRs reviewed per time period
- Critical issues caught
- False positive rate (human overrides)
- Time from PR open to first review
- Accuracy of security findings
