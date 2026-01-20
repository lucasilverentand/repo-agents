---
name: Invalid Permissions Format
on:
  issues:
    types: [opened]
permissions:
  contents: readwrite
  issues: yes
  pull_requests: enabled
  discussions: full-access
outputs:
  add-comment: true
---

This agent has invalid permission values. Valid values are "read" or "write" only.
