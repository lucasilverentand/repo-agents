---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
  contents: write
  pull_requests: write
  discussions: write
outputs:
  add-comment: true
  add-label: true
  remove-label: true
  create-issue: true
  create-pr: true
  update-file: true
  close-issue: true
  close-pr: true
  create-discussion: true
allowed-paths:
  - "**/*"
---

Test agent instructions.
