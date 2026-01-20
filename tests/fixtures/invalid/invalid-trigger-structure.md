---
name: Invalid Trigger Structure
on:
  issues: "opened"
  pull_request:
    type: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
---

This agent has invalid trigger structure:
1. issues should be an object with types array, not a string
2. pull_request has 'type' instead of 'types'
