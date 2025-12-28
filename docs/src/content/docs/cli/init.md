---
title: gh claude init
description: Initialize gh-claude in your repository
---

The `init` command sets up gh-claude in your repository by creating the necessary directory structure and configuration files.

## Usage

```bash
gh claude init [options]
```

## Options

### `--examples`

Include example agent templates:

```bash
gh claude init --examples
```

### `--force`

Overwrite existing files:

```bash
gh claude init --force
```

## What It Creates

### Directory Structure

```
.github/
├── claude-agents/          # Agent markdown files
│   ├── issue-triage.md    # (with --examples)
│   └── pr-review.md       # (with --examples)
└── claude.yml             # Configuration file
```

### Configuration File

Creates `.github/claude.yml` with default settings:

```yaml
# Default Claude model for all agents
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7

# Repository settings
repository:
  agents_dir: .github/claude-agents
  workflows_dir: .github/workflows

# Security settings
security:
  require_outputs: true
  require_permissions: true
```

## Example Templates

With `--examples`, creates starter agent templates:

- **issue-triage.md** - Automatically categorize and label issues
- **pr-review.md** - Provide initial PR feedback

## Next Steps

After initialization:

1. Configure authentication with [setup-token](../setup-token/)
2. Review or customize example agents
3. [Compile](../compile/) agents to workflows
4. Commit and push changes

## See It In Action

- [Issue Triage Example](/gh-claude/examples/issue-triage/) - Complete triage agent
- [PR Review Example](/gh-claude/examples/pr-review/) - Code review agent

## See Also

- [Quick Start](/gh-claude/getting-started/quick-start/) - Full getting started guide
- [Agent Definition](/gh-claude/guide/agent-definition/) - How to write agents
