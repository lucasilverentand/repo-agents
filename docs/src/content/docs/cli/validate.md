---
title: gh claude validate
description: Validate agent markdown files
---

The `validate` command checks agent markdown files for errors and potential issues.

## Usage

```bash
gh claude validate [file] [options]
```

## Options

### `-a, --all`

Validate all agents:

```bash
gh claude validate --all
```

### `-s, --strict`

Treat warnings as errors:

```bash
gh claude validate --all --strict
```

## What It Checks

### Required Fields

- Agent has a `name`
- At least one trigger in `on:`

### Security

- Permissions are explicitly defined
- Outputs are specified
- File paths are allowed when using `update-file`

### Configuration

- Valid YAML frontmatter
- Supported trigger types
- Valid permission values
- Valid output configurations

## Examples

### Validate Single Agent

```bash
gh claude validate .github/claude-agents/issue-triage.md
```

### Validate All Agents

```bash
gh claude validate --all
```

### Strict Validation

```bash
gh claude validate --all --strict
```

Useful in CI/CD pipelines.

## Output

### Success

```
✓ issue-triage.md: Valid
✓ pr-review.md: Valid

All agents valid!
```

### Errors

```
✗ issue-triage.md: Missing required field 'name'
✗ pr-review.md: Invalid trigger type 'pull-request' (use 'pull_request')

Validation failed!
```

### Warnings

```
✓ issue-triage.md: Valid
⚠ pr-review.md: No outputs specified (agent will be read-only)

Validation complete with warnings.
```

## CI Integration

Add to your GitHub Actions:

```yaml
name: Validate Agents

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate agents
        run: gh claude validate --all --strict
```

## Next Steps

- [Compile](../compile/) validated agents
- Review [Agent Definition](/gh-claude/guide/agent-definition/)

## See Also

- [Testing Strategies](/gh-claude/guide/testing-strategies/) - Safe development workflow
- [Troubleshooting](/gh-claude/guide/troubleshooting/) - Common validation errors
- [Quick Reference](/gh-claude/reference/quick-reference/) - Valid field values
