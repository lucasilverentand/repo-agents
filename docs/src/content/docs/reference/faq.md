---
title: Frequently Asked Questions
description: Common questions about gh-claude
---

Find answers to frequently asked questions about gh-claude.

## General Questions

### What is gh-claude?

gh-claude is a GitHub CLI extension that transforms natural language markdown files into GitHub Actions workflows powered by Claude AI. Instead of writing complex YAML configurations, you write simple markdown instructions and gh-claude compiles them into executable workflows.

### How much does this cost?

gh-claude itself is free and open-source. However, you'll incur costs from:

**Anthropic API Usage:**
- Charged per token (input + output)
- Pricing varies by model (Haiku is cheapest, Opus is most expensive)
- See [Anthropic Pricing](https://www.anthropic.com/pricing) for current rates

**Typical costs:**
- Simple issue triage: ~$0.01-0.05 per run
- PR review: ~$0.05-0.20 per run
- Daily reports: ~$0.10-0.50 per run

**Cost control strategies:**
- Use smaller models (Haiku instead of Sonnet)
- Reduce `max_tokens` in configuration
- Increase `rate_limit_minutes` to prevent frequent runs
- Use `min_items` in inputs to skip runs when there's no activity
- Set output limits to prevent excessive API calls

### What Claude models are supported?

gh-claude supports all Claude models available via the Anthropic API:

**Recommended:**
- `claude-3-5-sonnet-20241022` (default) - Best balance of capability and cost

**Available:**
- `claude-3-opus-20240229` - Most capable, highest cost
- `claude-3-haiku-20240307` - Fastest, lowest cost

Specify in agent frontmatter:

```yaml
claude:
  model: claude-3-haiku-20240307  # Use Haiku for cost savings
```

Or set a default in `.github/claude.yml`:

```yaml
claude:
  model: claude-3-5-sonnet-20241022
```

### Can agents run on private repositories?

Yes, gh-claude works on both public and private repositories. The agent runs as a GitHub Actions workflow using your repository's `GITHUB_TOKEN` and your `ANTHROPIC_API_KEY`.

**Requirements:**
- GitHub Actions must be enabled for the repository
- You must set the `ANTHROPIC_API_KEY` repository secret
- For organization repositories, Actions permissions must allow workflows

**Privacy:**
- Repository data is sent to Anthropic's API for processing
- Review [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy)
- Consider security implications before using on sensitive repositories

### What's the difference between this and GitHub Copilot?

**GitHub Copilot:**
- IDE-integrated code completion
- Helps individual developers write code
- Works in your local editor
- Subscription-based pricing

**gh-claude:**
- Automated repository workflows
- Responds to GitHub events (issues, PRs, etc.)
- Runs in GitHub Actions
- Pay-per-use API pricing
- Can perform repository actions (comment, label, create PRs)

They serve different purposes and can be used together.

## Security and Permissions

### How do I limit API costs?

Use multiple strategies:

**1. Rate limiting:**

```yaml
rate_limit_minutes: 60  # Max one run per hour
```

**2. Input thresholds:**

```yaml
inputs:
  issues:
    limit: 20
  min_items: 5  # Skip if fewer than 5 items
```

**3. Output constraints:**

```yaml
outputs:
  add_comment: { max: 1 }  # Only one comment per run
```

**4. Use cheaper models:**

```yaml
claude:
  model: claude-3-haiku-20240307
  max_tokens: 2048
```

**5. Narrow triggers:**

```yaml
on:
  issues:
    types: [opened]  # Only new issues, not all changes
trigger_labels:
  - ai-review  # Only when labeled
```

**6. Monitor usage:**

Check Anthropic Console regularly to track spending.

### Can agents commit code?

Yes, agents can modify files and create commits when configured with:

```yaml
permissions:
  contents: write
allowed_paths:
  - docs/**
  - README.md
outputs:
  update_file: { sign: true }
```

**Important security considerations:**

- Use `allowed_paths` to restrict which files can be modified
- Consider using `create_pr` instead of direct commits
- Review generated changes in PRs before merging
- Use commit signing (`sign: true`) for audit trail
- Test thoroughly before enabling on production branches

**Best practice:**

```yaml
outputs:
  create_pr: { sign: true, max: 1 }  # Create PR instead of direct commit
```

This allows manual review before changes are merged.

### What happens if an agent misbehaves?

gh-claude has multiple safety mechanisms:

**Prevention:**
- Explicit permission requirements
- Output validation and limits
- Path restrictions for file modifications
- User authorization checks
- Rate limiting

**Detection:**
- All actions logged in GitHub Actions
- Git history tracks all changes
- Workflow runs visible in Actions tab

**Remediation:**
- Disable workflow: Go to Actions > select workflow > "..." > "Disable workflow"
- Revert changes: Use git to revert any problematic commits
- Update agent: Fix the agent definition and recompile
- Revoke access: Remove `ANTHROPIC_API_KEY` secret

**Example - disable a workflow:**

```bash
# Delete the workflow file
git rm .github/workflows/claude-problematic-agent.yml
git commit -m "Disable problematic agent"
git push
```

### Who can trigger agents?

By default, agents can be triggered by:

1. Repository administrators
2. Users with write access
3. Organization members (for org repositories)

**Restrict to specific users:**

```yaml
allowed_actors:
  - trusted-user-1
  - trusted-user-2
```

**Restrict to team members:**

```yaml
allowed_teams:
  - core-team
  - maintainers
```

**Public repositories:**

Without restrictions, any contributor with write access can trigger agents. Use `allowed_actors` or `allowed_teams` to restrict access.

## Usage and Configuration

### How do I update an existing agent?

1. **Edit the agent markdown file:**

```bash
vim .github/claude-agents/my-agent.md
```

2. **Recompile the workflow:**

```bash
gh claude compile my-agent.md
# or compile all agents
gh claude compile --all
```

3. **Commit and push:**

```bash
git add .github/
git commit -m "Update my-agent configuration"
git push
```

The updated workflow takes effect immediately for new triggers.

### Should I use a GitHub App for my agents?

It depends on your use case. A GitHub App is **optional** but provides valuable benefits:

**Use a GitHub App when:**
- Your agents create pull requests that need to trigger CI workflows
- You want branded identity (e.g., "MyApp[bot]" instead of "github-actions[bot]")
- You're deploying agents across multiple repositories
- You need fine-grained permission control

**The default GITHUB_TOKEN is sufficient when:**
- Your agents only comment, label, or close issues/PRs
- You're just getting started or testing
- You don't need CI triggering on created PRs
- You don't require custom branding

**To set up a GitHub App:**

```bash
gh claude setup-app
```

This command guides you through creating and configuring a GitHub App, including:
- Setting up required permissions
- Generating and storing credentials
- Installing the app on your repositories

After setup, recompile your agents:

```bash
gh claude compile --all
```

**Key benefits explained:**

1. **CI Triggering**: The default `GITHUB_TOKEN` cannot trigger workflows (GitHub security feature). If your agent creates a PR with code changes, you typically want CI to run. A GitHub App token can trigger workflows.

2. **Branded Identity**: Commits and comments appear as your app name (e.g., "CodeReviewer[bot]") instead of the generic "github-actions[bot]". This looks more professional and makes it clear which automation performed the action.

3. **Cross-repository**: Install once on your org, use across all repos. The default `GITHUB_TOKEN` is repo-specific.

**[→ See full setup guide](../../cli/setup-app/)**

### Can multiple agents run on the same trigger?

Yes, you can have multiple agents that respond to the same event:

**Example - Two issue agents:**

`.github/claude-agents/issue-triage.md`:
```yaml
on:
  issues:
    types: [opened]
```

`.github/claude-agents/issue-labeler.md`:
```yaml
on:
  issues:
    types: [opened]
```

Both will run independently when an issue is opened.

**Best practices:**

- Use different agent names to avoid conflicts
- Consider using `trigger_labels` to separate responsibilities
- Set appropriate rate limits to avoid duplicate work
- Use output limits to prevent spam

**Coordinated example:**

```yaml
# First agent adds initial label
on:
  issues:
    types: [opened]
outputs:
  add_label: true

# Second agent only processes labeled issues
on:
  issues:
    types: [labeled]
trigger_labels:
  - triaged
```

### What are the rate limits?

**gh-claude rate limits:**

Default: 5 minutes between runs per agent (configurable)

```yaml
rate_limit_minutes: 5  # Customize per agent
```

**Anthropic API rate limits:**

Vary by account tier. Check [Anthropic Console](https://console.anthropic.com/) for your limits.

Typical limits:
- Requests per minute
- Tokens per minute
- Tokens per day

**GitHub API rate limits:**

- 5,000 requests per hour for authenticated requests
- Generally not a concern for typical agent usage

**Input collection limits:**

```yaml
inputs:
  issues:
    limit: 100    # Max 1000 per input type
  pull_requests:
    limit: 100
```

Higher limits increase API usage and processing time.

### How do I see what Claude did?

**View workflow execution:**

1. Go to repository Actions tab
2. Click on the workflow run
3. Expand the "claude-agent" job
4. Look for "Run Claude agent" step

**Read Claude's output:**

The logs show:
- Claude's analysis and reasoning
- Generated outputs (comments, labels, etc.)
- Any errors or warnings

**View generated actions:**

Check the "execute-outputs" job to see:
- Comments posted
- Labels added
- Issues created
- Files modified

**Example log output:**

```
Running Claude agent...
Analyzing issue #123: "Bug in login form"

Analysis:
- Issue type: bug
- Priority: high
- Requires more information

Outputs:
- Adding labels: bug, priority:high
- Creating comment: "Thanks for the bug report..."
```

### Can I test agents without committing workflows?

Yes, use the dry-run feature:

**Preview compiled workflow:**

```bash
gh claude compile --dry-run my-agent.md
```

This shows the generated YAML without creating files.

**Validate before compiling:**

```bash
gh claude validate --all --strict
```

This checks for errors without generating workflows.

**Test in a separate branch:**

```bash
git checkout -b test-agent
gh claude compile --all
git add .github/
git commit -m "Test agent workflow"
git push -u origin test-agent
```

Test in the branch, then merge to main when satisfied.

**Manual workflow testing:**

Add `workflow_dispatch` trigger:

```yaml
on:
  issues:
    types: [opened]
  workflow_dispatch:  # Enable manual triggering
```

Then manually trigger from Actions tab to test without waiting for events.

## Technical Questions

### How does the workflow structure work?

gh-claude generates a multi-job workflow:

**1. pre-flight job:**
- Validates secrets (API key)
- Checks user authorization
- Verifies trigger labels (if configured)
- Enforces rate limiting
- Outputs: `should-run: true/false`

**2. collect-inputs job (optional):**
- Runs if agent has `inputs:` configuration
- Collects data from GitHub API
- Filters by time and criteria
- Outputs: `has-inputs: true/false`, `inputs-data`

**3. claude-agent job:**
- Runs if pre-flight passed (and inputs collected if needed)
- Installs Claude Code CLI
- Prepares context with event data and collected inputs
- Executes Claude with agent instructions
- Generates output files

**4. execute-outputs job (optional):**
- Runs if agent has `outputs:` configuration
- Validates output files
- Executes GitHub API operations
- Posts comments, adds labels, creates issues, etc.

**5. report-results job (optional):**
- Summarizes actions taken
- Reports any errors

### What tools does Claude have access to?

By default, agents have access to:

**File operations:**
- `Read` - Read repository files
- `Glob` - Find files by pattern
- `Grep` - Search file contents

**Git operations:**
- `Bash(git*)` - Git commands (read-only unless `contents: write`)

**GitHub operations:**
- `Bash(gh*)` - GitHub CLI commands

**Context provided:**
- GitHub event details (issue/PR content, etc.)
- Repository metadata
- Collected inputs (if configured)

**Restricted operations:**

Claude cannot directly:
- Execute arbitrary bash commands (sandboxed)
- Access network beyond GitHub API
- Modify files outside `allowed_paths`
- Perform actions not in `outputs` configuration

All actions go through validated output handlers.

### How is context passed to Claude?

The workflow creates a context file with:

**Standard context:**

```
GitHub Event: issues
Repository: owner/repo
Trigger: opened

Issue: #123
Title: Bug report
Author: username
Body: [issue description]
```

**Collected inputs (if configured):**

```
# Collected Issues

## Issue #120 - Feature request
Author: user1
State: open
Labels: feature, enhancement
...

## Issue #119 - Bug report
Author: user2
State: closed
...
```

**Agent instructions:**

Your markdown content is appended to provide instructions for analysis.

**Context is then passed to:**

```bash
claude -p "$(cat /tmp/context.txt)" --allowedTools "Bash(git*),Bash(gh*),Read,Glob,Grep"
```

### Can I customize the generated workflow?

**Not recommended.** The workflow is auto-generated from your agent definition. Manual changes will be overwritten when you recompile.

**Instead:**

1. **Modify the agent markdown** and recompile
2. **Request features** if you need capabilities not currently supported
3. **Use workflow_dispatch inputs** for parameterization:

```yaml
on:
  workflow_dispatch:
    inputs:
      priority:
        description: 'Priority level'
        required: false
        type: choice
        options:
          - high
          - medium
          - low
```

4. **Combine with other workflows** using workflow dependencies

### How do scheduled agents work?

Scheduled agents use cron syntax:

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays at 9 AM UTC
```

**Best practices:**

1. **Always use inputs** to collect data:

```yaml
on:
  schedule:
    - cron: '0 17 * * *'  # Daily at 5 PM
inputs:
  issues:
    states: [open, closed]
  pull_requests:
    states: [all]
  since: last-run
  min_items: 1  # Skip if no activity
```

2. **Set appropriate rate limits:**

```yaml
rate_limit_minutes: 60  # Prevent multiple runs
```

3. **Use output limits:**

```yaml
outputs:
  create_issue: { max: 1 }  # One report per run
```

**Common schedules:**

```yaml
# Daily at midnight UTC
- cron: '0 0 * * *'

# Weekdays at 9 AM UTC
- cron: '0 9 * * 1-5'

# Every Monday at 10 AM UTC
- cron: '0 10 * * 1'

# Every hour
- cron: '0 * * * *'
```

### What happens if Claude returns invalid output?

The workflow has validation:

**Output validation:**
- Checks JSON format
- Validates required fields
- Enforces output limits
- Verifies allowed operations

**If validation fails:**
- Error logged in workflow run
- GitHub operation skipped
- Workflow marked as failed
- No partial execution

**Common causes:**

1. **Unclear instructions** - Claude doesn't know what format to use
2. **Low temperature** - Too deterministic, might miss instructions
3. **Insufficient context** - Claude lacks information to generate valid output
4. **Token limits** - Response cut off mid-generation

**Solutions:**

1. **Provide clear examples** in instructions:

```markdown
Generate outputs in this exact format:

{
  "body": "Your comment text here",
  "labels": ["bug", "needs-triage"]
}
```

2. **Increase temperature** for more creative adherence:

```yaml
claude:
  temperature: 0.7
```

3. **Increase max_tokens:**

```yaml
claude:
  max_tokens: 4096
```

### Can I use environment variables or secrets?

**Secrets:**

Agents automatically have access to:
- `ANTHROPIC_API_KEY` - Your API key (required)
- `GITHUB_TOKEN` - GitHub authentication (automatic)

**Additional secrets:**

Not directly accessible by Claude for security reasons. However, you can:

1. **Use in workflow_dispatch inputs:**

```yaml
on:
  workflow_dispatch:
    inputs:
      api_endpoint:
        description: 'API endpoint'
```

2. **Store in repository variables** (not secrets) for non-sensitive data

**Environment variables:**

The workflow provides:
- `GITHUB_REPOSITORY` - Repository name
- `GITHUB_ACTOR` - User who triggered
- `GITHUB_EVENT_NAME` - Event type
- Standard GitHub Actions variables

### How do I handle errors in agent instructions?

Claude can't execute conditional logic based on errors, but you can:

**1. Provide fallback instructions:**

```markdown
If the issue is unclear, ask for clarification instead of categorizing it.

If you cannot determine priority, label it as "needs-triage".
```

**2. Use graceful degradation:**

```markdown
Try to identify the issue type. If you're not confident, add only the "needs-review" label and leave a comment asking for more details.
```

**3. Set conservative output limits:**

```yaml
outputs:
  add_comment: { max: 1 }  # Prevents spam if confused
```

**4. Use validation in instructions:**

```markdown
Before adding labels, verify:
1. The issue has a clear description
2. You understand the request
3. The category is obvious

If any check fails, only add "needs-information" label.
```

## Getting Started

### What's the quickest way to get started?

1. **Install gh-claude:**

```bash
gh extension install lucasilverentand/gh-claude
```

2. **Initialize in your repository:**

```bash
cd your-repo
gh claude init --examples
```

3. **Set API key:**

```bash
gh secret set ANTHROPIC_API_KEY
```

4. **Compile and deploy:**

```bash
gh claude compile --all
git add .github/
git commit -m "Add Claude agents"
git push
```

5. **Test:** Open an issue and watch your agent respond!

### Where can I find examples?

**Included examples:**

```bash
gh claude init --examples
ls .github/claude-agents/examples/
```

**Documentation examples:**

- [Issue Triage](../../examples/issue-triage/)
- [PR Review](../../examples/pr-review/)
- [Daily Summary](../../examples/daily-summary/)

**Generated workflows:**

After compiling, check `.github/workflows/` to see the generated YAML.

### What if I get stuck?

1. **Check troubleshooting guide:** [Troubleshooting](../../guide/troubleshooting/)
2. **Validate your agent:** `gh claude validate --all --strict`
3. **Review documentation:**
   - [Agent Definition](../../guide/agent-definition/)
   - [Outputs](../../guide/outputs/)
   - [Triggers](../../triggers/)
4. **Search issues:** [GitHub Issues](https://github.com/lucasilverentand/gh-claude/issues)
5. **Ask for help:** Open an issue with your configuration and logs

## Related Resources

- [Installation Guide](../../getting-started/installation/)
- [Quick Start](../../getting-started/quick-start/)
- [Troubleshooting](../../guide/troubleshooting/)
- [Security Best Practices](../security/)
- [Configuration Reference](../configuration/)
