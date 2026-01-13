---
title: gh claude add
description: Add Claude agents from the built-in library
---

The `add` command lets you browse and install pre-built agents from the gh-claude library into your repository.

## Usage

```bash
gh claude add [options]
```

## Options

| Option | Description |
|--------|-------------|
| `-a, --all` | Add all agents from the library |
| `--force` | Overwrite existing agents with the same name |

## How It Works

1. Scans the gh-claude examples library for available agents
2. Displays an interactive list with agent names and descriptions
3. Copies selected agents to `.github/claude-agents/`
4. Shows next steps for customization and deployment

## Examples

### Interactive Selection

```bash
gh claude add
```

This displays a numbered list of available agents:

```
═══════════════════════════════════════════════════════════════
                    Claude Agent Library
═══════════════════════════════════════════════════════════════

Available agents:

1. Issue Triage
   Automatically categorize and label incoming issues

2. PR Review
   Provide initial code review feedback on pull requests

3. Discussion Responder
   Respond to GitHub discussions with helpful information

═══════════════════════════════════════════════════════════════

Enter the numbers of agents you want to add (comma-separated),
or type "all" to add all agents:

Selection: 1,2
```

### Add All Agents

```bash
gh claude add --all
```

### Overwrite Existing Agents

```bash
# Update agents to latest version from library
gh claude add --force

# Update all agents
gh claude add --all --force
```

## Output

The command reports what was added:

```
Added 2 agent(s):
  ✓ issue-triage.md
  ✓ pr-review.md

Skipped 1 existing agent(s):
  • discussion-responder.md
Use --force to overwrite existing agents
```

## Next Steps

After adding agents:

1. **Review and customize** agents in `.github/claude-agents/`
2. **Compile** agents to workflows: `gh claude compile --all`
3. **Commit and push** the changes

## Available Agents

The library includes agents for common tasks:

| Agent | Description |
|-------|-------------|
| Issue Triage | Categorize and label incoming issues |
| PR Review | Initial code review feedback |
| Discussion Responder | Respond to GitHub discussions |
| Scheduled Report | Generate periodic reports |
| Failure Alerts | Notify on workflow failures |

Run `gh claude add` to see the full current list with descriptions.

## Prerequisites

- Repository must be initialized with gh-claude (`gh claude init`)
- The `.github/claude-agents/` directory must exist

## Related Commands

- [setup](../setup/) - Interactive setup wizard (includes init)
- [init](../init/) - Initialize repository structure
- [compile](../compile/) - Compile agents to workflows
- [list](../list/) - List agents in your repository

## See Also

- [Agent Definition](/gh-claude/guide/agent-definition/) - How to customize agents
- [Examples](/gh-claude/examples/) - Detailed agent examples
