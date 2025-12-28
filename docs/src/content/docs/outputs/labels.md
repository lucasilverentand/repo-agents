---
title: Labels (add-label, remove-label)
description: Enable agents to manage issue and pull request labels
---

The `add-label` and `remove-label` outputs enable your agent to manage labels on GitHub issues and pull requests. Use labels to categorize, prioritize, and organize work in your repository.

## Configuration

### Simple Enable

Enable label management without restrictions:

```yaml
outputs:
  add-label: true
  remove-label: true
```

### Individual Control

Enable only the operations you need:

```yaml
outputs:
  add-label: true      # Can add labels
  # remove-label not specified - cannot remove
```

### Combined with Other Outputs

Use labels alongside other outputs:

```yaml
outputs:
  add-comment: { max: 1 }
  add-label: true
  remove-label: true
```

## Permission Requirements

Both `add-label` and `remove-label` do not require explicit GitHub permissions in the `permissions` section. Claude can manage labels with default repository permissions.

## Label Management Examples

### Issue Triage Labels

```yaml
outputs:
  add-label: true

# Agent should identify and apply appropriate labels from:
# - bug
# - feature
# - documentation
# - question
# - needs-review
```

### Priority Labeling

```yaml
outputs:
  add-label: true

# Use labels:
# - priority/critical
# - priority/high
# - priority/medium
# - priority/low
```

### Status Workflow Labels

```yaml
outputs:
  add-label: true
  remove-label: true

# Use labels:
# - status/needs-info
# - status/in-progress
# - status/blocked
# - status/ready-for-review
```

## Common Label Patterns

### Descriptive Labels

Use clear, semantic labels:

```
bug              - Something is broken
feature          - New functionality
documentation    - Documentation updates
enhancement      - Improvement to existing feature
chore            - Maintenance tasks
testing          - Test-related changes
refactor         - Code refactoring
```

### Priority Labels

For prioritization:

```
priority/critical    - Urgent, blocks others
priority/high        - Important, should be soon
priority/medium      - Standard priority
priority/low         - Can wait, nice to have
```

### Status Labels

For workflow tracking:

```
status/triage         - Needs initial review
status/needs-info     - Waiting for more information
status/in-progress    - Currently being worked on
status/review         - Ready for review
status/blocked        - Cannot proceed
status/done           - Completed
```

### Type Labels

For categorization:

```
type/question        - User question
type/bug             - Bug report
type/feature-request - Feature request
type/discussion      - Discussion topic
```

### Area Labels

For codebase sections:

```
area/frontend       - Frontend code
area/backend        - Backend code
area/documentation  - Docs
area/ci             - CI/CD systems
area/security       - Security concerns
```

## Agent Configuration Examples

### Automatic Issue Triage

```yaml
name: Issue Triage
on:
  issues:
    types:
      - opened

outputs:
  add-label: true
  add-comment: { max: 1 }

inputs:
  issues:
    since: 1h
```

**In your agent instructions:**
```markdown
Analyze each new issue and apply appropriate labels:
- bug, feature, question, or documentation
- If the issue is vague, add "needs-info"
- If it looks like a duplicate, add "duplicate"
```

### PR Review Preparation

```yaml
name: PR Labeling
on:
  pull_request:
    types:
      - opened
      - synchronize

outputs:
  add-label: true
  remove-label: true
```

**In your agent instructions:**
```markdown
Label PRs based on changes:
- Type: feature, bugfix, docs, refactor, chore
- Area: frontend, backend, ci, docs
- Priority if obvious
- Remove outdated labels
```

### Status Workflow Automation

```yaml
name: Issue Status Workflow
on:
  issues:
    types:
      - opened
  issue_comment:
    types:
      - created

outputs:
  add-label: true
  remove-label: true
```

**In your agent instructions:**
```markdown
Update issue status labels:
- Developer says "working on it" → add "status/in-progress"
- 7+ days without activity → add "status/stale"
- Has all required info → remove "status/needs-info"
```

### Categorization Bot

```yaml
name: Label Categories
on:
  issues:
    types:
      - opened
  pull_request:
    types:
      - opened

outputs:
  add-label: true
```

**In your agent instructions:**
```markdown
Categorize by examining title and description:

Issues:
- "how do i..." → type/question
- "doesn't work" → type/bug
- "add feature" → type/feature-request

PRs:
- Analyze files changed
- Apply area and type labels
```

## Use Cases

### Automated Triage
Sort issues automatically by type and priority:
```yaml
outputs:
  add-label: true
  add-comment: { max: 1 }
```

### Workflow Tracking
Update labels as issues progress through a workflow:
```yaml
outputs:
  add-label: true
  remove-label: true
```

### Code Review Preparation
Label PRs by type and area for reviewers:
```yaml
outputs:
  add-label: true
```

### Release Management
Apply release labels and track version-specific issues:
```yaml
outputs:
  add-label: true
  remove-label: true
```

## Best Practices

### 1. Consistent Naming

Use a consistent naming scheme across all labels:

```yaml
# Good - clear hierarchy
area/frontend
area/backend
priority/high
priority/low

# Less clear - inconsistent
frontend
PRIORITY_HIGH
low-priority
```

### 2. Meaningful Combinations

Pair complementary labels:

```
bug + priority/critical       → Urgent issue
feature + area/frontend       → Frontend feature request
documentation + type/chore    → Doc maintenance
```

### 3. Avoid Over-Labeling

Use labels strategically, not excessively:

```yaml
# Good - focused labels
add-label: true

# Avoid - too many labels per issue
# This can make labels less useful
```

### 4. Clean Up Old Labels

Periodically remove obsolete labels:

```yaml
outputs:
  remove-label: true
```

### 5. Document Your Label Schema

Maintain a guide of available labels and their meanings in your repository.

## Security Considerations

### Label Content

Labels can be seen by anyone with repository access. Avoid including:
- Sensitive information
- Internal details
- Private references

```yaml
# Good - descriptive and safe
type/question
priority/high
status/needs-info

# Bad - contains sensitive info
internal/security-issue
customer-complaint
skip-email-to-john
```

### Label Spam Prevention

While there's no `max` limit for labels (unlike comments), design agents to apply labels judiciously:

```markdown
# In agent instructions:
Apply only the most relevant labels (2-4 per issue).
Do not apply labels that are already present.
```

## Troubleshooting

### Labels Not Being Applied

Check that:
1. The labels exist in your repository
2. The agent has correct logic to identify when to apply labels
3. The `add-label` output is enabled

### Incorrect Label Application

Refine agent instructions:
1. Provide clearer criteria for label selection
2. List all available labels explicitly
3. Add conditional logic for edge cases

### Inconsistent Labeling

Improve consistency by:
1. Documenting label meanings clearly
2. Providing specific examples to the agent
3. Using narrow, focused trigger conditions

## Related Outputs

- [Comments (add-comment)](./comments/) - Pair with labels for issue triage
- [Issues (create-issue, close-issue)](./issues/) - For issue management workflows
- [Pull Requests (create-pr, close-pr)](./pull-requests/) - For PR workflows

## Next Steps

- Learn about [Triggers](../../triggers/) to control when label operations run
- Explore [Issue Management](./issues/)
- Review [Security Best Practices](../../reference/security/)
