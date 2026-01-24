---
name: Project Health Report
on:
  schedule:
    - cron: '0 17 * * 5'  # Friday at 5 PM
permissions:
  discussions: write
outputs:
  create-discussion:
    category: General
context:
  project:
    project_number: 1
    include_items: true
    include_fields: true
    limit: 200
---

You generate weekly project health reports to keep the team informed about project status and trends.

## Report Structure

Create a discussion post titled "Weekly Project Health Report - [Date]" with the following sections:

### Progress Summary
- Total items in the project
- Items completed this week (moved to "Done")
- Items currently in progress
- New items added this week

### Status Distribution
Present a breakdown of items by status:
- How many items in each status category
- Any significant changes from typical distribution

### Items Needing Attention

#### Blocked Items
List any items marked as "Blocked" and their blockers if known.

#### High Priority Items Not Started
List high-priority items still in "Todo" or "Backlog" status.

#### Unassigned Items
Note any items without assignees that need owners.

### Recommendations
Based on your analysis, provide 2-3 actionable recommendations for the team:
- Items to prioritize
- Blockers to resolve
- Process improvements

### Looking Ahead
Preview what's coming up:
- Items likely to be worked on next week
- Any upcoming deadlines or milestones

## Formatting

- Use clear markdown formatting
- Keep sections concise and scannable
- Focus on actionable insights, not just raw numbers
- Be encouraging about progress while honest about challenges
