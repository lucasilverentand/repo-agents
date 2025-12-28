---
title: Agent Examples
description: Learn from complete agent examples
---

These examples demonstrate how to build Claude agents for different use cases. Each example includes the complete agent definition, explanation of how it works, and what you can learn from it.

## Available Examples

| Example | Complexity | Trigger | Key Features | Best For |
|---------|-----------|---------|--------------|----------|
| [Issue Triage](issue-triage/) | Beginner | Issues opened | Labels, comments | Learning basics |
| [PR Review](pr-review/) | Intermediate | PRs opened | Code analysis, comments | Real automation |
| [Daily Summary](daily-summary/) | Advanced | Schedule | Inputs system, discussions | Analytics & reporting |

## Getting Started with Examples

### For Beginners

**Start here:** [Issue Triage](issue-triage/)

This example shows the fundamentals:
- How to respond to GitHub events (issue opened)
- Basic output operations (add label, add comment)
- Simple permission configuration
- Clear agent instructions

**What you'll learn:**
- Agent definition structure (frontmatter + markdown)
- Event triggers and permissions
- Output constraints (`max: 1`)
- Basic categorization logic

### For Intermediate Users

**Next step:** [PR Review](pr-review/)

This example adds complexity:
- Code analysis with repository file access
- More sophisticated Claude instructions
- Multiple output types
- Real-world automation use case

**What you'll learn:**
- Reading repository files for context
- Analyzing code changes
- Providing structured feedback
- Balancing helpfulness with constraints

### For Advanced Users

**Deep dive:** [Daily Summary](daily-summary/)

This example demonstrates advanced features:
- Scheduled execution (cron-based triggers)
- Input collection system (gathering recent data)
- Batch processing and analysis
- Creating discussions for reports

**What you'll learn:**
- Schedule triggers and cron syntax
- Collecting issues, PRs, and other data
- Time-based filtering (`since` field)
- Minimum item thresholds (`min_items`)
- Batch analysis and report generation

## Feature Comparison Matrix

Use this matrix to find examples demonstrating specific features:

| Feature | Issue Triage | PR Review | Daily Summary |
|---------|-------------|-----------|---------------|
| **Triggers** |
| Event-based (issues) | ✅ | ❌ | ❌ |
| Event-based (PRs) | ❌ | ✅ | ❌ |
| Schedule (cron) | ❌ | ❌ | ✅ |
| **Inputs** |
| Input collection | ❌ | ❌ | ✅ |
| Time filtering | ❌ | ❌ | ✅ |
| Min items threshold | ❌ | ❌ | ✅ |
| **Outputs** |
| add-comment | ✅ | ✅ | ❌ |
| add-label | ✅ | ✅ | ❌ |
| remove-label | ❌ | ❌ | ❌ |
| create-issue | ❌ | ❌ | ❌ |
| create-discussion | ❌ | ❌ | ✅ |
| create-pr | ❌ | ❌ | ❌ |
| **Permissions** |
| contents: read | ❌ | ✅ | ✅ |
| issues: write | ✅ | ❌ | ❌ |
| pull_requests: write | ❌ | ✅ | ❌ |
| discussions: write | ❌ | ❌ | ✅ |
| **Advanced Features** |
| Rate limiting | ✅ | ✅ | ✅ |
| User authorization | ❌ | ❌ | ❌ |
| Trigger labels | ✅ | ❌ | ❌ |
| File access | ❌ | ✅ | ✅ |

## Learning Progression

We recommend following this learning path:

### 1. Understand the Basics

**Start with:** [Issue Triage](issue-triage/)

**Goals:**
- Understand agent definition format
- Learn how triggers work
- See simple outputs in action
- Deploy your first agent

**Time:** 15-30 minutes

### 2. Explore Event-Driven Automation

**Move to:** [PR Review](pr-review/)

**Goals:**
- Learn to read repository files
- Understand code analysis patterns
- See more complex agent instructions
- Practice with different output types

**Time:** 30-45 minutes

### 3. Master Scheduled Agents

**Advance to:** [Daily Summary](daily-summary/)

**Goals:**
- Configure schedule triggers
- Use the inputs collection system
- Process batches of data
- Generate reports and summaries

**Time:** 45-60 minutes

## Common Patterns Across Examples

### Agent Structure

All examples follow the same basic structure:

```markdown
---
# Frontmatter: Configuration
name: Agent Name
on: { ... }
permissions: { ... }
outputs: { ... }
---

# Markdown: Instructions for Claude
Your agent instructions here...
```

### Security and Rate Limiting

All examples include:
- Permission declarations (principle of least privilege)
- Rate limiting to prevent abuse
- Clear output constraints

### Claude Instructions

All examples demonstrate:
- Clear task definition
- Project context
- Step-by-step instructions
- Expected output format

## Adapting Examples

### Customizing for Your Repository

Each example can be adapted:

1. **Change triggers**: Modify the `on` field for different events
2. **Adjust permissions**: Add/remove based on your needs
3. **Modify outputs**: Enable different actions
4. **Update instructions**: Tailor Claude's behavior

### Example Modifications

**Issue Triage → Bug Triage**
```yaml
# Only trigger on bug-labeled issues
on:
  issues:
    types: [labeled]
    labels: [bug]
```

**PR Review → Security Review**
```markdown
Focus specifically on security issues:
- SQL injection vulnerabilities
- XSS attack vectors
- Authentication bypasses
```

**Daily Summary → Weekly Digest**
```yaml
# Change from daily to weekly
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9 AM
```

## Testing Your Adaptations

After modifying an example:

```bash
# 1. Validate configuration
gh claude validate my-modified-agent.md

# 2. Compile to workflow
gh claude compile my-modified-agent.md

# 3. Review generated workflow
cat .github/workflows/claude-my-modified-agent.yml

# 4. Deploy and test
git add .github/
git commit -m "Add customized agent"
git push
```

## Example Use Cases by Industry

### Open Source Projects
- **Issue Triage**: Auto-label incoming issues
- **PR Review**: Provide initial code review feedback
- **Daily Summary**: Weekly contributor activity reports

### Enterprise Development
- **Issue Triage**: Route issues to correct teams
- **PR Review**: Enforce coding standards
- **Daily Summary**: Sprint progress reports

### Documentation Sites
- **Issue Triage**: Categorize documentation requests
- **PR Review**: Check for broken links
- **Daily Summary**: Track documentation coverage

## Next Steps

**Ready to build?**
1. Choose an example that matches your use case
2. Copy the agent definition to your repository
3. Modify for your specific needs
4. Test and deploy

**Need more help?**
- [Core Concepts](../guide/) - Understand how agents work
- [CLI Reference](../cli/) - Learn command-line tools
- [Troubleshooting](../guide/troubleshooting/) - Fix common issues

**Want to contribute?**
- Share your own examples in [GitHub Discussions](https://github.com/lucasilverentand/gh-claude/discussions)
- Submit new examples via pull request
- Help improve existing examples
