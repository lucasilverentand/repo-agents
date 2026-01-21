---
name: Performance Test Agent {index}
on:
  issues:
    types: [opened, labeled]
permissions:
  issues: write
  contents: read
outputs:
  add-comment: true
  add-label: true
---

# Performance Test Agent {index}

This is a test agent used for performance benchmarking.

## Purpose

Test agent for performance regression testing.

## Instructions

When triggered:
1. Analyze the issue content
2. Add appropriate labels
3. Post a comment
