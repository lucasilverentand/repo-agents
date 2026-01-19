# PR Fixer Agent

Automatically addresses review feedback by implementing requested changes and pushing fixes.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | `fix-requested` or `auto-fix` label added |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `contents: write`, `pull_requests: write` |
| **Rate Limit** | 5 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The PR Fixer accelerates the review cycle by automatically implementing review feedback. It:

- **Reads** all review comments on the PR
- **Understands** each requested change
- **Implements** fixes following the suggestions
- **Commits** changes to the PR branch
- **Reports** what was fixed

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [labeled]
trigger_labels: [fix-requested, auto-fix]
```

Only triggers when a human explicitly requests automated fixing.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `update-file` | unlimited | Apply fixes to files |
| `add-comment` | 2 | Summarize fixes applied |
| `add-label` | unlimited | Update status |
| `remove-label` | unlimited | Clear trigger label |

## Allowed Paths

```yaml
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "test/**"
  - "docs/**"
```

Cannot modify configuration files, workflows, or lock files.

## Labels Used

### Labels Set by This Agent

| Label | When Applied |
|-------|--------------|
| `fixes-applied` | After successfully applying fixes |

### Labels Removed by This Agent

| Label | When Removed |
|-------|--------------|
| `fix-requested` | After processing |
| `auto-fix` | After processing |

### Labels That Trigger This Agent

| Label | Effect |
|-------|--------|
| `fix-requested` | Standard fix mode |
| `auto-fix` | Alternative trigger |

## Fix Process

```
┌─────────────────────────────────────┐
│   fix-requested label added         │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Gather Review Context           │
│  - Read all review comments         │
│  - Read code suggestions            │
│  - Understand the current diff      │
│  - Check conversation threads       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Analyze Requested Changes       │
│  - Identify actionable feedback     │
│  - Filter out questions/discussions │
│  - Prioritize by severity           │
│  - Group by file                    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Implement Fixes                 │
│  - Apply code suggestions directly  │
│  - Implement described changes      │
│  - Update tests if needed           │
│  - Ensure changes don't conflict    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Commit Changes                  │
│  - Create focused commit message    │
│  - Reference the review comments    │
│  - Push to PR branch                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Update PR Status                │
│  - Remove fix-requested label       │
│  - Add fixes-applied label          │
│  - Comment summarizing changes      │
│  - Re-request review if applicable  │
└─────────────────────────────────────┘
```

## What Gets Fixed

### Automatically Fixed

| Category | Examples |
|----------|----------|
| **Direct Suggestions** | Code blocks in review comments with suggestions |
| **Simple Changes** | "Rename X to Y", "Add missing import", "Remove unused variable" |
| **Style Fixes** | Formatting, naming conventions, comment updates |
| **Error Handling** | "Add try-catch", "Handle null case" |
| **Documentation** | "Add JSDoc", "Update comment" |

### Requires Human Decision

| Category | Action |
|----------|--------|
| **Architectural Questions** | Note as needing human input |
| **Design Decisions** | Skip, explain in summary |
| **Unclear Feedback** | Ask for clarification |
| **Conflicting Feedback** | Defer to human |
| **Breaking Changes** | Implement only if explicitly approved |

## Comment Templates

### Fix Summary

```markdown
## Fixes Applied ✅

I've addressed the review feedback with the following changes:

### Changes Made

1. **src/api/users.ts**
   - Line 23: Parameterized SQL query to prevent injection
   - Line 45: Added input validation for email format

2. **tests/api/users.test.ts**
   - Added test case for invalid email handling

### Not Addressed

The following items require human input:

- **Architectural question** about whether to split the User class
- **Clarification needed** on the expected behavior for edge case X

---

Please review the changes. The `fixes-applied` label has been added.
```

### Partial Fix

```markdown
## Fixes Partially Applied ⚠️

I was able to address some of the review feedback:

### Applied
- [Change 1]
- [Change 2]

### Unable to Apply
- **[Item]**: [Reason - e.g., "Conflicting with another suggestion"]
- **[Item]**: [Reason - e.g., "Requires breaking change"]

Please review what was applied and provide guidance on the remaining items.
```

### Cannot Fix

```markdown
## Unable to Apply Fixes ❌

After analyzing the review comments, I wasn't able to automatically apply fixes:

- **[Reason 1]**: [Explanation]
- **[Reason 2]**: [Explanation]

This may require manual intervention. Please review the feedback and apply
changes directly, or provide more specific guidance.
```

## Agent Instructions

The full instructions for Claude should cover:

### Understanding Feedback

1. **Read all comments** in their full context
2. **Identify suggestions** vs discussions vs questions
3. **Understand intent** not just literal words
4. **Check thread resolution** status

### Implementing Fixes

1. **Apply exact suggestions** when provided as code
2. **Interpret descriptions** accurately
3. **Maintain consistency** with surrounding code
4. **Update related code** (tests, docs)
5. **Avoid over-fixing** - only what was requested

### Commit Best Practices

1. **Clear commit message** describing the fix
2. **Reference review comments** when applicable
3. **One logical change** per commit when possible
4. **Sign commits** if GitHub App is configured

### Key Behaviors

- **Be conservative** - when in doubt, don't change
- **Be complete** - fix all instances of a pattern
- **Be transparent** - explain what wasn't fixed and why
- **Be precise** - apply exactly what was requested
- **Test mentally** - ensure fix doesn't break other things

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Pushes commits | [PR Reviewer](./pr-reviewer.md) re-review |

### Triggered By

| Source | Via |
|--------|-----|
| Human | `fix-requested` or `auto-fix` label |

### Coordination Notes

- Works in tandem with [PR Reviewer](./pr-reviewer.md)
- May trigger another review cycle
- Human has final control via labels

## Example Scenarios

### Scenario 1: Code Suggestions

**Review Comment:**
````markdown
```suggestion
const query = 'SELECT * FROM users WHERE id = ?';
await db.query(query, [userId]);
```
This prevents SQL injection.
````

**Agent Action:**
1. Finds the exact lines in the diff
2. Applies the suggested change
3. Commits: "fix: parameterize SQL query to prevent injection"

### Scenario 2: Descriptive Feedback

**Review Comment:**
```
The error message isn't helpful. Please include the actual validation error.
```

**Agent Action:**
1. Identifies the error handling code
2. Modifies to include validation details:
   ```javascript
   throw new Error(`Validation failed: ${error.message}`);
   ```
3. Commits: "fix: include validation details in error message"

### Scenario 3: Multiple Files

**Review Comments:**
```
1. Missing import for ValidationError
2. Add test for the error case
3. Update JSDoc to document the error
```

**Agent Action:**
1. Adds import to source file
2. Adds test case to test file
3. Updates JSDoc comment
4. Commits: "fix: add missing import, test case, and documentation"

### Scenario 4: Unclear Feedback

**Review Comment:**
```
This doesn't feel right. Maybe we should restructure?
```

**Agent Action:**
1. Notes this requires human decision
2. Comments: "This feedback requires architectural discussion - skipping automated fix"

## Frontmatter Reference

```yaml
---
name: PR Fixer
on:
  pull_request:
    types: [labeled]
trigger_labels: [fix-requested, auto-fix]
permissions:
  contents: write
  pull_requests: write
outputs:
  update-file: true
  add-comment: { max: 2 }
  add-label: true
  remove-label: true
allowed-paths:
  - "src/**"
  - "lib/**"
  - "tests/**"
  - "test/**"
  - "docs/**"
rate_limit_minutes: 5
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.4
---
```

## Customization Options

### Expand Fix Scope

Allow fixing more file types:
```yaml
allowed-paths:
  - "*.json"
  - "config/**"
```

### Auto-Request Review

Configure to automatically re-request review after fixes.

### Fix Aggressiveness

- **Conservative**: Only explicit suggestions
- **Standard**: Suggestions + clear descriptions (default)
- **Aggressive**: Attempt to fix all feedback

## Safety Considerations

### Cannot Modify

- Workflow files (`.github/workflows/`)
- Lock files
- Environment files
- Files outside allowed-paths

### Human Control

- Requires explicit label to trigger
- Label can be removed to abort
- All changes are in the existing PR (reversible)

## Metrics to Track

- Fix success rate
- Average fixes per PR
- Items requiring human intervention
- Time saved vs manual fixes
- Re-review success rate
