---
name: Audited Agent
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [opened, synchronize]
permissions:
  issues: write
  pull_requests: write
  contents: read
outputs:
  add-comment: true
  add-label: true
  create-issue: true
audit:
  create_issues: true
  labels:
    - agent-failure
    - needs-attention
  assignees:
    - repo-admin
    - devops-team
---

# Audited Agent

This agent demonstrates audit configuration for failure tracking and reporting.

## Audit Configuration

- **Create Issues on Failure**: Yes
- **Failure Labels**: `agent-failure`, `needs-attention`
- **Assignees**: `repo-admin`, `devops-team`

## Purpose

The audit configuration enables automatic issue creation when the agent encounters failures:
- Failed execution is automatically reported
- Issues are created with specified labels for easy filtering
- Team members are automatically assigned for quick response
- Provides visibility into agent reliability and issues

## Instructions

This agent performs standard triage operations:
1. Analyze new issues and pull requests
2. Add appropriate labels based on content
3. Post helpful comments with context or next steps

If the agent fails during execution (e.g., API errors, validation failures, unexpected conditions):
- A new issue is automatically created
- The issue includes execution logs and error details
- Specified labels are applied for filtering
- Assignees are notified to investigate and resolve

This ensures no failures go unnoticed and enables continuous improvement of agent reliability.
