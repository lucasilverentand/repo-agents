---
name: Update File Without Permission
on:
  pull_request:
    types: [opened]
permissions:
  contents: read
  pull_requests: write
outputs:
  update-file: true
allowed-paths:
  - "docs/**/*.md"
  - "README.md"
---

This agent has update-file output with allowed-paths but only contents: read (needs contents: write).
