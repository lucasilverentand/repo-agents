---
name: User Authorization Agent
on:
  issues:
    types: [opened, labeled]
permissions:
  issues: write
  contents: read
outputs:
  add-comment: true
  add-label: true
allowed-users:
  - octocat
  - github-user
  - trusted-contributor
---

# User Authorization Agent

This agent demonstrates user authorization with the `allowed-users` configuration.

## Purpose

Only users explicitly listed in the `allowed-users` field can trigger this agent. This is useful for:
- Restricting sensitive operations to trusted users
- Implementing manual review workflows
- Controlling access to automation features

## Instructions

When triggered:
1. Analyze the issue content and labels
2. Add appropriate labels based on issue content
3. Post a welcoming comment acknowledging the authorized user
