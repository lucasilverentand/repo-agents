---
title: Discussion Events
description: Respond to GitHub Discussions activity
---

Trigger your agent when discussions are created, answered, or otherwise modified in your repository.

## Basic Configuration

```yaml
on:
  discussion:
    types: [created]
```

## Available Event Types

- **`created`** - Discussion is created
- **`edited`** - Discussion title or body is modified
- **`deleted`** - Discussion is deleted
- **`transferred`** - Discussion is transferred to another repository
- **`pinned`** - Discussion is pinned
- **`unpinned`** - Discussion is unpinned
- **`labeled`** - Label is added to discussion
- **`unlabeled`** - Label is removed from discussion
- **`locked`** - Discussion is locked
- **`unlocked`** - Discussion is unlocked
- **`category_changed`** - Discussion category is changed
- **`answered`** - Discussion is marked as answered
- **`unanswered`** - Discussion answer is removed

## Common Use Cases

### Welcome Bot

Greet new community members:

```yaml
---
name: Discussion Welcome
on:
  discussion:
    types: [created]
permissions:
  discussions: write
---

Welcome new discussion participants:
1. Thank them for starting the discussion
2. Provide links to relevant resources
3. Encourage community engagement
```

### Q&A Assistant

Help answer common questions:

```yaml
---
name: Q&A Helper
on:
  discussion:
    types: [created, edited]
permissions:
  discussions: write
---

For Q&A discussions:
1. Analyze the question
2. Check if it matches common questions
3. Provide helpful links or suggest answers
4. Tag relevant team members if needed
```

### Category Router

Suggest better categories:

```yaml
---
name: Category Suggester
on:
  discussion:
    types: [created]
permissions:
  discussions: write
---

Analyze discussion content and suggest:
- Moving to a more appropriate category
- Converting to an issue if it's a bug report
- Linking to related discussions
```

### Auto-Labeling

Tag discussions based on content:

```yaml
---
name: Discussion Labeler
on:
  discussion:
    types: [created, edited]
permissions:
  discussions: write
---

Analyze discussion and add labels:
- 'question' for help requests
- 'idea' for feature proposals
- 'showcase' for sharing projects
- Topic-specific labels (e.g., 'api', 'ui', 'performance')
```

## Multiple Event Types

Listen to multiple events:

```yaml
on:
  discussion:
    types: [created, answered, category_changed]
```

## Available Data

When your agent runs, it has access to:

- **Discussion number** - via `${{ github.event.discussion.number }}`
- **Discussion title** - via `${{ github.event.discussion.title }}`
- **Discussion body** - via `${{ github.event.discussion.body }}`
- **Discussion author** - via `${{ github.event.discussion.user.login }}`
- **Discussion category** - via `${{ github.event.discussion.category.name }}`
- **Discussion state** - via `${{ github.event.discussion.state }}`

Access discussion details using the `gh` CLI:

```bash
# Get discussion details (requires gh extension)
gh api repos/${{ github.repository }}/discussions/${{ github.event.discussion.number }}
```

## Required Permissions

For read-only operations:

```yaml
permissions:
  discussions: read
```

For operations that modify discussions:

```yaml
permissions:
  discussions: write
```

See [Permissions](/guide/permissions/) for details.

## Rate Limiting

Discussions can be edited frequently. Use rate limiting:

```yaml
on:
  discussion:
    types: [edited]
rate_limit_minutes: 10  # Max once per 10 minutes
```

## Best Practices

### Be Welcoming

Discussions are community spaces. Be:
- Friendly and encouraging
- Patient with new users
- Helpful without being condescending

### Respect Categories

Different discussion categories serve different purposes:
- **Announcements** - Project updates
- **Q&A** - Questions seeking answers
- **Ideas** - Feature proposals
- **Show and tell** - Community showcases
- **General** - Open-ended discussions

Tailor your agent's behavior to the category.

### Don't Over-Automate

Discussions benefit from human interaction. Use agents to:
- Welcome new participants
- Route discussions to the right category
- Surface common questions
- **Not** to fully automate responses

### Handle Answered Discussions

When a discussion is marked as answered:

```yaml
on:
  discussion:
    types: [answered]
```

Consider:
- Thanking participants
- Suggesting related resources
- Encouraging knowledge sharing

## Examples

### FAQ Bot

```yaml
---
name: FAQ Assistant
on:
  discussion:
    types: [created]
permissions:
  discussions: write
---

Check if the discussion asks a common question:
1. Search discussion title and body for keywords
2. If FAQ match found:
   - Reply with link to documentation
   - Suggest marking as answered if helpful
3. If not a match, tag as 'needs-answer'
```

### Showcase Highlighter

```yaml
---
name: Showcase Bot
on:
  discussion:
    types: [created]
permissions:
  discussions: write
---

For discussions in "Show and tell" category:
1. Welcome the contributor
2. Encourage screenshots/demos
3. Suggest relevant tags
4. Pin exceptional showcases
```

### Stale Discussion Cleanup

```yaml
---
name: Stale Discussion Handler
on:
  schedule:
    - cron: '0 0 * * MON'  # Weekly on Mondays
permissions:
  discussions: write
---

Find stale unanswered Q&A discussions:
1. Check for discussions > 30 days old
2. No accepted answer
3. No recent activity
4. Add comment asking if still relevant
5. Consider closing very old discussions
```

## Discussion Categories

GitHub Discussions support different categories. Common ones include:

- **Announcements** - Project updates (usually restricted posting)
- **General** - Open-ended conversations
- **Ideas** - Feature requests and proposals
- **Polls** - Community voting
- **Q&A** - Questions and answers
- **Show and tell** - Community showcases

Access the category in your agent:

```bash
CATEGORY="${{ github.event.discussion.category.name }}"
```

## Next Steps

- Learn about [Issue triggers](/triggers/issues/)
- Understand [Permissions](/guide/permissions/)
- See more [Examples](/examples/)
