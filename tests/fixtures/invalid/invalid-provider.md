---
name: Invalid Provider
on:
  issues:
    types: [opened]
provider: "gpt-4"
permissions:
  issues: write
outputs:
  add-comment: true
---

This agent has an invalid provider value. Valid values are "claude-code" or "opencode".
