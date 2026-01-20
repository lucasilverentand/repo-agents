---
name: Multiple Validation Errors
on:
  issues:
    types: [opened]
permissions:
  issues: write
  contents: read
outputs:
  create-pr: true
  update-file: true
---

This agent has multiple validation errors:
1. create-pr without contents: write
2. update-file without contents: write
3. update-file without allowed-paths
