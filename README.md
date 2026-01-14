# Repo Agents

[![Build & Test](https://github.com/lucasilverentand/repo-agents/actions/workflows/ci.yml/badge.svg)](https://github.com/lucasilverentand/repo-agents/actions/workflows/ci.yml)
[![Release Please](https://github.com/lucasilverentand/repo-agents/actions/workflows/release-please.yml/badge.svg)](https://github.com/lucasilverentand/repo-agents/actions/workflows/release-please.yml)
[![Docs](https://github.com/lucasilverentand/repo-agents/actions/workflows/deploy-docs.yml/badge.svg)](https://lucasilverentand.github.io/repo-agents)

**Transform natural language markdown into intelligent GitHub Actions workflows powered by AI.**

Write what you want done in markdown – the AI figures out how to do it.

**[📚 Documentation](https://lucasilverentand.github.io/repo-agents)** • **[🚀 Getting Started](GETTING_STARTED.md)** • **[💡 Examples](https://lucasilverentand.github.io/repo-agents/examples/)**

---

## What is Repo Agents?

Repo Agents lets you automate repository tasks by writing simple instructions instead of complex YAML. Create AI-powered agents that automatically triage issues, review pull requests, generate reports, and more.

**Traditional GitHub Actions:**
```yaml
# Complex YAML configuration with multiple steps...
```

**With Repo Agents:**
```markdown
---
name: Issue Triage
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
  add-label: true
---

Analyze this issue and add appropriate labels (bug, feature, docs).
Welcome the contributor with a friendly message!
```

## Quick Start

```bash
# Install via npm/bun
npm install -g repo-agents
# or
bun install -g repo-agents

# Initialize in your repository
repo-agents init --examples

# Set up authentication
repo-agents setup

# Compile agents to workflows
repo-agents compile

# Commit and push
git add .github/
git commit -m "Add agents"
git push
```

**[→ Full getting started guide](GETTING_STARTED.md)**

## What Can You Build?

- **Issue Triage** – Auto-label and welcome new issues
- **PR Review** – Provide initial code review feedback
- **Activity Reports** – Daily/weekly summaries of repository activity
- **Stale Issue Cleanup** – Close inactive issues with helpful messages
- **Documentation Updates** – Automated doc improvements
- **Custom Workflows** – Anything you can describe in natural language

**[→ See examples](https://lucasilverentand.github.io/repo-agents/examples/)**

## Key Features

- ✅ **Natural language workflows** – Write instructions in markdown, not YAML
- ✅ **Safe by default** – Read-only unless explicitly granted permissions
- ✅ **Validated outputs** – All actions go through validation
- ✅ **Flexible triggers** – Issues, PRs, discussions, schedules, manual dispatch
- ✅ **Data collection** – Gather repo activity for analysis
- ✅ **Self-healing** – Auto-detects misconfigurations and creates fix instructions

## Documentation

**[📚 Full Documentation](https://lucasilverentand.github.io/repo-agents)**

Quick links:
- [Getting Started](GETTING_STARTED.md)
- [How It Works](https://lucasilverentand.github.io/repo-agents/guide/how-it-works/)
- [CLI Reference](https://lucasilverentand.github.io/repo-agents/cli/)
- [Examples](https://lucasilverentand.github.io/repo-agents/examples/)
- [Security](https://lucasilverentand.github.io/repo-agents/reference/security/)

## Development

```bash
# Clone and install
git clone https://github.com/lucasilverentand/repo-agents
cd repo-agents
bun install

# Build and test
bun run build
bun test

# Link locally
bun link
```

See [CLAUDE.md](CLAUDE.md) for development guidance.

## License

MIT

## Links

- **[📚 Documentation](https://lucasilverentand.github.io/repo-agents)**
- **[🐛 Issue Tracker](https://github.com/lucasilverentand/repo-agents/issues)**
- **[🤖 Anthropic Claude](https://www.anthropic.com/)**

---

Built with ❤️ using [Anthropic Claude](https://www.anthropic.com/claude)
