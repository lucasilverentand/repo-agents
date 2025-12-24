# gh-claude

[![CI](https://github.com/lucasilverentand/gh-claude/workflows/CI/badge.svg)](https://github.com/lucasilverentand/gh-claude/actions/workflows/ci.yml)
[![Release](https://github.com/lucasilverentand/gh-claude/workflows/Release/badge.svg)](https://github.com/lucasilverentand/gh-claude/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/lucasilverentand/gh-claude/branch/main/graph/badge.svg)](https://codecov.io/gh/lucasilverentand/gh-claude)
[![Docs](https://github.com/lucasilverentand/gh-claude/workflows/Deploy%20Docs/badge.svg)](https://lucasilverentand.github.io/gh-claude)

A GitHub CLI extension that transforms natural language markdown files into GitHub Actions workflows powered by Claude AI.

**[📚 Full Documentation](https://lucasilverentand.github.io/gh-claude)** | **[🚀 Quick Start](#quick-start)** | **[💡 Examples](#examples)**

## Overview

**gh-claude** enables developers to create intelligent repository automation by writing simple markdown instructions instead of complex YAML configurations. Define AI-powered agents that can automatically triage issues, review pull requests, analyze activity, and more.

### Why gh-claude?

- **Simpler than YAML**: Write instructions in natural language
- **Powerful automation**: Let Claude handle complex decision-making
- **Safe by design**: Explicit permissions and validated outputs
- **Easy to maintain**: Update agent behavior by editing markdown files

## Key Features

- 🤖 **Natural Language Workflows**: Write agent behavior in markdown instead of YAML
- 🧠 **Claude AI Integration**: Powered by Anthropic's Claude models
- 🔒 **Security by Default**: Explicit permissions and sandboxed execution
- ⚡ **Flexible Triggers**: Issues, PRs, discussions, schedules, and manual dispatch
- 📊 **Data Collection**: Gather repository activity for analysis and reporting
- ✅ **Controlled Outputs**: Validated output handlers for safe actions

## Installation

```bash
gh extension install lucasilverentand/gh-claude
```

> **Note**: Replace `lucasilverentand` with the actual username/organization once published.

## Quick Start

### 1. Initialize in Your Repository

```bash
cd your-repo
gh claude init --examples
```

This creates:
- `.github/claude-agents/` - Directory for agent markdown files
- Example agent templates to get you started

### 2. Configure Authentication

Set up your Anthropic API key:

```bash
gh claude setup-token
```

Or manually add it as a repository secret:

```bash
gh secret set ANTHROPIC_API_KEY
```

**[→ Learn more about authentication](https://lucasilverentand.github.io/gh-claude/guide/authentication/)**

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

Your agent is now live! It will automatically triage new issues.

## Examples

### Issue Triage Agent

Automatically categorize and welcome new issues:

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

Categorize this issue as bug, feature, docs, or question.
Add appropriate priority label. Welcome the contributor!
```

**[→ See full example with variations](https://lucasilverentand.github.io/gh-claude/examples/issue-triage/)**

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

Analyze the PR and provide constructive feedback:
1. Summarize changes
2. Check for missing tests
3. Note potential breaking changes
4. Add appropriate labels
```

**[→ See full example with GitHub MCP integration](https://lucasilverentand.github.io/gh-claude/examples/pr-review/)**

### Daily Activity Report

Generate automated activity summaries:

```markdown
---
name: Daily Report
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM
permissions:
  discussions: write
  issues: read
  pull_requests: read
outputs:
  create-discussion: true
inputs:
  issues:
    states: [open, closed]
    limit: 50
  pull_requests:
    states: [open, merged]
    limit: 50
  since: last-run
  min_items: 1
---

Create a daily activity report summarizing:
- Issues opened and closed
- PRs merged
- Key achievements
```

**[→ See full example with input system](https://lucasilverentand.github.io/gh-claude/examples/daily-summary/)**

## Documentation

### Getting Started

- **[Installation](https://lucasilverentand.github.io/gh-claude/getting-started/installation/)** - Install gh-claude
- **[Quick Start](https://lucasilverentand.github.io/gh-claude/getting-started/quick-start/)** - Create your first agent
- **[Authentication](https://lucasilverentand.github.io/gh-claude/guide/authentication/)** - Set up API keys and OAuth

### Core Concepts

- **[How It Works](https://lucasilverentand.github.io/gh-claude/guide/how-it-works/)** - Architecture and workflow structure
- **[Agent Definition](https://lucasilverentand.github.io/gh-claude/guide/agent-definition/)** - Write agent instructions
- **[Inputs](https://lucasilverentand.github.io/gh-claude/guide/inputs/)** - Collect repository data
- **[Outputs](https://lucasilverentand.github.io/gh-claude/guide/outputs/)** - Available actions
- **[Permissions](https://lucasilverentand.github.io/gh-claude/guide/permissions/)** - Security model
- **[Triggers](https://lucasilverentand.github.io/gh-claude/triggers/)** - Event configuration

### CLI Commands

```bash
gh claude init [--examples]      # Initialize in repository
gh claude compile [--all]        # Compile agents to workflows
gh claude validate [--all]       # Validate agent definitions
gh claude list [--details]       # List all agents
gh claude setup-token            # Configure Claude API authentication
gh claude setup-app              # Configure GitHub App (optional)
```

**[→ Full CLI Reference](https://lucasilverentand.github.io/gh-claude/cli/init/)**

### Advanced

- **[Advanced Topics](https://lucasilverentand.github.io/gh-claude/guide/advanced/)** - Complex patterns and optimization
- **[Troubleshooting](https://lucasilverentand.github.io/gh-claude/guide/troubleshooting/)** - Debug common issues
- **[Quick Reference](https://lucasilverentand.github.io/gh-claude/reference/quick-reference/)** - Cheat sheet
- **[FAQ](https://lucasilverentand.github.io/gh-claude/reference/faq/)** - Frequently asked questions
- **[Security](https://lucasilverentand.github.io/gh-claude/reference/security/)** - Security model and best practices

## Security

gh-claude is designed with security as a priority:

- ✅ **Read-only by default**: Agents require explicit permission grants
- ✅ **Validated outputs**: All actions go through validated handlers
- ✅ **Path restrictions**: File modifications limited to `allowed-paths`
- ✅ **User authorization**: Optional user/team restrictions
- ✅ **Rate limiting**: Prevent excessive runs and API usage

**[→ Learn more about security](https://lucasilverentand.github.io/gh-claude/reference/security/)**

## Development

### Project Structure

```
.
├── src/
│   ├── cli/           # CLI commands and utilities
│   ├── parser/        # Markdown and frontmatter parsing
│   ├── generator/     # Workflow YAML generation
│   └── types/         # TypeScript type definitions
├── docs/              # Documentation site
└── tests/             # Test files
```

### Building from Source

```bash
# Clone repository
git clone https://github.com/lucasilverentand/gh-claude
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

### Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [CLAUDE.md](CLAUDE.md) for development guidance when working with Claude Code.

## License

MIT

## Links

- **[📚 Documentation](https://lucasilverentand.github.io/gh-claude)**
- **[🐛 Issue Tracker](https://github.com/lucasilverentand/gh-claude/issues)**
- **[🤖 Anthropic Claude](https://www.anthropic.com/)**
- **[⚡ GitHub CLI](https://cli.github.com/)**

---

Built with ❤️ using [Anthropic Claude](https://www.anthropic.com/claude) and [GitHub CLI](https://cli.github.com/)
