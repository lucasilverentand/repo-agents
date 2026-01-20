---
name: Create PR Without Permission
on:
  issues:
    types: [opened]
permissions:
  contents: read
  issues: write
outputs:
  create-pr: true
allowed-paths:
  - "*.md"
---

This agent has create-pr output but only contents: read (needs contents: write).
