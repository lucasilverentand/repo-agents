---
title: Outputs
description: Define actions your Claude agent can perform
---

Outputs define which actions your agent can perform on GitHub. Each output can be enabled with simple `true` or configured with specific options to control behavior and prevent unintended actions.

## What Are Outputs?

Outputs represent the capabilities granted to your Claude agent. By explicitly declaring outputs, you control what actions the agent can take—such as posting comments, creating pull requests, or updating files. The agent can only perform actions that are explicitly enabled in the outputs configuration.

## Configuration Syntax

Outputs can be configured in two ways:

**Simple Enable:**
```yaml
outputs:
  add-label: true
  remove-label: true
```

**With Configuration Options:**
```yaml
outputs:
  add-comment: { max: 3 }
  create-pr: { sign: true, max: 1 }
  update-file: { sign: true }
```

## Permission Requirements

Different outputs require different GitHub permissions. Ensure your agent configuration includes the necessary permissions:

```yaml
permissions:
  contents: write        # Required for: update-file, create-pr
  issues: write          # Required for: create-issue, close-issue
  pull_requests: write   # Required for: create-pr, close-pr
  discussions: write     # Required for: create-discussion
```

## Available Output Types

### Comments
- [**add-comment**](./comments/) - Post comments on issues or pull requests
  - Configuration: `max` (maximum number of comments)

### Labels
- [**add-label**](./labels/) - Add labels to issues or pull requests
- [**remove-label**](./labels/) - Remove labels from issues or pull requests

### Issues
- [**create-issue**](./issues/) - Create new issues
  - Configuration: `max` (maximum number to create)
- [**close-issue**](./issues/) - Close issues

### Pull Requests
- [**create-pr**](./pull-requests/) - Create pull requests
  - Configuration: `sign` (sign commits), `max` (maximum to create)
- [**close-pr**](./pull-requests/) - Close pull requests

### Files
- [**update-file**](./files/) - Modify files in the repository
  - Configuration: `sign` (sign commits)
  - Requires: `allowed-paths` allowlist

### Discussions
- [**create-discussion**](./discussions/) - Create discussions
  - Configuration: `max` (maximum number to create)

## Quick Examples

### Read-Only Analysis (No Outputs)
For agents that only analyze and report findings:
```yaml
outputs: {}  # No actions - analysis only
```

### Safe Interaction
For label management and commenting:
```yaml
outputs:
  add-comment: { max: 1 }
  add-label: true
  remove-label: true
```

### Documentation Automation
For automated docs updates with signed commits:
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

### Issue Triage
For managing issues and labels:
```yaml
permissions:
  issues: write

outputs:
  add-comment: { max: 2 }
  add-label: true
  remove-label: true
  close-issue: true
```

## Security Best Practices

### 1. Principle of Least Privilege

Enable only the outputs you need:

```yaml
# Good - minimal permissions
outputs:
  add-comment: { max: 1 }
  add-label: true

# Avoid - excessive permissions
outputs:
  add-comment: true
  create-issue: true
  create-pr: true
  update-file: true
  close-issue: true
```

### 2. Set Action Limits

Use `max` to prevent runaway behavior and limit resource usage:

```yaml
outputs:
  add-comment: { max: 1 }      # One comment per run
  create-issue: { max: 1 }     # One issue per run
  create-pr: { max: 1 }        # One PR per run
```

### 3. Restrict File Modifications

Always use `allowed-paths` to limit which files can be modified:

```yaml
allowed-paths:
  - docs/**           # Only documentation directory
  - README.md         # Specific file
  - .github/workflows/*.md  # Workflow documentation

outputs:
  update-file: true
```

### 4. Use Commit Signing

For file and PR modifications, enable commit signing for traceability:

```yaml
outputs:
  create-pr: { sign: true }
  update-file: { sign: true }
```

### 5. Require Explicit Outputs

Configure `.github/claude.yml` to prevent accidental capability grants:

```yaml
security:
  require_outputs: true  # Enforce explicit output definition
```

## Path Patterns for File Restrictions

When using `allowed-paths` with `update-file` or `create-pr`, use glob patterns:

- `**` - Matches any number of directories
- `*` - Matches files in current directory only
- `*.md` - Matches all markdown files
- `docs/**/*.md` - All markdown files in docs and subdirectories
- Exact paths - `README.md`, `src/config.js`

## Next Steps

- Explore specific output types in the sections above
- Learn about [Permissions](../../guide/permissions/)
- Review [Security Considerations](../../reference/security/)
- See [Examples](../../examples/issue-triage/)
