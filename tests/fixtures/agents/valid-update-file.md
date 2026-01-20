---
name: Update File Agent
on:
  issues:
    types: [opened, labeled]
permissions:
  contents: write
  issues: write
outputs:
  update-file: true
  add-comment: true
allowed-paths:
  - "docs/**/*.md"
  - "README.md"
  - "src/config/*.json"
---

# Documentation Update Agent

This agent automatically updates documentation files based on issue reports.

## Instructions

When an issue is opened requesting documentation updates:

1. Review the requested changes in the issue body
2. Update the relevant documentation files in the `docs/` directory
3. Update README.md if necessary
4. Update configuration files in `src/config/` if settings need to be documented
5. Add a comment to the issue confirming the updates made

Only modify files that match the allowed paths pattern.
