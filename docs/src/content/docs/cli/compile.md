---
title: gh claude compile
description: Compile agent markdown files to GitHub Actions workflows
---

The `compile` command converts Claude agent markdown files into GitHub Actions workflow YAML files.

## Usage

```bash
gh claude compile [file] [options]
```

## Options

### `-a, --all`

Compile all agents in the agents directory:

```bash
gh claude compile --all
```

### `-d, --dry-run`

Show what would be generated without writing files:

```bash
gh claude compile --dry-run issue-triage.md
```

### `-o, --output-dir DIR`

Specify custom output directory for workflows:

```bash
gh claude compile --all --output-dir custom/workflows
```

Default: `.github/workflows/`

## Examples

### Compile Single Agent

```bash
gh claude compile .github/claude-agents/issue-triage.md
```

Generates: `.github/workflows/claude-issue-triage.yml`

### Compile All Agents

```bash
gh claude compile --all
```

### Preview Changes

```bash
gh claude compile --dry-run --all
```

## What It Does

1. Parses markdown frontmatter and content
2. Validates configuration
3. Generates GitHub Actions workflow YAML
4. Writes to `.github/workflows/`

## Generated Workflow

The compiled workflow includes:
- Trigger configuration from `on:` field
- Permissions from `permissions:` field
- Claude API integration
- Output handlers for allowed actions
- Security constraints

## Next Steps

- [Validate](../validate/) agents before compiling
- [List](../list/) all agents
- Learn about [Agent Definition](/gh-claude/guide/agent-definition/)

## See It In Action

- [Issue Triage Example](/gh-claude/examples/issue-triage/) - Complete agent workflow
- [Daily Summary Example](/gh-claude/examples/daily-summary/) - Scheduled agent

## See Also

- [Testing Strategies](/gh-claude/guide/testing-strategies/) - Safe development workflow
- [Troubleshooting](/gh-claude/guide/troubleshooting/) - Common issues
