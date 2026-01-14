# Getting Started with Repo Agents

Welcome to **Repo Agents** – a GitHub CLI extension that transforms natural language markdown files into intelligent GitHub Actions workflows powered by Claude AI.

## What is Repo Agents?

Repo Agents lets you automate repository tasks by writing simple instructions in markdown instead of complex YAML configurations. Define AI-powered agents that can:

- 🤖 Automatically triage and label new issues
- 📝 Review pull requests and provide feedback
- 📊 Generate daily/weekly activity reports
- 🏷️ Manage labels and close stale issues
- 💬 Create discussions and respond to questions
- 🔄 And much more...

## Why Repo Agents?

**Traditional GitHub Actions:**
```yaml
- name: Label issue
  uses: actions/labeler@v4
  with:
    configuration-path: .github/labeler.yml
    # Complex YAML configuration...
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
  add-comment: { max: 1 }
  add-label: true
---

Analyze this issue and add appropriate labels (bug, feature, docs).
Welcome the contributor with a friendly message!
```

The difference? **You write what you want done, not how to do it.** Claude figures out the rest.

## Prerequisites

Before you begin, ensure you have:

- **GitHub CLI** installed ([`gh`](https://cli.github.com/))
- **Git** for version control
- **Repository access** with admin permissions (to add secrets)
- **Anthropic API key** ([get one here](https://console.anthropic.com/))

## Installation

Install Repo Agents as a GitHub CLI extension:

```bash
gh extension install lucasilverentand/repo-agents
```

Verify the installation:

```bash
repo-agents --version
```

## Step-by-Step Guide

### 1. Set Up Your Repository

Navigate to your repository:

```bash
cd your-repository
```

Initialize Repo Agents with example agents:

```bash
repo-agents init --examples
```

This creates:
- `.github/agents/` – Directory for agent markdown files
- Example agent templates to help you get started

### 2. Configure Authentication

Run the interactive setup wizard:

```bash
repo-agents setup
```

This will guide you through:
1. **Claude API authentication** – Add your Anthropic API key
2. **GitHub App setup (optional)** – For branded identity and CI triggering

Alternatively, configure just the API key:

```bash
repo-agents setup-token
```

Or add it manually as a repository secret:

```bash
gh secret set ANTHROPIC_API_KEY
```

### 3. Create Your First Agent

Let's create a simple issue triage agent. Create a new file:

```bash
.github/agents/issue-triage.md
```

Add this content:

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

You are a helpful repository assistant. When a new issue is opened:

1. **Categorize** the issue with one of these labels:
   - `bug` – Something isn't working
   - `feature` – New feature request
   - `documentation` – Documentation improvements
   - `question` – General questions

2. **Assess priority** and add one of:
   - `priority: high` – Urgent or blocking
   - `priority: medium` – Important but not urgent
   - `priority: low` – Nice to have

3. **Welcome the contributor** with a friendly comment:
   - Thank them for opening the issue
   - Explain what labels you added and why
   - If it's a bug, ask for reproduction steps if missing
   - If it's a feature, ask clarifying questions

Be warm, welcoming, and constructive!
```

### 4. Compile to Workflows

Generate GitHub Actions workflows from your agents:

```bash
repo-agents compile
```

This creates:
- `.github/workflows/agent-dispatcher.yml` – Central dispatcher that handles all triggers
- `.github/workflows/agent-issue-triage.yml` – Your issue triage agent workflow

**What's a dispatcher?** The dispatcher is a centralized workflow that:
- Aggregates all triggers from all your agents
- Validates configuration (API keys, permissions)
- Routes events to the appropriate agent(s)
- Self-heals by creating issues if misconfigured

### 5. Review Generated Workflows (Optional)

Take a look at the generated workflows to understand what Repo Agents created:

```bash
cat .github/workflows/agent-dispatcher.yml
cat .github/workflows/agent-issue-triage.yml
```

You'll notice the dispatcher handles pre-flight checks, and your agent workflow focuses solely on the task at hand.

### 6. Commit and Deploy

Add your changes to git:

```bash
git add .github/
```

Commit with a descriptive message:

```bash
git commit -m "Add Claude issue triage agent"
```

Push to GitHub:

```bash
git push
```

### 7. Test Your Agent

Create a new issue in your repository and watch your agent in action!

1. Go to your repository on GitHub
2. Click **Issues** → **New issue**
3. Fill in a title and description
4. Submit the issue

Within a minute, your agent should:
- Add appropriate labels (bug, feature, docs, or question)
- Add a priority label
- Post a welcoming comment

Check the **Actions** tab to see the workflow run and logs.

## Understanding the Architecture

Repo Agents uses a **dispatcher pattern** for scalability and reliability:

```
GitHub Event (issue opened)
        ↓
agent-dispatcher.yml (pre-flight validation)
        ↓
    Routes to...
        ↓
agent-issue-triage.yml (executes agent)
```

### Benefits of the Dispatcher

1. **Shared validation**: API keys and permissions checked once
2. **Self-healing**: Creates issues and disables itself if misconfigured
3. **Efficient routing**: Only runs agents that match the event
4. **Centralized triggers**: All event subscriptions in one place

## Adding More Agents

### PR Review Agent

Create `.github/agents/pr-review.md`:

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

Review this pull request and provide constructive feedback:

1. Summarize the changes in 1-2 sentences
2. Check if tests are included
3. Note any potential breaking changes
4. Add appropriate labels (needs-tests, breaking-change, etc.)

Be helpful and constructive!
```

### Daily Activity Report

Create `.github/agents/daily-report.md`:

```markdown
---
name: Daily Activity Report
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM UTC
permissions:
  issues: read
  pull_requests: read
  discussions: write
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

Create a daily activity report discussion with:

1. **Summary**: Brief overview of repository activity
2. **Issues**: Opened, closed, and notable discussions
3. **Pull Requests**: Merged PRs and their impact
4. **Highlights**: Key achievements or milestones

Keep it concise and actionable!
```

Compile again to generate workflows for all agents:

```bash
repo-agents compile
```

## Validating Agents

Before compiling, validate your agent definitions:

```bash
repo-agents validate --all
```

This checks:
- YAML frontmatter syntax
- Required fields (name, on)
- Permission/output compatibility
- Business logic rules (e.g., `update-file` requires `allowed-paths`)

## Listing Agents

See all agents in your repository:

```bash
repo-agents list
```

For detailed information:

```bash
repo-agents list --details
```

Output formats:
```bash
repo-agents list --format json
repo-agents list --format yaml
```

## Troubleshooting

### Agent Not Triggering

1. **Check workflow status**: Go to **Actions** tab and verify the dispatcher is enabled
2. **Check secrets**: Ensure `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is set
3. **Check permissions**: Verify your agent has the required permissions
4. **Check triggers**: Make sure the event type matches your agent's `on:` configuration

### Configuration Errors

If the dispatcher detects missing configuration:
1. It will create an issue with instructions
2. It will disable itself to prevent repeated failures
3. Follow the issue instructions to fix the problem
4. Re-enable the workflow: `gh workflow enable agent-dispatcher.yml`

### Rate Limiting

Agents have built-in rate limiting (default: 5 minutes between runs). If an agent is rate-limited, check the workflow logs for details.

### API Errors

Check Claude API status and your account limits at [console.anthropic.com](https://console.anthropic.com/).

## Next Steps

Now that you have your first agent running, explore more advanced features:

### 📚 Core Concepts
- [How It Works](https://lucasilverentand.github.io/Repo Agents/guide/how-it-works/) – Understand the architecture
- [Agent Definition](https://lucasilverentand.github.io/Repo Agents/guide/agent-definition/) – Learn the markdown format
- [Permissions](https://lucasilverentand.github.io/Repo Agents/guide/permissions/) – Security model
- [Triggers](https://lucasilverentand.github.io/Repo Agents/triggers/) – Event types and configuration

### 🔧 Advanced Features
- [Inputs](https://lucasilverentand.github.io/Repo Agents/guide/inputs/) – Collect repository data for analysis
- [Outputs](https://lucasilverentand.github.io/Repo Agents/guide/outputs/) – Available actions
- [Multi-Agent Patterns](https://lucasilverentand.github.io/Repo Agents/guide/multi-agent-patterns/) – Complex workflows
- [Advanced Topics](https://lucasilverentand.github.io/Repo Agents/guide/advanced/) – Optimization and best practices

### 📦 Agent Library
- [Browse agents](https://lucasilverentand.github.io/Repo Agents/agents/gallery/) – Pre-built agent templates
- [Add agents](https://lucasilverentand.github.io/Repo Agents/cli/add/) – Install from library

### 🎯 Examples
- [Issue Triage](https://lucasilverentand.github.io/Repo Agents/examples/issue-triage/)
- [PR Review](https://lucasilverentand.github.io/Repo Agents/examples/pr-review/)
- [Daily Summary](https://lucasilverentand.github.io/Repo Agents/examples/daily-summary/)

## Community and Support

- **Documentation**: [lucasilverentand.github.io/Repo Agents](https://lucasilverentand.github.io/Repo Agents)
- **Issues**: [github.com/lucasilverentand/repo-agents/issues](https://github.com/lucasilverentand/repo-agents/issues)
- **Contributing**: See [CLAUDE.md](CLAUDE.md) for development guidance

## Summary

You've learned how to:
- ✅ Install Repo Agents
- ✅ Configure authentication
- ✅ Create an agent with natural language instructions
- ✅ Compile agents to GitHub Actions workflows
- ✅ Deploy and test your agent

**Next**: Explore the [full documentation](https://lucasilverentand.github.io/Repo Agents) to unlock the full power of Repo Agents!

---

Built with ❤️ using [Anthropic Claude](https://www.anthropic.com/claude) and [GitHub CLI](https://cli.github.com/)
