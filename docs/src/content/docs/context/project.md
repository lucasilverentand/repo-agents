---
title: GitHub Projects
description: Collect GitHub Projects v2 data for context
---

The project context collector gathers data from GitHub Projects v2, including project fields, items, and their field values. This enables agents to understand project structure, track work items, and automate project management tasks.

## Basic Example

```yaml
context:
  project:
    project_number: 1
    include_items: true
    limit: 100
```

## Configuration Options

```yaml
context:
  project:
    project_number: 1           # number — project number from URL
    project_id: "PVT_..."       # string — project node ID (alternative)
    owner: "org-name"           # string — for org projects (default: repo owner)
    include_items: true         # boolean — default: true
    include_fields: true        # boolean — default: true
    filters:
      status: [Todo, "In Progress"]  # string[]
      assignee: [username]      # string[]
      labels: [bug]             # string[]
    limit: 100                  # number — default: 100
```

**project_number** — The project number visible in the URL (e.g., `github.com/users/owner/projects/1`).

**project_id** — Alternative to `project_number`. The node ID of the project (format: `PVT_...`). Use this for more precise targeting.

**owner** — The owner of the project. Required for organization projects if different from the repository owner.

**include_items** — Whether to include project items in the context. Set to `false` to only collect project metadata and field definitions.

**include_fields** — Whether to include field definitions (Status, Priority, etc.) in the context.

**filters.status** — Filter items by their Status field value. Matches exact status names.

**filters.assignee** — Filter items by assignee username.

**filters.labels** — Filter items by labels on the linked issue or PR.

**limit** — Maximum items to collect. Range: `1`-`1000`.

## Finding Your Project ID

You can find the project number in the URL when viewing the project:
- `github.com/users/username/projects/1` → `project_number: 1`
- `github.com/orgs/orgname/projects/5` → `project_number: 5`, `owner: orgname`

For the node ID (`project_id`), use the GitHub CLI:
```bash
gh api graphql -f query='{ viewer { projectsV2(first: 10) { nodes { id number title } } } }'
```

## Context Output Format

The collected project data is formatted as markdown for Claude:

```markdown
## Project: Feature Roadmap

*Track upcoming features and their progress*

**URL:** https://github.com/users/owner/projects/1

### Fields

- **Status**: Todo, In Progress, Done, Blocked
- **Priority**: Low, Medium, High, Critical
- **Sprint** (iteration)

### Items (42 total)

#### By Status

- Todo: 15 items
- In Progress: 8 items
- Done: 18 items
- Blocked: 1 item

#### Recent Items

**#123: Add user authentication**
- Status: In Progress | Priority: High | Assignee: @developer

**#124: Fix navigation bug**
- Status: Todo | Priority: Critical
```

## Best Practices

Use `project_number` for simplicity when working with a single repository's project. The number is visible in the URL and easier to reference in documentation.

Filter items by status to focus your agent on actionable work. An agent managing sprint planning should probably focus on `Todo` and `Backlog` items rather than completed work.

Set reasonable limits based on your project size. A project with hundreds of items might overwhelm context limits. Focus on relevant items through filtering rather than collecting everything.

Combine project context with issues or pull_requests context for richer automation. For example, collect project items filtered by status, plus detailed issue data for items requiring triage.

## More Examples

<details>
<summary>Example: Auto-triage to project</summary>

```yaml
---
name: Auto-Triage to Project
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-label: true
  add-comment: true
context:
  project:
    project_number: 1
    include_fields: true
    include_items: false
---

Review the new issue and based on its content:

1. Determine appropriate priority (Low, Medium, High, Critical)
2. Identify the component area if possible
3. Add relevant labels

The project uses these Status values: Todo, In Progress, Done, Blocked
And these Priority values: Low, Medium, High, Critical

Provide a brief triage comment explaining your categorization.
```

</details>

<details>
<summary>Example: Sprint planning assistant</summary>

```yaml
---
name: Sprint Planning Assistant
on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
permissions:
  issues: write
outputs:
  add-comment: true
  create-discussion: true
context:
  project:
    project_number: 1
    include_items: true
    filters:
      status: [Todo, Backlog]
    limit: 50
  since: 7d
  min_items: 1
---

Analyze the backlog items and create a sprint planning summary:

1. Group items by priority
2. Identify dependencies between items
3. Suggest which items should be moved to "In Progress"
4. Flag any items that seem blocked or need clarification

Post the summary as a discussion for team review.
```

</details>

<details>
<summary>Example: Stale item cleanup</summary>

```yaml
---
name: Stale Item Cleanup
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
permissions:
  issues: write
outputs:
  add-comment: true
context:
  project:
    project_number: 1
    include_items: true
    filters:
      status: [In Progress]
    limit: 100
---

Review items that have been "In Progress" and identify any that appear stale.

For each item that hasn't had activity in 30+ days:
- Add a comment asking for a status update
- Note if the item should be moved back to Todo or marked Blocked

Be diplomatic in your comments - contributors may be busy or waiting on external factors.
```

</details>

<details>
<summary>Example: Project health report</summary>

```yaml
---
name: Weekly Project Health Report
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

Generate a weekly project health report covering:

1. **Progress Summary**
   - Items completed this week
   - Items moved to In Progress
   - New items added

2. **Status Distribution**
   - Current breakdown by status
   - Trend compared to last week (if patterns are visible)

3. **Attention Needed**
   - Blocked items requiring resolution
   - High priority items not yet started
   - Items without assignees

4. **Recommendations**
   - Suggested focus areas for next week
   - Process improvements based on patterns

Post as a discussion for team visibility.
```

</details>

<details>
<summary>Example: Organization project with filtering</summary>

```yaml
---
name: Org Project Review
on:
  schedule:
    - cron: '0 10 * * *'  # Daily at 10 AM
permissions:
  issues: read
outputs:
  create-discussion: true
context:
  project:
    project_number: 3
    owner: my-organization
    include_items: true
    filters:
      labels: [critical, urgent]
    limit: 50
  min_items: 1
---

Review critical and urgent items across the organization project.

Create a daily digest highlighting:
- New critical items that need immediate attention
- Urgent items that have been open for more than 3 days
- Any patterns in where critical issues are originating

Tag relevant team leads based on the component labels.
```

</details>
