# gh-claude

[![CI](https://github.com/lucasilverentand/gh-claude/workflows/CI/badge.svg)](https://github.com/lucasilverentand/gh-claude/actions/workflows/ci.yml)
[![Release](https://github.com/lucasilverentand/gh-claude/workflows/Release/badge.svg)](https://github.com/lucasilverentand/gh-claude/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/lucasilverentand/gh-claude/branch/main/graph/badge.svg)](https://codecov.io/gh/lucasilverentand/gh-claude)
[![Docs](https://github.com/lucasilverentand/gh-claude/workflows/Deploy%20Docs/badge.svg)](https://lucasilverentand.github.io/gh-claude)

A GitHub CLI extension that transforms natural language markdown files into GitHub Actions workflows powered by Claude AI.

## Overview

**gh-claude** enables developers to create intelligent repository automation by writing simple markdown instructions instead of complex YAML configurations. Define AI-powered agents that can automatically triage issues, review pull requests, manage discussions, and more.

## Features

- **Natural Language Workflows**: Write agent behavior in markdown instead of YAML
- **Claude AI Integration**: Powered by Anthropic's Claude models
- **Security by Default**: Explicit permissions and sandboxed execution
- **Flexible Triggers**: Respond to GitHub events, schedules, or manual dispatch
- **Controlled Outputs**: Validated output handlers for safe actions

## Installation

```bash
gh extension install yourusername/gh-claude
```

## Quick Start

### 1. Initialize in Your Repository

```bash
cd your-repo
gh claude init --examples
```

This creates:
- `.github/claude-agents/` - Directory for agent markdown files
- `.github/claude.yml` - Configuration file
- Example agent templates

### 2. Configure API Key

Add your Anthropic API key as a repository secret:

```bash
gh secret set ANTHROPIC_API_KEY
```

### 3. Create an Agent

Create `.github/claude-agents/issue-triage.md`:

```markdown
---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Issue Triage Agent

Analyze new issues and:

1. Categorize with appropriate labels (bug, feature, documentation, question)
2. Assess priority (high, medium, low)
3. Welcome the contributor with a friendly comment

Be helpful and welcoming!
```

### 4. Compile to Workflow

```bash
gh claude compile --all
```

This generates `.github/workflows/claude-issue-triage.yml`

### 5. Commit and Push

```bash
git add .github/
git commit -m "Add Claude issue triage agent"
git push
```

## Agent Definition Format

Agents are markdown files with YAML frontmatter:

```markdown
---
name: Agent Name
on:
  issues:
    types: [opened, edited]
  pull_request:
    types: [opened, synchronize]
permissions:
  issues: write
  pull_requests: write
outputs:
  add-comment: { max: 3 }
  add-label: true
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7
---

# Agent Instructions

Your natural language instructions for Claude go here...
```

### Frontmatter Fields

#### Required Fields

- **name**: Display name for the agent
- **on**: Trigger configuration (at least one trigger required)

#### Optional Fields

- **permissions**: GitHub permissions (read/write for contents, issues, pull_requests, discussions)
- **outputs**: Allowed actions the agent can perform
- **inputs**: Data collection configuration for scheduled/manual agents
- **claude**: Claude model configuration
- **allowed-actors**: Restrict to specific GitHub users
- **allowed-teams**: Restrict to specific GitHub teams
- **allowed-paths**: File paths the agent can modify
- **trigger_labels**: Required labels for issue/PR triggers
- **rate_limit_minutes**: Minimum minutes between runs (default: 5)

### Triggers

```yaml
on:
  # Issue events
  issues:
    types: [opened, edited, closed, reopened]

  # Pull request events
  pull_request:
    types: [opened, synchronize, closed]

  # Discussion events
  discussion:
    types: [created, edited]

  # Schedule (cron)
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am

  # Manual trigger
  workflow_dispatch:
    inputs:
      reason:
        description: 'Reason for manual run'
        required: true

  # External trigger
  repository_dispatch:
    types: [custom-event]
```

### Outputs

Outputs define which actions the agent can perform. Each output can have configuration options:

```yaml
outputs:
  add-comment: { max: 3 }     # Limit to 3 comments
  add-label: true              # Simple enable
  update-file: { sign: true }  # Sign commits
```

Available outputs:

- **add-comment**: Comment on issues or PRs
  - `max`: Maximum number of comments (default: unlimited)
- **add-label**: Add labels to issues or PRs
- **remove-label**: Remove labels from issues or PRs
- **create-issue**: Create new issues
  - `max`: Maximum issues to create (default: unlimited)
- **create-discussion**: Create new discussions
  - `max`: Maximum discussions to create (default: unlimited)
- **create-pr**: Create pull requests
  - `sign`: Whether to sign commits (default: false)
- **update-file**: Modify files (requires `allowed-paths`)
  - `sign`: Whether to sign commits (default: false)
- **close-issue**: Close issues
- **close-pr**: Close pull requests

Use `true` for simple enablement or an object with configuration options.

### Inputs

Inputs enable agents to collect and analyze repository data before execution. This is particularly useful for scheduled agents that create reports, summaries, or alerts based on repository activity.

**Key Feature**: Agents with inputs will **skip execution if no data is collected**, preventing unnecessary runs and saving API costs.

```yaml
inputs:
  issues:
    states: [open, closed]
    labels: [bug, enhancement]
    limit: 50
  pull_requests:
    states: [open, merged]
    limit: 50
  discussions:
    categories: [Announcements, Q&A]
    limit: 20
  commits:
    branches: [main, develop]
    limit: 100
  releases:
    prerelease: false
    limit: 10
  workflow_runs:
    status: [failure, success]
    workflows: [test.yml, build.yml]
    limit: 30
  since: last-run  # or "1h", "24h", "7d"
  min_items: 1      # Skip if fewer items collected
```

#### Input Types

**Issues** - Collect issues from the repository:
- `states`: Filter by state (`open`, `closed`, `all`)
- `labels`: Only issues with these labels
- `assignees`: Only issues assigned to these users
- `creators`: Only issues created by these users
- `mentions`: Only issues mentioning these users
- `milestones`: Only issues in these milestones
- `excludeLabels`: Exclude issues with these labels
- `limit`: Maximum issues to fetch (default: 100, max: 1000)

**Pull Requests** - Collect pull requests:
- `states`: Filter by state (`open`, `closed`, `merged`, `all`)
- `labels`: Only PRs with these labels
- `assignees`: Only PRs assigned to these users
- `creators`: Only PRs created by these users
- `reviewers`: Only PRs with these reviewers
- `baseBranch`: Only PRs targeting this branch
- `headBranch`: Only PRs from this branch
- `excludeLabels`: Exclude PRs with these labels
- `limit`: Maximum PRs to fetch (default: 100, max: 1000)

**Discussions** - Collect discussions:
- `categories`: Filter by category names
- `answered`: Only answered discussions (boolean)
- `unanswered`: Only unanswered discussions (boolean)
- `labels`: Only discussions with these labels
- `limit`: Maximum discussions to fetch (default: 100, max: 1000)

**Commits** - Collect commits:
- `branches`: Branches to check (default: `["main", "master"]`)
- `authors`: Only commits by these authors
- `excludeAuthors`: Exclude commits by these authors
- `limit`: Maximum commits per branch (default: 100, max: 1000)

**Releases** - Collect releases:
- `prerelease`: Include pre-releases (boolean)
- `draft`: Include draft releases (boolean)
- `limit`: Maximum releases to fetch (default: 20, max: 100)

**Workflow Runs** - Collect workflow execution data:
- `workflows`: Filter by workflow file names
- `status`: Filter by conclusion (`success`, `failure`, `cancelled`, `skipped`)
- `branches`: Only runs on these branches
- `limit`: Maximum runs to fetch (default: 50, max: 1000)

**Stars & Forks** - Track repository metrics:
- `stars: true` - Include current star count
- `forks: true` - Include current fork count

#### Time Filtering

The `since` field controls the time range for data collection:

- `last-run` (default): Collect data since the last successful workflow run
- `1h`, `6h`, `24h`: Collect data from the last N hours
- `7d`, `30d`: Collect data from the last N days

#### Minimum Items

The `min_items` field (default: 1) prevents agent execution when insufficient data is collected. For example, a daily report with `min_items: 5` won't run if there's been minimal activity.

#### Example: Daily Report Agent

```markdown
---
name: Daily Activity Report
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM
permissions:
  issues: write
outputs:
  create-issue: true
inputs:
  issues:
    states: [open, closed]
    limit: 50
  pull_requests:
    states: [all]
    limit: 50
  commits:
    branches: [main]
    limit: 100
  since: last-run
  min_items: 1
---

Analyze the collected repository data and create a comprehensive daily activity report.

Summarize:
1. Issues opened and closed
2. PRs merged and opened
3. Commit activity
4. Key achievements

Create a new issue with the label "daily-report" containing your analysis.
```

#### How Input Collection Works

1. **Pre-flight Job**: Collects configured data using GitHub CLI
2. **Data Formatting**: Formats data as markdown sections
3. **Threshold Check**: Compares total items against `min_items`
4. **Context Injection**: Passes formatted data to Claude agent
5. **Agent Execution**: Claude analyzes the data and performs configured outputs

Collected data is provided to Claude as structured markdown within the agent context, allowing for sophisticated analysis and reporting.

## CLI Commands

### `gh claude init`

Initialize gh-claude in the current repository.

```bash
gh claude init [options]

Options:
  --examples    Include example agent templates
  --force       Overwrite existing files
```

### `gh claude compile`

Compile agent markdown files to GitHub Actions workflows.

```bash
gh claude compile [file] [options]

Options:
  -a, --all              Compile all agents
  -d, --dry-run          Show what would be generated
  -o, --output-dir DIR   Output directory for workflows

Examples:
  gh claude compile .github/claude-agents/issue-triage.md
  gh claude compile --all
  gh claude compile --dry-run issue-triage.md
```

### `gh claude validate`

Validate agent markdown files.

```bash
gh claude validate [file] [options]

Options:
  -a, --all      Validate all agents
  -s, --strict   Enable strict validation (warnings as errors)

Examples:
  gh claude validate .github/claude-agents/issue-triage.md
  gh claude validate --all
  gh claude validate --all --strict
```

### `gh claude list`

List all Claude agents.

```bash
gh claude list [options]

Options:
  -f, --format FORMAT   Output format (table, json, yaml)
  -d, --details         Show detailed information

Examples:
  gh claude list
  gh claude list --details
  gh claude list --format json
```

## Examples

### Issue Triage Agent

Automatically categorize and label new issues:

```markdown
---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Issue Triage Agent

When a new issue is opened:

1. Categorize: bug, feature, documentation, or question
2. Assess priority: high, medium, or low
3. Welcome the contributor
4. Mention if more information is needed

Be friendly and helpful!
```

### PR Review Assistant

Provide initial feedback on pull requests:

```markdown
---
name: PR Initial Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
outputs:
  add-comment: { max: 1 }
  add-label: true
---

# Pull Request Review Agent

Analyze the PR and:

1. Summarize the changes
2. Check for missing tests
3. Identify potential breaking changes
4. Note code style issues
5. Add appropriate labels

Be constructive and encouraging!
```

### Daily Summary Agent

Generate daily activity summaries:

```markdown
---
name: Daily Summary
on:
  schedule:
    - cron: '0 17 * * *'  # 5pm daily
permissions:
  issues: write
outputs:
  create-issue: { max: 1 }
---

# Daily Summary Agent

Create a summary issue with:

1. Issues opened/closed today
2. PRs merged today
3. Active discussions
4. Notable events

Title: "Daily Summary - [Date]"
```

## Configuration

### Repository Configuration

`.github/claude.yml`:

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

### Environment Variables

GitHub Actions workflows use these environment variables:

- `ANTHROPIC_API_KEY` - Your Anthropic API key (required, set as secret)
- `GITHUB_TOKEN` - GitHub token (automatically provided)

## Security

### Permission Model

- **Read-only by default**: Agents require explicit permission grants
- **Safe outputs only**: All actions go through validated handlers
- **Path restrictions**: File modifications limited to `allowed-paths`
- **Team controls**: Optional user/team restrictions

### Best Practices

1. Use minimal required permissions
2. Always specify `outputs`
3. Use `allowed-paths` for file modifications
4. Review generated workflows before committing
5. Test with `--dry-run` first
6. Keep API keys in GitHub secrets

## Troubleshooting

### Agent not triggering

1. Check workflow file exists in `.github/workflows/`
2. Verify trigger configuration matches events
3. Check repository Actions are enabled
4. Review workflow run logs

### Compilation errors

```bash
# Validate agent definition
gh claude validate --all --strict

# Show what would be generated
gh claude compile --dry-run your-agent.md
```

### Permission errors

Ensure agent frontmatter includes required permissions:

```yaml
permissions:
  issues: write
  pull_requests: write
```

## Development

### Project Structure

```
.
├── src/
│   ├── cli/           # CLI commands and utilities
│   ├── parser/        # Markdown and frontmatter parsing
│   ├── generator/     # Workflow YAML generation
│   ├── runtime/       # GitHub Actions runtime
│   └── types/         # TypeScript type definitions
├── tests/             # Test files
└── package.json       # Dependencies and scripts
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/gh-claude
cd gh-claude

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Install locally
gh extension install .
```

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT

## Acknowledgments

- Built with [Anthropic Claude](https://www.anthropic.com/claude)
- Powered by [GitHub CLI](https://cli.github.com/)
- Inspired by the need for simpler GitHub Actions automation

## Links

- **Documentation**: https://github.com/yourusername/gh-claude
- **Issue Tracker**: https://github.com/yourusername/gh-claude/issues
- **Anthropic Claude**: https://www.anthropic.com/
- **GitHub CLI**: https://cli.github.com/

---

**Status**: Beta (v0.1.0)
**Last Updated**: 2025-12-03
