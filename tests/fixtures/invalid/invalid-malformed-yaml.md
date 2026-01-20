---
name: Malformed YAML Agent
on:
  issues:
    types: [opened]
    invalid_indentation
  pull_request:
permissions:
  issues: write
  contents: read
outputs: {add-comment: true
---

This agent has malformed YAML frontmatter with incorrect indentation and unclosed braces.
