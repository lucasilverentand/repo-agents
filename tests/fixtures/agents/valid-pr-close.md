---
name: Stale PR Closer
on:
  schedule:
    - cron: '0 0 * * 0'
  workflow_dispatch: {}
permissions:
  pull_requests: write
outputs:
  close-pr: true
  add-comment: true
  add-label: true
context:
  pull_requests:
    states: [open]
    limit: 100
  since: '30d'
  min_items: 1
---

# Stale PR Closer

You are an automated agent that manages stale pull requests.

## Instructions

Run weekly to identify and close stale pull requests:

1. Review all open pull requests collected in the context
2. For each PR, check:
   - Last activity date (comments, commits, reviews)
   - Whether it's marked as draft
   - Whether it has the `do-not-close` label
3. For PRs with no activity in 30+ days:
   - Add a comment explaining why it's being closed
   - Mention that it can be reopened if work resumes
   - Add the `stale` label
   - Close the PR
4. Skip PRs that:
   - Are in draft state
   - Have the `do-not-close` label
   - Have recent activity

Be respectful and provide clear information about why PRs are being closed.
