---
name: ""
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
---

This agent has an empty name string, which should fail validation.
