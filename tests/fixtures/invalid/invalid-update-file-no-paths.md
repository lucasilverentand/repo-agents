---
name: Update File Without Paths
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
---

This agent has update-file output but no allowed-paths configured, which should fail validation.
