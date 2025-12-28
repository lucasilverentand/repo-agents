---
title: Quick Reference
description: Quick lookup tables for gh-claude configuration
---

Fast lookup for all gh-claude configuration options.

## Frontmatter Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Agent display name |
| `on` | Yes | object | Trigger configuration |
| `permissions` | No | object | GitHub permissions |
| `outputs` | No | object | Allowed actions |
| `claude` | No | object | Claude model settings |
| `allowed-actors` | No | array | Allowed GitHub usernames |
| `allowed-teams` | No | array | Allowed GitHub teams |
| `allowed-paths` | No | array | File path patterns (glob) |
| `trigger_labels` | No | array | Required labels to trigger |
| `rate_limit_minutes` | No | number | Min minutes between runs |
| `inputs` | No | object | Data collection config |

## Trigger Types

| Trigger | Event Types |
|---------|-------------|
| `issues` | opened, edited, closed, reopened, labeled, unlabeled, assigned, milestoned |
| `pull_request` | opened, edited, closed, synchronize, ready_for_review, labeled, review_requested |
| `discussion` | created, edited, answered, unanswered, labeled, category_changed |
| `schedule` | cron expressions |
| `workflow_dispatch` | manual with inputs |
| `repository_dispatch` | custom events |

## Permissions

| Permission | Values | Used For |
|------------|--------|----------|
| `contents` | read, write | Repository files |
| `issues` | read, write | Issues |
| `pull_requests` | read, write | Pull requests |
| `discussions` | read, write | Discussions |

## Output Types

| Output | Options | Required Permission |
|--------|---------|---------------------|
| `add-comment` | `max` | `issues: write` or `pull_requests: write` |
| `add-label` | `max` | `issues: write` or `pull_requests: write` |
| `remove-label` | `max` | `issues: write` or `pull_requests: write` |
| `create-issue` | `max` | `issues: write` |
| `close-issue` | - | `issues: write` |
| `create-pr` | `max`, `sign` | `contents: write` + `allowed-paths` |
| `close-pr` | - | `pull_requests: write` |
| `update-file` | `sign` | `contents: write` + `allowed-paths` |
| `create-discussion` | `max` | `discussions: write` |

## Input Types

| Input | Key Fields | Description |
|-------|------------|-------------|
| `issues` | states, labels, limit | Collect issues |
| `pull_requests` | states, labels, limit | Collect PRs |
| `discussions` | categories, answered, limit | Collect discussions |
| `commits` | branches, authors, limit | Collect commits |
| `releases` | prerelease, draft, limit | Collect releases |
| `workflow_runs` | workflows, status, limit | Collect CI runs |
| `stars` | boolean | Star count |
| `forks` | boolean | Fork count |

## Time Filters (`since`)

| Value | Description |
|-------|-------------|
| `last-run` | Since last successful run (default) |
| `1h`, `6h`, `12h`, `24h` | Hours ago |
| `7d`, `14d`, `30d`, `60d`, `90d` | Days ago |

## Claude Configuration

| Field | Values | Description |
|-------|--------|-------------|
| `model` | `claude-3-5-sonnet-20241022`, `claude-3-opus-20240229`, `claude-3-haiku-20240307` | Model selection |
| `max_tokens` | 1024-8192 | Output token limit |
| `temperature` | 0.0-1.0 | Creativity (0=focused, 1=creative) |

## Cron Schedule Patterns

| Pattern | Description |
|---------|-------------|
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9 AM UTC |
| `0 9 * * MON` | Every Monday at 9 AM |
| `0 9 * * MON-FRI` | Weekdays at 9 AM |
| `0 0 1 * *` | First day of month |

## Path Patterns

| Pattern | Matches |
|---------|---------|
| `README.md` | Single file |
| `docs/**` | Directory and all contents |
| `**/*.md` | All markdown files |
| `!docs/archive/**` | Exclude pattern |
| `src/**/*.ts` | TypeScript files in src |

## CLI Commands

```bash
gh claude init              # Initialize project
gh claude validate --all    # Validate agents
gh claude compile --all     # Compile workflows
gh claude list              # List agents
gh claude setup-token       # Setup authentication
```

## Validation Checklist

- [ ] `name` and `on` are set
- [ ] Permissions match outputs
- [ ] `allowed-paths` set for file operations
- [ ] Output limits configured (`max`)
- [ ] Rate limiting appropriate
- [ ] Instructions are clear

## See Also

- [Agent Definition](/gh-claude/guide/agent-definition/) - Complete configuration guide
- [Troubleshooting](/gh-claude/guide/troubleshooting/) - Common issues
- [Examples](/gh-claude/examples/) - Working agent patterns
- [Configuration](/gh-claude/reference/configuration/) - Repository settings
