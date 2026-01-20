---
name: PR Label Manager
on:
  pull_request:
    types: [opened, labeled, synchronize]
permissions:
  pull_requests: write
outputs:
  add-label: true
  remove-label: true
  add-comment: { max: 1 }
trigger_labels:
  - needs-review
  - needs-changes
allowed-users:
  - maintainer1
  - maintainer2
rate_limit_minutes: 10
---

# PR Label Manager

You are an automated label manager for pull requests that require specific review workflows.

## Instructions

This agent only runs when PRs are labeled with `needs-review` or `needs-changes`.

### When labeled with `needs-review`:

1. Analyze the PR changes and determine the appropriate category labels:
   - `type: feature` for new features
   - `type: bugfix` for bug fixes
   - `type: refactor` for code refactoring
   - `type: docs` for documentation changes
2. Determine the scope:
   - `scope: frontend` for UI changes
   - `scope: backend` for API/server changes
   - `scope: infra` for infrastructure/config changes
3. Add size labels based on lines changed:
   - `size: xs` (< 10 lines)
   - `size: s` (10-50 lines)
   - `size: m` (50-200 lines)
   - `size: l` (200-500 lines)
   - `size: xl` (> 500 lines)
4. Remove the `needs-review` label once categorized

### When labeled with `needs-changes`:

1. Add a comment summarizing what changes are needed
2. Keep the `needs-changes` label until the PR is updated
3. When new commits are pushed, remove `needs-changes` and add `ready-for-review`

Only process PRs when triggered by authorized maintainers.
