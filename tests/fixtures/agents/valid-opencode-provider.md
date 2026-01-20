---
name: OpenCode Provider Agent
provider: opencode
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]
permissions:
  issues: write
  pull_requests: write
  contents: read
outputs:
  add-comment: true
  add-label: true
---

# OpenCode Provider Agent

This agent uses the OpenCode provider instead of the default Claude Code provider.

## Provider Configuration

- **Provider**: `opencode`
- **Alternative**: `claude-code` (default)

## Purpose

The `provider` field allows you to choose which AI provider to use for agent execution:
- **claude-code**: Uses Claude Code CLI (default)
- **opencode**: Uses OpenCode CLI as an alternative

## Instructions

When an issue or pull request is opened:
1. Analyze the content using OpenCode's capabilities
2. Determine the appropriate category or type
3. Add relevant labels to help with organization
4. Post a comment with initial analysis or guidance

This agent demonstrates that repo-agents can work with different AI provider implementations while maintaining the same agent definition format.
