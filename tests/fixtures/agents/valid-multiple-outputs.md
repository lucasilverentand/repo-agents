---
name: Multi-Output Agent
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]
  schedule:
    - cron: '0 12 * * 1'
permissions:
  contents: write
  issues: write
  pull_requests: write
outputs:
  add-comment: { max: 5 }
  add-label: true
  remove-label: true
  create-issue: { max: 3 }
  update-file: true
  create-pr: { sign: true }
  close-issue: true
allowed-paths:
  - ".github/**/*.md"
  - "docs/**/*"
  - "scripts/*.sh"
  - "CHANGELOG.md"
allowed-actors:
  - admin
  - write
rate_limit_minutes: 10
---

# Multi-Purpose Maintenance Agent

This agent handles various repository maintenance tasks including documentation updates, issue triage, and automated fixes.

## Instructions

### For Issues

When an issue is opened or edited:

1. Analyze the issue content for:
   - Documentation gaps → update docs in `.github/` or `docs/`
   - Missing labels → add appropriate labels
   - Duplicate issues → add comment and close with reference
   - Related issues → create linking issues if needed

2. Add labels based on issue type:
   - `bug` for bug reports
   - `documentation` for docs requests
   - `enhancement` for feature requests
   - `duplicate` for duplicates

3. Add a comment summarizing the triage action taken

### For Pull Requests

When a PR is opened or updated:

1. Check if documentation needs updates
2. Update CHANGELOG.md with the changes
3. Add labels based on PR content
4. Add a comment with review notes

### For Scheduled Runs (Weekly)

Every Monday at noon:

1. Review all open issues
2. Update stale documentation in `docs/`
3. Create issues for maintenance tasks
4. Update `.github/` documentation
5. Generate summary comment on a tracking issue

## Output Usage

- **add-comment**: Provide feedback and summaries (max 5 per run)
- **add-label/remove-label**: Categorize issues and PRs
- **create-issue**: Create tracking or follow-up issues (max 3 per run)
- **update-file**: Update documentation and changelog files
- **create-pr**: Create PRs for batch documentation updates (signed commits)
- **close-issue**: Close duplicate or resolved issues

## Constraints

- Only users with admin or write access can trigger this agent
- Minimum 10 minutes between runs to avoid spam
- Only modify files in allowed paths
- Keep comments concise and actionable
