---
title: Agent Definition
description: Learn how to define Claude agents with markdown and YAML frontmatter
---

Agents are defined using markdown files with YAML frontmatter. This format combines the simplicity of natural language instructions with structured configuration.

## Basic Structure

```markdown
---
# YAML frontmatter with configuration
name: Agent Name
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
---

# Agent Instructions

Your natural language instructions for Claude go here...
```

## Frontmatter Fields

### Required Fields

#### `name`

The display name for your agent. This will be used in the generated workflow file.

```yaml
name: Issue Triage Agent
```

#### `on`

Defines when the agent should run. At least one trigger is required.

```yaml
on:
  issues:
    types: [opened, edited]
```

See [Triggers](../../triggers/) for all available options.

### Optional Fields

#### `permissions`

GitHub permissions required by the agent. Available permissions:

- `contents`: read/write (for repository files)
- `issues`: read/write
- `pull_requests`: read/write (note: uses underscore)
- `discussions`: read/write

```yaml
permissions:
  issues: write
  pull_requests: write
```

Default: read-only access

#### `outputs`

Actions the agent is allowed to perform. See [Outputs](../outputs/) for details.

```yaml
outputs:
  add-comment: { max: 3 }
  add-label: true
```

#### `claude`

Claude model configuration:

```yaml
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7
```

Defaults from `.github/claude.yml` are used if not specified.

#### `allowed-actors`

Restrict agent to specific GitHub users:

```yaml
allowed-actors:
  - octocat
  - github-user
```

#### `allowed-teams`

Restrict agent to specific GitHub teams:

```yaml
allowed-teams:
  - maintainers
  - core-team
```

#### `allowed-paths`

File paths the agent can modify (required for `update-file` output):

```yaml
allowed-paths:
  - docs/**
  - README.md
  - .github/**
```

## Instructions Section

After the frontmatter, write natural language instructions for Claude:

```markdown
---
# frontmatter...
---

# Agent Instructions

You are a helpful issue triage agent. When analyzing issues:

1. Read the issue title and body carefully
2. Identify the type: bug, feature, documentation, or question
3. Assess priority based on severity and impact
4. Add appropriate labels
5. Write a welcoming comment

## Guidelines

- Be friendly and professional
- Ask for clarification if the issue is unclear
- Mention related issues if relevant
- Thank the contributor for their submission

## Examples

### Bug Report
If it's a bug, ask for:
- Steps to reproduce
- Expected vs actual behavior
- Environment details

### Feature Request
If it's a feature, consider:
- Use case and motivation
- Proposed solution
- Potential alternatives
```

## Best Practices

### Clear Instructions

Write specific, actionable instructions. Claude will follow your guidance.

**Good:**
```markdown
Categorize the issue as:
- `bug` - something is broken
- `feature` - new functionality request
- `docs` - documentation improvement
- `question` - user needs help
```

**Less effective:**
```markdown
Figure out what kind of issue this is.
```

### Examples in Instructions

Include examples of the expected behavior:

```markdown
## Example Comment

When welcoming a new contributor:

"Thanks for opening this issue! I've labeled it as a bug report based on the description.
Could you provide the steps to reproduce this issue?"
```

### Security Considerations

- Always specify `permissions` explicitly
- Use minimal required permissions
- Limit outputs with constraints (e.g., `max: 1`)
- Use `allowed-paths` for file modifications

## Complete Example

```markdown
---
name: PR Review Assistant
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
outputs:
  add-comment: { max: 1 }
  add-label: true
claude:
  model: claude-3-5-sonnet-20241022
  temperature: 0.3
---

# Pull Request Review Agent

Analyze the pull request and provide initial feedback.

## Tasks

1. **Summarize Changes**: Briefly describe what the PR does
2. **Check Tests**: Note if tests are missing or insufficient
3. **Breaking Changes**: Identify any breaking changes
4. **Code Style**: Mention significant style issues
5. **Labels**: Add appropriate labels (needs-tests, breaking-change, etc.)

## Review Guidelines

- Be constructive and encouraging
- Focus on significant issues, not nitpicks
- Suggest specific improvements when possible
- Acknowledge good practices

## Comment Format

Use this structure:

### Summary
[Brief description of changes]

### Observations
- [Key points about the implementation]

### Suggestions
- [Actionable feedback if any]

Keep the tone friendly and professional!
```

## Next Steps

- [Triggers](/gh-claude/triggers/) - When your agent runs
- [Outputs](/gh-claude/guide/outputs/) - What your agent can do
- [Examples](/gh-claude/examples/) - See complete agents

## See Also

- [Quick Reference](/gh-claude/reference/quick-reference/) - All frontmatter fields
- [Permissions](/gh-claude/guide/permissions/) - GitHub permission configuration
- [Security Best Practices](/gh-claude/guide/security-best-practices/) - Secure agent configuration
