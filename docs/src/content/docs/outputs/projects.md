---
title: Projects
description: Enable agents to manage GitHub Projects (v2)
---

The project outputs allow your agent to work with GitHub Projects (v2). You can add items to projects, update field values, archive items, and manage project structure.

## Available Outputs

### add-to-project

Add issues, pull requests, or draft items to a GitHub Project.

```yaml
outputs:
  add-to-project:
    project_number: 1          # number — default project number
    owner: "@me"               # string — "@me" or org name
```

### remove-from-project

Remove items from a GitHub Project.

```yaml
outputs:
  remove-from-project:
    project_number: 1
    owner: "@me"
```

### update-project-field

Update custom field values on project items (Status, Priority, dates, etc.).

```yaml
outputs:
  update-project-field:
    project_number: 1
    owner: "@me"
    allowed_fields:            # optional — restrict which fields can be updated
      - Status
      - Priority
```

### archive-project-item

Archive or unarchive items in a project. Archived items are hidden from the default view but preserved.

```yaml
outputs:
  archive-project-item:
    project_number: 1
    owner: "@me"
```

### manage-project

Create, edit, close, or delete entire projects.

```yaml
outputs:
  manage-project:
    owner: "@me"
    allow_create: true         # boolean — allow creating projects
    allow_delete: false        # boolean — allow deleting projects
    allow_close: true          # boolean — allow closing projects
```

### manage-project-field

Create or delete custom fields in a project.

```yaml
outputs:
  manage-project-field:
    project_number: 1
    owner: "@me"
    allow_create: true
    allow_delete: true
    protected_fields:          # optional — fields that cannot be deleted
      - Status
      - Priority
```

### link-project

Link or unlink projects to repositories or teams.

```yaml
outputs:
  link-project:
    owner: "@me"
    allow_link: true
    allow_unlink: true
```

## Permission Requirements

All project outputs require appropriate permissions. For organization projects, the GitHub App or token must have project access. The default `GITHUB_TOKEN` may have limited project permissions.

## Basic Example

```yaml
name: Project Manager
on:
  issues:
    types: [opened, labeled]

outputs:
  add-to-project:
    project_number: 1
    owner: my-org
  update-project-field:
    project_number: 1
    owner: my-org
    allowed_fields: [Status, Priority, Sprint]
---

When a new issue is opened or labeled:

1. Add it to the project board
2. Set the Status field to "Triage"
3. If the issue has a priority label (priority/high, priority/medium, priority/low),
   set the Priority field accordingly
4. If labeled with a sprint label (sprint/1, sprint/2), set the Sprint field
```

## Best Practices

Configure default `project_number` and `owner` in your output config to avoid repetition in agent instructions.

Use `allowed_fields` with `update-project-field` to prevent accidental modifications to fields you want to control manually.

Protect critical fields like Status using `protected_fields` in `manage-project-field` to prevent deletion.

When using `manage-project` with `allow_delete`, be cautious — deleted projects cannot be recovered. Consider using `allow_close` instead for reversible archival.

Use `@me` as the owner for personal projects, or specify the organization name for org projects.

## Examples

<details>
<summary>Example: Auto-triage to project board</summary>

```yaml
name: Issue Triage
on:
  issues:
    types: [opened]

outputs:
  add-to-project:
    project_number: 1
    owner: my-org
  update-project-field:
    project_number: 1
    owner: my-org
---

When a new issue is opened:

1. Add it to the Engineering project board
2. Set Status to "Triage"
3. Analyze the issue content to set initial Priority:
   - "High" for production bugs or security issues
   - "Medium" for feature requests from customers
   - "Low" for nice-to-have improvements
```

</details>

<details>
<summary>Example: Sprint planning automation</summary>

```yaml
name: Sprint Planning
on:
  schedule:
    - cron: '0 9 * * MON'

outputs:
  update-project-field:
    project_number: 1
    owner: my-org
    allowed_fields: [Sprint, Status]
  archive-project-item:
    project_number: 1
    owner: my-org

context:
  issues:
    states: [closed]
    labels: [done]
  since: 7d
---

Every Monday morning:

1. Archive all items with Status "Done" that were closed in the last week
2. Move items from "Backlog" to the current sprint if they have high priority
   and are unblocked
3. Update Sprint field for items being moved into the new sprint
```

</details>

<details>
<summary>Example: Project cleanup on issue close</summary>

```yaml
name: Project Cleanup
on:
  issues:
    types: [closed]

outputs:
  update-project-field:
    project_number: 1
    owner: my-org
    allowed_fields: [Status]
  archive-project-item:
    project_number: 1
    owner: my-org
---

When an issue is closed:

1. Update its Status field to "Done" in the project
2. If the issue was closed as "not planned", update Status to "Won't Do" instead
3. Archive the item from the active view if it was completed (not abandoned)
```

</details>

<details>
<summary>Example: Quarterly project setup</summary>

```yaml
name: Quarterly Setup
on:
  schedule:
    - cron: '0 9 1 1,4,7,10 *'

outputs:
  manage-project:
    owner: my-org
    allow_create: true
    allow_close: true
  manage-project-field:
    project_number: 1
    owner: my-org
    allow_create: true
  link-project:
    owner: my-org
    allow_link: true
---

At the start of each quarter:

1. Close the previous quarter's project board
2. Create a new project for the current quarter (e.g., "Q1 2024 Roadmap")
3. Add standard fields: Status (single-select), Priority (single-select), Sprint (single-select)
4. Link the new project to all engineering team repositories
5. Create sprint options for the quarter (Sprint 1, Sprint 2, etc.)
```

</details>
