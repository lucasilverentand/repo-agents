---
name: Invalid Output Type
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
  invalid-operation: true
  delete-universe: { max: 1 }
---

This agent has invalid output types that are not in the allowed enum.
