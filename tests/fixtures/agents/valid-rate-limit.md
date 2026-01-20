---
name: Rate Limited Agent
on:
  issues:
    types: [opened, edited, labeled]
  pull_request:
    types: [opened, edited]
permissions:
  issues: write
  pull_requests: write
outputs:
  add-comment: true
  add-label: true
rate_limit_minutes: 30
---

# Rate Limited Agent

This agent demonstrates rate limiting with `rate_limit_minutes` set to 30 minutes.

## Purpose

Rate limiting prevents the agent from running too frequently, which is useful for:
- Avoiding API rate limit issues
- Preventing spam or duplicate operations
- Managing costs and resource usage
- Allowing time for human intervention between runs

## Configuration

- **Rate Limit**: 30 minutes minimum between runs
- **Default**: Without configuration, agents default to 5 minutes

## Instructions

This agent processes issues and pull requests with a controlled frequency:
1. Analyze the content of the issue or pull request
2. Add relevant labels based on content analysis
3. Post a helpful comment with suggestions or guidance

The agent will automatically skip execution if it ran within the last 30 minutes, ensuring reasonable spacing between operations.
