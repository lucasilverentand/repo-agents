---
name: No Triggers Agent
on: {}
permissions:
  issues: write
outputs:
  add-comment: true
---

This agent has an empty triggers object, which should fail validation since at least one trigger is required.
