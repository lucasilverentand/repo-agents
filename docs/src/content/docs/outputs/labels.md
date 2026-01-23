---
title: Labels
description: Enable agents to manage issue and pull request labels
---

The `add-label`, `remove-label`, and `manage-labels` outputs allow your agent to manage labels on GitHub issues and pull requests. The first two work with existing labels, while `manage-labels` can create, edit, and delete repository labels.

## Basic Example

```yaml
name: Issue Triage
on:
  issues:
    types: [opened]

outputs:
  add-label: true
  remove-label: true
---

Analyze each new issue and apply appropriate labels based on the content.
If the issue is unclear, add "needs-info". Remove any auto-applied labels
that don't match the actual issue type.
```

## Configuration Options

```yaml
outputs:
  add-label: true            # boolean — default: false
  remove-label: true         # boolean — default: false
  manage-labels: true        # boolean — default: false
```

**add-label** — Enable adding labels. Labels must exist in the repository.

**remove-label** — Enable removing labels. Silently ignores labels that don't exist.

**manage-labels** — Enable creating, editing, and deleting repository labels.

### manage-labels

The `manage-labels` output allows agents to manage repository labels themselves — creating new labels, editing existing ones, or deleting labels that are no longer needed.

```yaml
outputs:
  manage-labels:
    allow_create: true       # boolean — allow creating labels
    allow_edit: true         # boolean — allow editing labels
    allow_delete: false      # boolean — allow deleting labels (destructive)
    protected_labels:        # labels that cannot be deleted
      - bug
      - enhancement
```

Use this output cautiously since label changes affect the entire repository. Consider disabling `allow_delete` or using `protected_labels` to prevent accidental removal of important labels.

## Best Practices

Keep your agent instructions specific about which labels to use and when. Rather than letting the agent choose freely from all available labels, describe the labeling scheme in your agent's markdown body. For example, explain that priority labels follow the pattern `priority/high`, `priority/medium`, and `priority/low`, and describe the criteria for each level.

Avoid over-labeling by instructing your agent to apply only the most relevant 2-4 labels per issue. Too many labels can make them less useful for filtering and organization.

When using both `add-label` and `remove-label` together for workflow automation, be explicit about the transitions. For instance, when adding `status/in-progress`, the agent should also remove `status/triage` if present.

Document your labeling scheme somewhere in your repository (like a CONTRIBUTING.md file) so both human contributors and your agent instructions stay aligned on label meanings.

## More Examples

<details>
<summary>Example: PR categorization by changed files</summary>

```yaml
name: PR Categorizer
on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read

outputs:
  add-label: true
  remove-label: true
---

Analyze the files changed in this pull request and apply appropriate labels.

Use these area labels based on the changed files:
- `area/frontend` for changes in src/components/, src/pages/, or *.css files
- `area/backend` for changes in src/api/, src/services/, or database files
- `area/docs` for changes in docs/ or README files
- `area/ci` for changes in .github/ or build configuration

Use these type labels:
- `type/feature` for new functionality
- `type/bugfix` for bug fixes
- `type/refactor` for code refactoring without behavior changes
- `type/chore` for maintenance tasks

When files change between pushes, update the labels accordingly. Remove labels
that no longer apply based on the current file set.
```
</details>

<details>
<summary>Example: Status workflow with label transitions</summary>

```yaml
name: Issue Status Manager
on:
  issues:
    types: [opened]
  issue_comment:
    types: [created]

outputs:
  add-label: true
  remove-label: true
---

Manage issue status labels based on activity.

When a new issue is opened, add `status/triage` unless it already has a status label.

When processing comments, look for these patterns:
- If a maintainer says "working on this" or similar, add `status/in-progress`
  and remove `status/triage`
- If someone asks for more information, add `status/needs-info`
- If the issue author provides requested information, remove `status/needs-info`

Only one status label should be present at a time, so always remove the previous
status when adding a new one.
```
</details>

<details>
<summary>Example: Simple triage with type detection</summary>

```yaml
name: Issue Triage
on:
  issues:
    types: [opened]

outputs:
  add-label: true
  add-comment: { max: 1 }
---

Analyze the issue title and body to determine the type:

- If it describes something broken or not working as expected, add `bug`
- If it requests new functionality, add `enhancement`
- If it asks how to do something, add `question`
- If it's about documentation, add `documentation`

If the issue is unclear or missing important details, add `needs-info` and
leave a polite comment asking for clarification.
```
</details>

<details>
<summary>Example: Label management for new components</summary>

```yaml
name: Label Manager
on:
  pull_request:
    types: [opened]
    paths:
      - 'src/components/**'

outputs:
  manage-labels:
    allow_create: true
    allow_edit: true
    allow_delete: false
  add-label: true
---

When a PR adds a new component directory under src/components/:

1. Check if a label exists for that component (e.g., "component/button")
2. If not, create it with a blue color (#0366d6) and description
3. Add the component label to the PR

This ensures every component has a corresponding label for filtering issues and PRs.
```
</details>
