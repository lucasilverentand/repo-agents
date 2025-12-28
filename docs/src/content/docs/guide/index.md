---
title: Core Concepts
description: Understand how gh-claude works
---

gh-claude transforms markdown agent definitions into GitHub Actions workflows powered by Claude AI. This section explains the fundamental concepts you need to understand to build effective agents.

## Learning Path

Start with the concept that matches where you are in your journey:

| Concept | Description | Start Here If... |
|---------|-------------|------------------|
| [How It Works](how-it-works/) | Complete pipeline overview from markdown to running workflow | You're new to gh-claude and want to understand the big picture |
| [Agent Definition](agent-definition/) | Markdown format and frontmatter configuration | You want to create your first agent |
| [Permissions](permissions/) | GitHub permissions and access control | You need to configure what your agent can do |
| [Authentication](authentication/) | Claude API and GitHub App setup | You're setting up authentication for your agents |

## How Components Connect

gh-claude follows a simple three-stage pipeline:

```
1. Parser          2. Generator        3. GitHub Actions
┌──────────┐      ┌──────────────┐    ┌────────────────┐
│ Markdown │ ---> │ Workflow YAML│ -> │ Running Agent  │
│  Agent   │      │    File      │    │   in Cloud     │
└──────────┘      └──────────────┘    └────────────────┘
```

**Stage 1: Parser**
- Reads your markdown files from `.github/claude-agents/`
- Extracts YAML frontmatter (name, triggers, permissions, outputs)
- Validates configuration against schemas
- Catches errors before deployment

**Stage 2: Generator**
- Converts agent definitions to GitHub Actions workflow YAML
- Adds safety checks (authorization, rate limiting, validation)
- Configures Claude execution environment
- Sets up output handlers for agent actions

**Stage 3: GitHub Actions**
- Runs workflows when triggers fire (issues, PRs, schedule)
- Executes pre-flight security checks
- Invokes Claude with your instructions and repository context
- Executes validated outputs (comments, labels, PRs)

## Quick Start Workflow

The typical workflow for creating and deploying an agent:

1. **Initialize** your repository with `gh claude init`
2. **Configure authentication** with `gh claude setup-token`
3. **Write an agent** in `.github/claude-agents/my-agent.md`
4. **Validate** with `gh claude validate my-agent.md`
5. **Compile** to workflow with `gh claude compile my-agent.md`
6. **Deploy** by committing and pushing to GitHub

## Core Components

### Agent Definition

The heart of gh-claude - a markdown file with YAML frontmatter:

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

Analyze new issues and categorize them...
```

**Learn more:** [Agent Definition](agent-definition/)

### Triggers

Events that activate your agent:

- **Issues**: opened, labeled, commented
- **Pull Requests**: opened, review requested
- **Schedule**: cron-based periodic execution
- **Manual**: workflow_dispatch for on-demand runs

**Learn more:** [Triggers Overview](../triggers/)

### Permissions

Control what your agent can access:

- `contents: read` - Read repository files
- `issues: write` - Create/comment on issues
- `pull_requests: write` - Create/review PRs
- `discussions: write` - Create/comment on discussions

**Learn more:** [Permissions](permissions/)

### Outputs

Actions your agent can take:

- `add-comment` - Post comments on issues/PRs
- `add-label` / `remove-label` - Manage labels
- `create-issue` - Create new issues
- `create-pr` - Submit pull requests
- `update-file` - Modify repository files

**Learn more:** [Outputs Overview](../outputs/)

### Inputs

Data collection for scheduled/batch agents:

- Collect recent issues, PRs, discussions, commits
- Filter by time range (last hour, day, week)
- Skip execution if minimum items not met
- Format as markdown for Claude to analyze

**Learn more:** [Inputs Overview](../inputs/)

## When to Use Each Feature

### Event-Driven Agents

**Use when:** You want immediate responses to GitHub activity

**Common patterns:**
- Issue triage when issues are opened
- PR review when pull requests are created
- Welcome messages for new contributors

**Example:** [Issue Triage](../examples/issue-triage/)

### Scheduled Agents

**Use when:** You want periodic analysis or summaries

**Common patterns:**
- Daily/weekly activity summaries
- Stale issue cleanup
- Progress reports

**Example:** [Daily Summary](../examples/daily-summary/)

### Read-Only vs Interactive

**Read-only agents** (no outputs):
- Analyze without taking action
- Log results in workflow logs
- Useful for monitoring and reports

**Interactive agents** (with outputs):
- Take actions based on analysis
- Comment, label, create issues/PRs
- Useful for automation

## Security Model

gh-claude includes multiple security layers:

1. **Pre-flight validation**
   - User authorization (admin/write/allowed list)
   - Required label checks
   - Rate limiting

2. **Execution sandboxing**
   - Claude runs in read-only mode by default
   - Output validation before execution
   - GitHub permissions enforced

3. **Audit trail**
   - All actions logged in GitHub Actions
   - Failed validations reported
   - Transparent operation

**Learn more:** [Security Best Practices](../reference/security/)

## Next Steps

**New to gh-claude?**
1. Read [How It Works](how-it-works/) for the complete picture
2. Try [Quick Start](../getting-started/quick-start/) to build your first agent
3. Explore [Examples](../examples/issue-triage/) to see real agents

**Ready to build?**
1. Learn the [Agent Definition](agent-definition/) format
2. Configure [Permissions](permissions/) for your use case
3. Set up [Authentication](authentication/) for your repository

**Need help?**
- [Troubleshooting Guide](troubleshooting/)
- [FAQ](../reference/faq/)
- [GitHub Discussions](https://github.com/lucasilverentand/gh-claude/discussions)
