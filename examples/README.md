# Example Claude Agents

This directory contains example agent definitions that demonstrate various use cases for Repo Agents.

## Available Examples

### 1. Issue Triage (`issue-triage.md`)

**Purpose**: Automatically categorize and label new issues

**Triggers**: When issues are opened

**Actions**:
- Categorizes as bug/feature/documentation/question
- Assigns priority labels
- Welcomes contributors with helpful comments

**Use Case**: Save time on initial issue triage, ensure consistent labeling

---

### 2. PR Review (`pr-review.md`)

**Purpose**: Provide initial code review feedback on pull requests

**Triggers**: When PRs are opened or updated

**Actions**:
- Analyzes changes
- Checks for missing tests or documentation
- Identifies breaking changes
- Adds helpful labels

**Use Case**: Get instant initial feedback, surface common issues early

---

### 3. Daily Summary (`daily-summary.md`)

**Purpose**: Generate daily repository activity summaries

**Triggers**: Scheduled daily at 5pm UTC (configurable)

**Actions**:
- Creates issue with activity summary
- Lists new/closed issues and PRs
- Highlights notable events
- Recognizes contributors

**Use Case**: Keep team informed, track activity trends

---

### 4. Stale Issue Manager (`stale-issues.md`)

**Purpose**: Manage inactive issues automatically

**Triggers**: Scheduled weekly (Monday mornings)

**Actions**:
- Identifies inactive issues
- Adds "stale" label with warning
- Closes issues after extended inactivity
- Preserves critical/security issues

**Use Case**: Keep issue tracker clean, reduce clutter

---

## Using These Examples

### Quick Start

1. Copy an example to your repository:
   ```bash
   cp examples/issue-triage.md .github/agents/
   ```

2. Customize the instructions to match your needs

3. Compile to workflow:
   ```bash
   repo-agents compile .github/agents/issue-triage.md
   ```

4. Commit and push:
   ```bash
   git add .github/
   git commit -m "Add issue triage agent"
   git push
   ```

### Customization Tips

#### Adjusting Triggers

Change when the agent runs:

```yaml
# Run on specific issue events
on:
  issues:
    types: [opened, labeled, edited]

# Run on schedule
on:
  schedule:
    - cron: '0 9 * * *'  # 9am daily

# Allow manual triggering
on:
  workflow_dispatch:
```

#### Modifying Permissions

Grant only the permissions needed:

```yaml
permissions:
  issues: write          # Can comment, label, close issues
  pull_requests: write   # Can comment, label, close PRs
  contents: read         # Can read repository files
  discussions: write     # Can comment on discussions
```

#### Changing Outputs

Control what actions the agent can perform:

```yaml
outputs:
  - add-comment       # Comment on issues/PRs
  - add-label         # Add labels
  - remove-label      # Remove labels
  - create-issue      # Create new issues
  - create-pr         # Create pull requests
  - update-file       # Modify files
  - close-issue       # Close issues
  - close-pr          # Close PRs
```

#### Adjusting Claude Configuration

Fine-tune the AI model:

```yaml
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096        # Longer for detailed responses
  temperature: 0.7       # Higher = more creative, Lower = more deterministic
```

### Combining Examples

You can use multiple agents together:

```
.github/agents/
├── issue-triage.md       # Handles new issues
├── pr-review.md          # Reviews pull requests
├── daily-summary.md      # Daily activity report
└── stale-issues.md       # Cleanup inactive issues
```

Each agent operates independently but can complement each other.

## Best Practices

### 1. Start Simple

Begin with one agent (like issue-triage) and expand as you get comfortable.

### 2. Test with Dry Run

Before committing, test compilation:

```bash
repo-agents compile --dry-run your-agent.md
```

### 3. Monitor Initial Runs

Watch the first few executions to ensure the agent behaves as expected.

### 4. Iterate on Instructions

Refine the markdown instructions based on agent behavior. The instructions are the "prompt" to Claude.

### 5. Use Specific Labels

Define clear labels in your repository that match what agents will use:
- `bug`, `feature`, `documentation`, `question`
- `priority: high`, `priority: medium`, `priority: low`
- `needs-tests`, `breaking-change`

### 6. Set Appropriate Schedules

For scheduled agents:
- Daily summaries: Evening after work hours
- Stale issue cleanup: Once weekly
- Avoid running during peak contribution times

## Troubleshooting

### Agent Not Responding

1. Check workflow exists in `.github/workflows/`
2. Verify repository Actions are enabled
3. Confirm `ANTHROPIC_API_KEY` secret is set
4. Review workflow run logs in Actions tab

### Unexpected Behavior

1. Review the agent's instructions
2. Check the Claude model being used
3. Adjust temperature (lower = more consistent)
4. Add more specific examples in instructions

### Permission Errors

Ensure the frontmatter includes necessary permissions:

```yaml
permissions:
  issues: write  # Required for commenting on issues
```

## Advanced Examples

### Custom Response Format

You can instruct Claude to use any output format. The examples use JSON in code blocks:

```markdown
Use this format:

ADD_COMMENT:
```json
{
  "body": "comment text"
}
```
```
```

### Context-Aware Agents

Agents receive full GitHub context including:
- Issue/PR title and body
- Author information
- Labels
- Comments (in some cases)

Use this in your instructions:

```markdown
If the issue author is a first-time contributor, give extra encouragement.
If the issue has the "good first issue" label, mention it's beginner-friendly.
```

### Multi-Action Responses

Agents can perform multiple actions in one run:

```markdown
For each new issue:
1. Add appropriate category label
2. Add priority label
3. Add a welcoming comment
```

## Contributing Examples

Have a great agent example? We'd love to include it!

1. Create the agent markdown file
2. Test it thoroughly
3. Document its purpose and behavior
4. Submit a pull request

## Support

- Report issues: https://github.com/yourusername/Repo Agents/issues
- Discussions: https://github.com/yourusername/Repo Agents/discussions
- Documentation: https://github.com/yourusername/Repo Agents

---

**Note**: All examples are templates. Customize them for your repository's specific needs and workflows.
