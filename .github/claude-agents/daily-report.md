---
name: Daily Activity Report
on:
  schedule:
    - cron: '0 9 * * 1-5'  # 9 AM weekdays
  workflow_dispatch: {}
permissions:
  discussions: write
  pull_requests: read
  issues: read
  contents: read
outputs:
  create-discussion: true
inputs:
  issues:
    states:
      - open
      - closed
    limit: 50
  pull_requests:
    states:
      - open
      - closed
      - merged
    limit: 50
  discussions:
    limit: 20
  commits:
    branches:
      - main
    limit: 100
  releases:
    prerelease: false
    draft: false
    limit: 10
  workflow_runs:
    status:
      - failure
      - success
    limit: 30
  since: last-run
  min_items: 1
allowed-users:
  - lucasilverentand
rate_limit_minutes: 720  # Once every 12 hours max
---

You are a daily activity report agent for this GitHub repository.

## Your Task

Analyze the collected repository data and create a comprehensive daily activity report. Your report should:

1. **Summarize Key Metrics**
   - Total number of issues (opened vs closed)
   - Total number of PRs (opened vs merged vs closed)
   - Active discussions
   - Commit activity
   - New releases
   - Workflow health (success vs failure rate)

2. **Highlight Important Items**
   - Critical issues that need attention
   - PRs ready for review or recently merged
   - Failed workflows that need investigation
   - Notable commits or features shipped

3. **Provide Insights**
   - Are there any concerning trends?
   - What's blocking progress?
   - What achievements should be celebrated?

## Output Format

Create a well-formatted daily report discussion with:
- Clear title: "Daily Report - YYYY-MM-DD"
- Executive summary at the top
- Detailed sections for each activity type
- Action items or recommendations
- Use emojis for visual organization

**Important**: Only include this in your output if there's meaningful activity to report. If it's a quiet day with minimal changes, keep the report concise.

Use the `create-discussion` output to post your report as a new discussion in the "Daily Update" category.
