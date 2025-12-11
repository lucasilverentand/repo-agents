---
title: gh claude list
description: List all Claude agents in your repository
---

The `list` command displays all Claude agents found in your repository.

## Usage

```bash
gh claude list [options]
```

## Options

### `-f, --format FORMAT`

Output format:

```bash
gh claude list --format json
```

Formats: `table` (default), `json`, `yaml`

### `-d, --details`

Show detailed information:

```bash
gh claude list --details
```

## Examples

### Basic List

```bash
gh claude list
```

Output:
```
NAME              TRIGGERS        OUTPUTS
Issue Triage      issues          add-comment, add-label
PR Review         pull_request    add-comment, add-label
Daily Summary     schedule        create-issue
```

### Detailed List

```bash
gh claude list --details
```

Output:
```
NAME: Issue Triage
FILE: .github/claude-agents/issue-triage.md
TRIGGERS:
  - issues: [opened]
PERMISSIONS:
  - issues: write
OUTPUTS:
  - add-comment: {max: 1}
  - add-label: true
MODEL: claude-3-5-sonnet-20241022

NAME: PR Review
...
```

### JSON Format

```bash
gh claude list --format json
```

Output:
```json
[
  {
    "name": "Issue Triage",
    "file": ".github/claude-agents/issue-triage.md",
    "triggers": ["issues"],
    "permissions": {"issues": "write"},
    "outputs": ["add-comment", "add-label"]
  }
]
```

## Next Steps

- [Validate](../validate/) agents
- [Compile](../compile/) agents
