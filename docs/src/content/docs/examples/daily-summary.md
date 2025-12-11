---
title: Daily Summary Agent
description: Generate daily activity summaries
---

This example shows how to create an agent that runs on a schedule and generates summary reports of repository activity.

## Agent Definition

Create `.github/claude-agents/daily-summary.md`:

```markdown
---
name: Daily Summary
on:
  schedule:
    - cron: '0 17 * * *'  # 5pm UTC daily
permissions:
  issues: write
outputs:
  create-issue: { max: 1 }
claude:
  model: claude-3-5-sonnet-20241022
---

# Daily Summary Agent

Create a daily summary issue with repository activity from the past 24 hours.

## Summary Contents

### Issues
- Issues opened today (with links)
- Issues closed today
- Most discussed issues

### Pull Requests
- PRs opened today
- PRs merged today
- PRs pending review

### Discussions
- New discussions
- Active discussions

### Notable Events
- New contributors
- Milestones reached
- Important comments or decisions

## Issue Format

**Title**: "Daily Summary - [Date]"

**Labels**: `summary`, `automated`

**Body**:

```markdown
# Daily Summary for [Date]

## 📊 Overview
- X issues opened, Y closed
- X PRs opened, Y merged
- X new discussions

## 🐛 Issues
### Opened Today
- #123 Bug in login flow (@username)
- #124 Feature request: dark mode (@username)

### Closed Today
- #120 Fixed navigation bug (@username)

## 🔀 Pull Requests
### Merged Today
- #45 Add user authentication (@username)
- #46 Update documentation (@username)

### Opened Today
- #47 Fix mobile layout (@username)

## 💬 Discussions
### Active Discussions
- Discussion #12: API design decisions (5 comments)

## ⭐ Highlights
- Welcome to @newcontributor, their first contribution!
- Reached 100 stars!

---
*This is an automated summary. [View workflow](link)*
```

## Tone

- Professional but friendly
- Highlight positive contributions
- Make it easy to scan with emojis and formatting
```

## Deploy

```bash
gh claude compile daily-summary.md
git add .github/
git commit -m "Add daily summary agent"
git push
```

## Customization Ideas

### Weekly Instead of Daily

```yaml
on:
  schedule:
    - cron: '0 9 * * MON'  # 9am every Monday
```

### Different Time Zones

```yaml
on:
  schedule:
    - cron: '0 13 * * *'  # 1pm UTC = 9am EST
```

### Team-Specific Summaries

```markdown
Focus on specific teams or areas:

## Frontend Team Activity
[PRs and issues related to frontend]

## Backend Team Activity
[PRs and issues related to backend]
```

### Slack Integration

If you have a Slack webhook, include a link in the summary:

```markdown
Post a short version to Slack channel and link to the full summary issue.
```

## Related Examples

- [Issue Triage](issue-triage/)
- [PR Review](pr-review/)
