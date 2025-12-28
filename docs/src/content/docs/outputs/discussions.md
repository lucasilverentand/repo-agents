---
title: Discussions (create-discussion)
description: Enable agents to create GitHub discussions
---

The `create-discussion` output enables your agent to create discussions in GitHub Discussions. Use discussions for community engagement, announcements, and open-ended conversations that don't fit into the issue/PR workflow.

## Configuration

### Simple Enable

Enable discussion creation without restrictions:

```yaml
outputs:
  create-discussion: true
```

### With Options

Limit the maximum number of discussions created per run:

```yaml
outputs:
  create-discussion: { max: 1 }
```

**Options:**
- `max` - Maximum number of discussions the agent can create in a single run (default: unlimited)

## Permission Requirements

The `create-discussion` output requires `discussions: write` permission:

```yaml
permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }
```

### Full Configuration Example

```yaml
permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }
```

## Creating Discussions

### Single Discussion Per Run

Recommended limit to prevent excessive discussions:

```yaml
permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }
```

### Multiple Discussions

Allow creating multiple discussions when processing batches:

```yaml
permissions:
  discussions: write

outputs:
  create-discussion: { max: 5 }
```

**Use case:** Weekly summaries for different topics, announcements in different categories, etc.

### Discussion Structure

Create discussions with:
- **Title**: Clear, descriptive heading
- **Category**: Appropriate discussion category (Announcements, General, Ideas, Polls, Q&A, Show and tell)
- **Body**: Detailed content in markdown

```markdown
Title: "Weekly Community Digest - Week of Dec 13"

Category: Announcements

Body:
## This Week's Highlights

### New Features
- Released v2.5.0 with improved performance
- Added support for custom themes
- Enhanced mobile responsiveness

### Community Contributions
- 12 new PRs merged
- 5 issues resolved by community
- 3 new contributors

### Upcoming
- Hackathon planning for January
- Documentation review session
- Community call on Friday at 3pm EST

## Get Involved
Have updates to share? Comment below!
```

## Agent Configuration Examples

### Weekly Digest

```yaml
name: Weekly Community Digest
on:
  schedule:
    - cron: '0 9 * * MON'

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }

inputs:
  pull_requests:
    since: 7d
  issues:
    since: 7d
```

**In your agent instructions:**
```markdown
Create a weekly digest discussion:
- Title: "Weekly Digest - [Date]"
- Category: Announcements
- Include: PRs merged, issues opened/closed, top contributors, milestones
- Format with markdown headers and bullets

Only create if there was activity this week.
```

### Feature Announcements

```yaml
name: Release Announcements
on:
  release:
    types:
      - published

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }
```

**In your agent instructions:**
```markdown
When a release is published:
- Create discussion in "Announcements"
- Title: "[RELEASE] Version [number] - [Release Name]"
- Include: highlights, release notes link, breaking changes, migration guide
- Thank contributors

Keep it celebratory and encouraging.
```

### Q&A Promotion

```yaml
name: Promote Q&A Discussions
on:
  issues:
    types:
      - opened

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }
  add-comment: { max: 1 }

inputs:
  issues:
    since: 1h
```

**In your agent instructions:**
```markdown
When someone opens a question-type issue:
- Identify if it's a question (not bug/feature request)
- Create discussion in Q&A category with original question
- Link to the issue
- Comment on issue directing to the discussion
- Suggest closing the issue
```

### Community Ideas Forum

```yaml
name: Ideas Discussion Manager
on:
  schedule:
    - cron: '0 0 * * SUN'

permissions:
  discussions: write

outputs:
  create-discussion: { max: 3 }

inputs:
  issues:
    since: 7d
```

**In your agent instructions:**
```markdown
Find feature requests opened in the past week:
- Create discussion in "Ideas" category using issue title
- Include issue description with voting poll
- Poll options: Great idea / Interesting but not for me / Not a priority
- Link back to original issue

Create at most 3 discussions per week.
```

### Community Highlights

```yaml
name: Community Highlights
on:
  schedule:
    - cron: '0 10 * * FRI'

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }

inputs:
  pull_requests:
    since: 7d
```

**In your agent instructions:**
```markdown
Celebrate community contributions:
- Find PRs merged this week from external contributors
- Create discussion in "Show and tell"
- Title: "Community Contributions - Week of [date]"
- Include: contributor names, what they contributed (with PR links), thanks
- Encourage others to get involved

Keep it celebratory!
```

### Monthly Roadmap Update

```yaml
name: Monthly Roadmap
on:
  schedule:
    - cron: '0 9 1 * *'

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }

inputs:
  issues:
    since: 30d
```

**In your agent instructions:**
```markdown
On the first day of each month:
- Gather metrics: issues created/closed, PRs merged, features shipped, bug fixes
- Create discussion in "Announcements"
- Title: "Roadmap Update - [Month Year]"
- Include: last month review, this month plans, community feedback opportunity

Use professional but friendly tone.
```

## Use Cases

### Release Announcements
Announce new versions and features:
```yaml
outputs:
  create-discussion: { max: 1 }
```

### Weekly Digests
Summarize activity and highlight contributions:
```yaml
outputs:
  create-discussion: { max: 1 }
```

### Community Engagement
Promote discussions and ideas from issues:
```yaml
outputs:
  create-discussion: { max: 1 }
```

### Feature Ideas
Create structured discussions for feature requests:
```yaml
outputs:
  create-discussion: { max: 3 }
```

### Feedback Gathering
Ask the community for input on decisions:
```yaml
outputs:
  create-discussion: { max: 1 }
```

## Discussion Categories

Choose the appropriate category for each discussion:

- **Announcements** - Important news, releases, updates
- **General** - General discussion and off-topic
- **Ideas** - Feature suggestions and improvements
- **Polls** - Quick polls and surveys
- **Q&A** - Questions and answers
- **Show and tell** - Showcase projects and contributions

## Best Practices

### 1. Set Reasonable Limits

Always use `max` for `create-discussion`:

```yaml
outputs:
  create-discussion: { max: 1 }  # Recommended
```

Without a limit, discussions could proliferate.

### 2. Use Appropriate Categories

Select the right category for each discussion:

```markdown
# Announcements
- Releases
- Major updates
- Important policy changes

# Ideas
- Feature suggestions
- Process improvements
- Tool recommendations

# Show and tell
- Community projects
- Contributions
- Accomplishments
```

### 3. Provide Clear Structure

Use markdown formatting for readability:

```markdown
## Main Points

### Key Information
- Bullet 1
- Bullet 2
- Bullet 3

### Next Steps
- Action 1
- Action 2
```

### 4. Include Call to Action

Encourage engagement:

```markdown
## What do you think?
Please share your feedback in the comments below.
Have you encountered this issue? What was your solution?
```

### 5. Link to Related Content

Connect discussions to issues, PRs, and external resources:

```markdown
### Related
- Issue: #123
- PR: #456
- Documentation: [link]
```

## Security Considerations

### Discussion Content

Discussions are public - be careful with:
- Internal system details
- Performance metrics
- Configuration information
- User data

```markdown
# Good - appropriately vague
We've improved performance in the latest release.

# Bad - too specific
We optimized database queries, reducing response time from 500ms to 50ms
on our internal systems processing 10,000 requests/second.
```

### Discussion Creation Limits

The `max` parameter prevents discussion spam:

```yaml
outputs:
  create-discussion: { max: 1 }  # Essential safeguard
```

### Moderation

Remember that discussions are visible to everyone:

```markdown
# Keep it professional
Thank you for your contribution!

# Avoid
You're an idiot for suggesting this feature.
```

## Troubleshooting

### Discussions Not Being Created

Check that:
1. The `permissions` section includes `discussions: write`
2. Discussions are enabled in your repository settings
3. The agent has logic to determine when to create discussions
4. The `max` limit hasn't been reached

### Enabling Discussions

If discussions aren't working:
1. Go to Repository Settings
2. Navigate to Features
3. Enable "Discussions" checkbox
4. Configure discussion categories

### Wrong Category

Verify the category:
1. Use exact category names
2. Ensure the category exists in your repository
3. Check the discussion settings for available categories

## Related Outputs

- [Comments (add-comment)](./comments/) - For direct engagement
- [Issues (create-issue, close-issue)](./issues/) - For bug tracking
- [Pull Requests (create-pr, close-pr)](./pull-requests/) - For code changes

## Next Steps

- Learn about [Permissions](../../guide/permissions/)
- Explore [Triggers](../../triggers/) to control when discussions are created
- Review [Security Best Practices](../../reference/security/)
