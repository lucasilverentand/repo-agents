---
title: PR Review Assistant
description: Provide initial feedback on pull requests
---

This example shows how to create an agent that automatically reviews pull requests and provides initial feedback.

## Agent Definition

Create `.github/claude-agents/pr-review.md`:

```markdown
---
name: PR Initial Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
outputs:
  add-comment: { max: 1 }
  add-label: true
claude:
  model: claude-3-5-sonnet-20241022
  temperature: 0.3
---

# Pull Request Review Agent

Analyze the pull request and provide constructive initial feedback.

## Review Tasks

1. **Summarize Changes**: Briefly describe what the PR accomplishes
2. **Check Tests**: Note if tests are missing or need improvement
3. **Breaking Changes**: Identify any potential breaking changes
4. **Code Quality**: Mention significant style or quality issues
5. **Labels**: Add appropriate labels

## Review Guidelines

- **Be constructive**: Focus on helping improve the code
- **Be specific**: Point to exact issues with suggestions
- **Be encouraging**: Acknowledge good practices
- **Be balanced**: Mention both positives and areas for improvement

## Comment Structure

Use this format:

### Summary
[1-2 sentence overview of the changes]

### Observations
- [Key points about the implementation]
- [Notable patterns or approaches]

### Suggestions
- [Specific, actionable feedback if any]
- [Link to relevant documentation when applicable]

### Testing
[Comments about test coverage]

## Labels to Consider

- `needs-tests` - Missing or insufficient tests
- `breaking-change` - Contains breaking changes
- `documentation` - Needs documentation updates
- `good-first-review` - Ready for maintainer review
- `needs-discussion` - Requires team discussion

## Example Review

For a PR adding a new API endpoint:

**Summary**
This PR adds a new `/api/users/:id` endpoint for fetching user details.

**Observations**
- Clean implementation following existing API patterns
- Proper error handling for invalid user IDs
- Good use of TypeScript types

**Suggestions**
- Consider adding rate limiting (see `src/middleware/rateLimit.ts`)
- The user response could include email verification status

**Testing**
Tests cover the happy path well. Consider adding:
- Test for non-existent user ID
- Test for malformed ID format
```

## Deploy

```bash
gh claude compile pr-review.md
git add .github/
git commit -m "Add PR review agent"
git push
```

## Customization Ideas

### Check for Specific Patterns

```markdown
Look for common issues:
- Missing error handling
- Hardcoded configuration values
- Commented-out code
- TODO/FIXME comments that should be addressed
```

### Language-Specific Checks

```markdown
For TypeScript/JavaScript PRs:
- Check for `any` types that could be more specific
- Ensure async functions handle errors
- Look for potential memory leaks

For Python PRs:
- Check for type hints
- Ensure proper exception handling
- Verify requirements.txt is updated if new deps added
```

## Related Examples

- [Issue Triage](/examples/issue-triage/)
- [Daily Summary](/examples/daily-summary/)
