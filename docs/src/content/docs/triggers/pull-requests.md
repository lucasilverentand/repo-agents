---
title: Pull Request Events
description: Respond to pull request activity
---

Trigger your agent when pull requests are created, updated, reviewed, or otherwise modified.

## Basic Configuration

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

## Available Event Types

- **`opened`** - Pull request is created
- **`edited`** - Pull request title or body is modified
- **`closed`** - Pull request is closed (merged or without merging)
- **`reopened`** - Pull request is reopened
- **`synchronize`** - Pull request commits are updated (new commits pushed)
- **`assigned`** - Pull request is assigned to someone
- **`unassigned`** - Pull request is unassigned
- **`labeled`** - Label is added to pull request
- **`unlabeled`** - Label is removed from pull request
- **`locked`** - Pull request conversation is locked
- **`unlocked`** - Pull request conversation is unlocked
- **`ready_for_review`** - Pull request is marked as ready for review (from draft)
- **`review_requested`** - Review is requested from user or team
- **`review_request_removed`** - Review request is removed
- **`converted_to_draft`** - Pull request is converted to draft

## Common Use Cases

### Code Review

Analyze changes and provide feedback:

```yaml
---
name: PR Initial Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

When a PR is opened or updated:
1. Analyze the changes using `gh pr diff`
2. Check for:
   - Missing tests
   - Breaking changes
   - Security concerns
   - Documentation needs
3. Provide constructive feedback
4. Add appropriate labels
```

### PR Checklist Validation

Verify requirements before merge:

```yaml
---
name: PR Checklist
on:
  pull_request:
    types: [opened, ready_for_review, synchronize]
permissions:
  pull_requests: write
---

Verify the PR:
1. Has tests for new functionality
2. Updates documentation if needed
3. Follows code style guidelines
4. Has a clear description
5. Add 'ready-for-review' or 'needs-work' label
```

### Auto-Labeling

Tag PRs based on changed files:

```yaml
---
name: PR Auto-Label
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

Label PRs based on changed files:
- 'frontend' if src/components/ modified
- 'backend' if src/api/ modified
- 'docs' if docs/ modified
- 'tests' if test files modified
```

### Size Labeling

Label PRs by size:

```yaml
---
name: PR Size Labeler
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

Check PR size and add labels:
- 'size/XS' - < 10 lines changed
- 'size/S' - < 100 lines
- 'size/M' - < 500 lines
- 'size/L' - < 1000 lines
- 'size/XL' - >= 1000 lines
```

## Multiple Event Types

Listen to multiple events:

```yaml
on:
  pull_request:
    types: [opened, synchronize, ready_for_review]
```

## Available Data

When your agent runs, it has access to:

- **PR number** - via `${{ github.event.pull_request.number }}`
- **PR title** - via `${{ github.event.pull_request.title }}`
- **PR body** - via `${{ github.event.pull_request.body }}`
- **PR author** - via `${{ github.event.pull_request.user.login }}`
- **Base branch** - via `${{ github.event.pull_request.base.ref }}`
- **Head branch** - via `${{ github.event.pull_request.head.ref }}`
- **PR state** - via `${{ github.event.pull_request.state }}`
- **Draft status** - via `${{ github.event.pull_request.draft }}`

Access PR details using the `gh` CLI:

```bash
# Get PR details
gh pr view ${{ github.event.pull_request.number }}

# Get PR diff
gh pr diff ${{ github.event.pull_request.number }}

# List changed files
gh pr view ${{ github.event.pull_request.number }} --json files -q '.files[].path'
```

## Required Permissions

For read-only operations:

```yaml
permissions:
  pull_requests: read
```

For operations that modify PRs:

```yaml
permissions:
  pull_requests: write
```

If your agent needs to read code:

```yaml
permissions:
  pull_requests: write
  contents: read
```

See [Permissions](../../guide/permissions/) for details.

## Rate Limiting

PRs can be updated frequently during development. Use rate limiting:

```yaml
on:
  pull_request:
    types: [synchronize]
rate_limit_minutes: 5  # Max once per 5 minutes
```

## Best Practices

### Handle Both `opened` and `synchronize`

For review agents, respond to both new PRs and updates:

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

### Use `ready_for_review` for Expensive Operations

If your agent performs expensive analysis, wait until the PR is ready:

```yaml
on:
  pull_request:
    types: [ready_for_review]
```

### Be Constructive

When providing feedback:
- Focus on significant issues, not nitpicks
- Explain *why* something is a concern
- Acknowledge what's done well
- Remember you're here to help, not block

### Handle Drafts Appropriately

Consider skipping review for draft PRs:

```yaml
on:
  pull_request:
    types: [opened, ready_for_review, synchronize]
```

This triggers on new PRs, when marked ready, and on updates.

## Examples

### Breaking Change Detector

```yaml
---
name: Breaking Change Detector
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

Analyze the PR for breaking changes:
1. Check if public APIs are modified
2. Look for removed functions or changed signatures
3. If breaking changes found:
   - Add 'breaking-change' label
   - Comment with details
   - Suggest migration path
```

### Test Coverage Check

```yaml
---
name: Test Coverage Guardian
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

Verify test coverage:
1. Check if new files added in src/
2. Verify corresponding test files exist
3. If missing tests:
   - Add 'needs-tests' label
   - Comment requesting tests
```

### Documentation Enforcer

```yaml
---
name: Documentation Check
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
---

Check for documentation:
1. If new public functions added, verify JSDoc comments
2. If features added, check for README updates
3. Add 'needs-docs' label if documentation missing
```

## Distinguishing Events

### New PR vs Updates

Use the event type:

```yaml
# Only new PRs
on:
  pull_request:
    types: [opened]

# Only updates (new commits)
on:
  pull_request:
    types: [synchronize]
```

### Draft vs Ready

Check the draft status in your agent logic:

```bash
# Check if PR is draft
gh pr view $PR_NUMBER --json isDraft -q '.isDraft'
```

## Next Steps

- Learn about [Issue triggers](issues/)
- Understand [Permissions](../../guide/permissions/)
- See [PR Review example](../../examples/pr-review/)
