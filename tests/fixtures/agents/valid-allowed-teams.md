---
name: Team-Based Agent
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
  contents: read
outputs:
  add-comment: true
  add-label: true
  request-review: true
allowed-teams:
  - maintainers
  - core-team
  - security-team
---

# Team-Based Agent

This agent uses team-based authorization with the `allowed-teams` configuration.

## Purpose

Only members of the specified GitHub teams can trigger this agent. This enables:
- Organization-level access control
- Team-specific automation workflows
- Scalable permission management

## Instructions

When triggered by a team member:
1. Review the pull request changes
2. Check for code quality and best practices
3. Add appropriate labels (e.g., "needs-review", "ready-to-merge")
4. Request reviews from relevant team members if needed
5. Post a comment with initial feedback
