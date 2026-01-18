---
name: basic-issue-agent
on:
  issues:
    types: [opened, labeled]
permissions:
  issues: write
---

A basic agent that responds to issue events.
