---
title: Comments (add-comment)
description: Enable agents to post comments on issues and pull requests
---

The `add-comment` output enables your agent to post comments on GitHub issues and pull requests. Use this for providing feedback, asking clarifying questions, or automatically responding to repository activity.

## Configuration

### Simple Enable

Enable commenting without restrictions:

```yaml
outputs:
  add-comment: true
```

### With Options

Configure the maximum number of comments per run:

```yaml
outputs:
  add-comment: { max: 3 }
```

**Options:**
- `max` - Maximum number of comments the agent can post in a single run (default: unlimited)

## Usage Examples

### Single Comment Per Run

Prevents comment spam by limiting to one comment per agent execution:

```yaml
outputs:
  add-comment: { max: 1 }
```

This is the recommended setting for most use cases.

### Multiple Comments

Allow multiple comments when needed (useful for batch operations):

```yaml
outputs:
  add-comment: { max: 5 }
```

## Permission Requirements

The `add-comment` output does not require explicit GitHub permissions in the `permissions` section. Claude can post comments with default permissions.

## Best Practices for Comment Content

### 1. Keep Comments Focused

Post one clear point per comment rather than long, multi-topic posts:

```markdown
# Good - one concern per comment
First comment: "This implementation could benefit from error handling"

Second comment: "Consider adding unit tests for this edge case"

# Avoid - attempting to cover multiple topics
Comment: "This needs error handling AND unit tests AND documentation updates..."
```

### 2. Provide Context

Always explain why the comment is being posted:

```markdown
# Good - provides reasoning
The regex pattern `\d+` may not handle negative numbers. Consider using `[-\d]+` instead.

# Less helpful
Use a different regex.
```

### 3. Use Markdown Formatting

Format comments for readability:

```markdown
# Good - formatted for clarity
The following issues were detected:

- Variable `x` is never used on line 42
- Missing return statement in function `calculateTotal()`
- Possible null pointer dereference

Suggested fix: [link to documentation]

# Less helpful
there are issues: var x not used, missing return, null pointer
```

### 4. Link to Resources

Include relevant documentation or examples:

```markdown
According to [PEP 8](https://pep8.org/), function names should use snake_case.

Current: `getUserData()`
Suggested: `get_user_data()`
```

## Agent Configuration Examples

### Welcoming New Contributor Issues

```yaml
name: Welcome New Contributors
on:
  issues:
    types:
      - opened

outputs:
  add-comment: { max: 1 }

permissions:
  issues: read
```

**Agent Instructions:**
```markdown
When someone opens a new issue, welcome them to the project.
If the issue is vague, ask clarifying questions. Be friendly and helpful.
```

### Code Review Comments

```yaml
name: Automated Code Review
on:
  pull_request:
    types:
      - opened
      - synchronize

outputs:
  add-comment: { max: 3 }
```

**In your agent instructions:**
```markdown
Review the PR changes and look for:
- Security issues
- Performance concerns
- Code style inconsistencies

Post up to 3 constructive comments if issues are found.
```

### Status Updates

```yaml
name: Daily Status Updates
on:
  schedule:
    - cron: '0 9 * * MON'

outputs:
  add-comment: { max: 1 }

inputs:
  issues:
    since: 24h
```

**In your agent instructions:**
```markdown
Post a summary of new issues from the last 24 hours on pinned issue #1.
Include counts by label and urgent items.
```

## Common Use Cases

### Issue Triage
Automatically ask for more information on vague issues:
```yaml
outputs:
  add-comment: { max: 1 }
```

### Documentation Links
Post relevant documentation when specific labels are added:
```yaml
outputs:
  add-comment: { max: 1 }
```

### Thank You Comments
Thank contributors automatically:
```yaml
outputs:
  add-comment: { max: 1 }
```

### Automated Feedback
Provide consistent feedback (e.g., on code style):
```yaml
outputs:
  add-comment: { max: 5 }
```

## Security Considerations

### Rate Limiting

The `max` parameter prevents comment spam. Always use it:

```yaml
outputs:
  add-comment: { max: 1 }  # Recommended
```

Without a limit, a poorly designed agent could post unlimited comments.

### Sensitive Information

Be careful not to include sensitive data in comments:

```markdown
# Good - no sensitive info
The API request failed with a timeout error.

# Bad - includes sensitive details
The API request to https://api.internal.company.com/v2/accounts?token=secret_xyz failed.
```

### Comment Visibility

Comments are public - anything posted can be seen by anyone with repository access:

```markdown
# Remember: This is public
- Any configuration details
- Debug information
- Internal references
```

## Troubleshooting

### Comments Not Posting

Check that:
1. The `permissions` section grants appropriate access
2. The agent has logic to determine when to post comments
3. The `max` limit hasn't been reached

### Too Many Comments

If your agent posts more comments than expected:
1. Lower the `max` value
2. Review the agent logic to add conditions
3. Test with dry-run before deploying

## Related Outputs

- [Labels (add-label, remove-label)](./labels/) - Pair with comments for issue management
- [Issues (create-issue, close-issue)](./issues/) - For creating new issues
- [Pull Requests (create-pr, close-pr)](./pull-requests/) - For PR management

## Next Steps

- Learn about [Permissions](../../guide/permissions/)
- Explore [Labels output](./labels/)
- Review [Security Best Practices](../../reference/security/)
