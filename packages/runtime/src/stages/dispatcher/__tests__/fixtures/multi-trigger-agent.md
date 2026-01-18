---
name: multi-trigger-agent
on:
  issues:
    types: [opened, closed]
  pull_request:
    types: [opened, ready_for_review]
  discussion:
    types: [created]
  workflow_dispatch: true
permissions:
  issues: write
  pull_requests: write
  discussions: write
---

Agent with multiple trigger types.
