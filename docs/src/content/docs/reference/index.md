---
title: Reference
description: Technical reference documentation
---

This section provides quick-lookup reference documentation for gh-claude configuration, syntax, and technical details. For learning-focused content with explanations and examples, see the [Core Concepts](../guide/) guides.

## About Reference Documentation

**Reference vs Guides:**
- **Reference**: Quick lookup, syntax tables, configuration options, technical specs
- **Guides**: Learning-focused explanations, how-to content, conceptual overviews

Use reference documentation when you know what you're looking for and need to quickly check syntax, options, or best practices.

## Available References

| Reference | Use When... | Key Contents |
|-----------|-------------|--------------|
| [Quick Reference](quick-reference/) | You need to look up syntax quickly | All configuration fields, trigger syntax, output options, permission requirements |
| [Configuration](configuration/) | You're configuring repository settings | Complete frontmatter schema, field descriptions, validation rules |
| [Security](security/) | You need security best practices | Authorization models, permission scoping, secret management, audit logging |
| [FAQ](faq/) | You have a specific question | Common questions, troubleshooting tips, quick answers |

## Quick Lookup Tables

### Common Configuration Fields

| Field | Required | Type | Purpose |
|-------|----------|------|---------|
| `name` | Yes | string | Agent workflow name |
| `on` | Yes | object | Trigger configuration |
| `permissions` | No | object | GitHub permissions |
| `outputs` | No | object | Allowed agent actions |
| `inputs` | No | object | Data collection config |

**See [Configuration](configuration/) for complete field reference**

### Permission Scopes

| Permission | Level | Grants Access To |
|------------|-------|------------------|
| `contents: read` | Read | Repository files, commits |
| `contents: write` | Write | Create/modify files, commits |
| `issues: read` | Read | View issues |
| `issues: write` | Write | Create/comment on issues, manage labels |
| `pull_requests: read` | Read | View PRs |
| `pull_requests: write` | Write | Create/comment on PRs, request reviews |
| `discussions: read` | Read | View discussions |
| `discussions: write` | Write | Create/comment on discussions |

**See [Quick Reference](quick-reference/#permissions) for complete permissions table**

### Output Types

| Output | Required Permission | Purpose |
|--------|---------------------|---------|
| `add-comment` | `issues: write` or `pull_requests: write` | Post comments |
| `add-label` | `issues: write` or `pull_requests: write` | Add labels |
| `remove-label` | `issues: write` or `pull_requests: write` | Remove labels |
| `create-issue` | `issues: write` | Create new issues |
| `create-pr` | `contents: write`, `pull_requests: write` | Create pull requests |
| `create-discussion` | `discussions: write` | Create discussions |
| `update-file` | `contents: write` | Modify repository files |
| `close-issue` | `issues: write` | Close issues |
| `close-pr` | `pull_requests: write` | Close pull requests |

**See [Quick Reference](quick-reference/#outputs) for output constraints and options**

### Trigger Events

| Trigger | When It Fires | Common Use Cases |
|---------|---------------|------------------|
| `issues.opened` | New issue created | Issue triage, welcome messages |
| `issues.labeled` | Label added to issue | Specialized workflows per label |
| `pull_request.opened` | New PR created | PR review, code analysis |
| `discussion.created` | New discussion created | Q&A automation |
| `schedule` | Cron-based timing | Daily/weekly summaries, cleanup |
| `workflow_dispatch` | Manual trigger | On-demand analysis, testing |

**See [Triggers Overview](../triggers/) for complete trigger reference**

## When to Use Each Reference

### Quick Reference

**Best for:**
- Syntax lookups while writing agents
- Checking available options
- Quick verification of requirements

**Examples:**
- "What permissions does `create-pr` require?"
- "What's the syntax for schedule triggers?"
- "What output constraints are available?"

### Configuration

**Best for:**
- Understanding all configuration options
- Validation rules and requirements
- Field-by-field reference

**Examples:**
- "What are all the fields in the frontmatter?"
- "What values can `rate_limit_minutes` accept?"
- "Is `allowed-paths` required for `update-file`?"

### Security

**Best for:**
- Security best practices
- Authorization configuration
- Secret management
- Audit and compliance

**Examples:**
- "How do I restrict who can trigger agents?"
- "What's the principle of least privilege for permissions?"
- "How should I manage API keys?"
- "What gets logged in audit trails?"

### FAQ

**Best for:**
- Common questions and answers
- Troubleshooting specific issues
- Quick problem resolution

**Examples:**
- "Why isn't my agent running?"
- "How do I test agents before deploying?"
- "Can agents trigger on their own outputs?"
- "What are the rate limits?"

## Navigation Tips

### Finding Information Quickly

1. **Know what you need:**
   - Syntax → Quick Reference
   - Configuration details → Configuration
   - Security guidance → Security
   - Specific question → FAQ

2. **Use browser search:**
   - Press Ctrl+F (Cmd+F on Mac)
   - Search for specific terms
   - Navigate through matches

3. **Check related sections:**
   - References often cross-link
   - Follow links for deeper details
   - Return to hub for overview

### Common Lookup Patterns

**"I need to configure X"**
→ Start with [Configuration](configuration/)

**"How do I secure Y"**
→ Start with [Security](security/)

**"What's the syntax for Z"**
→ Start with [Quick Reference](quick-reference/)

**"Why is X not working"**
→ Start with [FAQ](faq/)

## Reference vs Guide Content

### Use Reference When:
- You know what you're looking for
- You need quick syntax verification
- You want a complete list of options
- You're checking requirements

### Use Guides When:
- You're learning a new concept
- You want explanations and context
- You need step-by-step instructions
- You're exploring what's possible

### Example Scenarios

**Scenario:** "I want to create my first agent"
- **Use:** [Core Concepts Guide](../guide/) and [Quick Start](../getting-started/quick-start/)
- **Then reference:** [Quick Reference](quick-reference/) for syntax

**Scenario:** "I need to add a new output type to existing agent"
- **Use:** [Quick Reference](quick-reference/#outputs) for available outputs
- **Then reference:** [Configuration](configuration/) for syntax

**Scenario:** "I want to restrict agent access"
- **Use:** [Security](security/) for authorization patterns
- **Then reference:** [Configuration](configuration/) for field syntax

## Related Documentation

### Learning Resources
- [Core Concepts](../guide/) - Conceptual overviews
- [Examples](../examples/) - Complete working examples
- [CLI Reference](../cli/) - Command-line tools

### External Resources
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Claude API Documentation](https://docs.anthropic.com/)
- [gh CLI Documentation](https://cli.github.com/manual/)

## Contributing to Reference

Found an error or missing information?

1. Open an issue: [Report documentation issue](https://github.com/lucasilverentand/gh-claude/issues/new)
2. Submit a PR: [Contribute to docs](https://github.com/lucasilverentand/gh-claude/tree/main/docs)
3. Ask in discussions: [GitHub Discussions](https://github.com/lucasilverentand/gh-claude/discussions)

## Next Steps

**Start looking things up:**
- [Quick Reference](quick-reference/) - Syntax and options
- [Configuration](configuration/) - Complete field reference
- [Security](security/) - Best practices
- [FAQ](faq/) - Common questions

**Return to learning:**
- [Core Concepts](../guide/) - Conceptual guides
- [Examples](../examples/) - Working examples
- [CLI Reference](../cli/) - Command usage
