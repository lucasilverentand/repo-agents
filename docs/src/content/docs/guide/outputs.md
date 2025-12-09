---
title: Outputs
description: Define actions your Claude agent can perform
---

Outputs define which actions your agent can perform. Each output can be enabled with simple `true` or configured with specific options.

## Configuration Syntax

```yaml
outputs:
  # Simple enable
  add-label: true

  # With configuration
  add-comment: { max: 3 }

  # Sign commits
  update-file: { sign: true }
```

## Available Outputs

### `add-comment`

Post comments on issues or pull requests.

**Options:**
- `max`: Maximum number of comments (default: unlimited)

```yaml
outputs:
  add-comment: { max: 1 }
```

**Example usage:**
```markdown
Post a welcoming comment on new issues.
```

### `add-label`

Add labels to issues or pull requests.

```yaml
outputs:
  add-label: true
```

**Example usage:**
```markdown
Add labels: bug, feature, documentation, or question
```

### `remove-label`

Remove labels from issues or pull requests.

```yaml
outputs:
  remove-label: true
```

### `create-issue`

Create new issues.

**Options:**
- `max`: Maximum number of issues to create (default: unlimited)

```yaml
outputs:
  create-issue: { max: 1 }
```

**Example usage:**
```markdown
Create a daily summary issue with today's activity.
```

### `create-pr`

Create pull requests.

**Options:**
- `sign`: Sign commits (default: false)
- `max`: Maximum number of PRs to create (default: unlimited)

```yaml
outputs:
  create-pr: { sign: true, max: 1 }
```

**Requires:**
- `allowed-paths` in frontmatter

**Example usage:**
```markdown
Create a PR to update documentation files.
```

### `update-file`

Modify files in the repository.

**Options:**
- `sign`: Sign commits (default: false)

```yaml
outputs:
  update-file: { sign: true }
```

**Requires:**
- `allowed-paths` in frontmatter
- `contents: write` permission

```yaml
permissions:
  contents: write
allowed-paths:
  - docs/**
  - README.md
outputs:
  update-file: true
```

**Example usage:**
```markdown
Update the README.md with the latest statistics.
```

### `close-issue`

Close issues.

```yaml
outputs:
  close-issue: true
```

**Requires:**
- `issues: write` permission

### `close-pr`

Close pull requests.

```yaml
outputs:
  close-pr: true
```

**Requires:**
- `pull_requests: write` permission

## Constraints and Limits

### Maximum Limits

Use `max` to prevent runaway behavior:

```yaml
outputs:
  # Only one comment per run
  add-comment: { max: 1 }

  # Create at most 3 issues
  create-issue: { max: 3 }
```

### Path Restrictions

File modifications require explicit path allowlisting:

```yaml
allowed-paths:
  - docs/**/*.md
  - README.md
  - .github/workflows/**

outputs:
  update-file: true
```

Paths use glob patterns:
- `**` matches any number of directories
- `*` matches files in one directory
- Exact paths for specific files

## Security Best Practices

1. **Minimal Outputs**: Only enable outputs you need

```yaml
# Good - only what's needed
outputs:
  add-comment: { max: 1 }
  add-label: true

# Avoid - unnecessary permissions
outputs:
  add-comment: true
  create-issue: true
  create-pr: true
  update-file: true
```

2. **Set Limits**: Use `max` to prevent excessive actions

```yaml
outputs:
  add-comment: { max: 1 }  # Prevent comment spam
```

3. **Restrict Paths**: Limit file modifications

```yaml
allowed-paths:
  - docs/**  # Only docs directory
```

4. **Require Outputs**: Configure `.github/claude.yml`:

```yaml
security:
  require_outputs: true  # Force explicit output definition
```

## Examples

### Read-Only Analysis

```yaml
# No outputs - agent can only analyze and provide information
# to GitHub Actions logs (no external actions)
```

### Safe Interaction

```yaml
outputs:
  add-comment: { max: 1 }
  add-label: true
```

### Documentation Updates

```yaml
permissions:
  contents: write
  pull_requests: write
allowed-paths:
  - docs/**
  - README.md
outputs:
  update-file: { sign: true }
  create-pr: { sign: true, max: 1 }
```

### Issue Management

```yaml
permissions:
  issues: write
outputs:
  add-comment: { max: 2 }
  add-label: true
  remove-label: true
  close-issue: true
```

## Next Steps

- Learn about [Permissions](/guide/permissions/)
- See [Examples](/examples/issue-triage/)
- Review [Security](/reference/security/)
