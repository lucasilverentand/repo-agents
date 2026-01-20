---
name: Complex Agent
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened]
  schedule:
    - cron: '0 9 * * *'
permissions:
  issues: write
  pull_requests: write
  contents: read
outputs:
  add-comment: { max: 3 }
  add-label: true
  create-issue: true
allowed-actors:
  - user1
  - user2
---

# Complex Agent

This agent has many features configured.

## Instructions

Do complex things.
