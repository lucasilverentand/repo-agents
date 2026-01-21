---
title: Contributors
description: Collect repository contributors with activity tracking
---

The `contributors` context type collects information about repository contributors, enabling agents to recognize contributions, track community growth, and celebrate milestones.

## Basic Example

```yaml
name: Contributor Recognition
on:
  schedule:
    - cron: '0 9 * * MON'

context:
  contributors:
    limit: 100
  since: 7d
```

## Configuration Options

```yaml
context:
  contributors:
    limit: 100              # Max contributors to collect (default: 100)
    since: 7d               # Contributor activity since (inherits parent since if omitted)
```

## Collected Data

Each contributor includes:
- Username
- Total contributions (commits, issues, PRs, reviews)
- Contribution breakdown by type
- First contribution date
- Latest contribution date
- Activity within the specified time range

## Examples

<details>
<summary>Example: Weekly contributor recognition</summary>

```yaml
name: Weekly Contributors
on:
  schedule:
    - cron: '0 9 * * MON'

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }

context:
  contributors:
    since: 7d
  pull_requests:
    states: [merged]
  issues:
    states: [closed]
  since: 7d
```

```markdown
Create a weekly contributor recognition post:

1. Create a discussion in the "Announcements" category
2. Title: "Weekly Contributors - Week of [date]"
3. Highlight:
   - Most active contributors
   - First-time contributors
   - Notable contributions (complex PRs, helpful reviews)
   - Total community activity stats
4. Thank everyone for their contributions

This builds community and recognizes valuable contributions.
```

</details>

<details>
<summary>Example: First-time contributor welcome</summary>

```yaml
name: Welcome First Timers
on:
  pull_request:
    types: [opened]

permissions:
  pull_requests: write

outputs:
  add-comment: { max: 1 }
  add-label: true

context:
  contributors:
    limit: 1000
```

```markdown
Welcome first-time contributors:

When a PR is opened:
1. Check if the author is a first-time contributor
2. If yes:
   - Add label "first-contribution"
   - Add a welcoming comment:
     - Thank them for contributing
     - Link to contribution guidelines
     - Explain what to expect in the review process
     - Offer help if needed

This makes new contributors feel welcomed and supported.
```

</details>

<details>
<summary>Example: Inactive contributor re-engagement</summary>

```yaml
name: Re-engage Contributors
on:
  schedule:
    - cron: '0 9 1 * *'  # Monthly

permissions:
  discussions: write

outputs:
  create-discussion: { max: 1 }

context:
  contributors:
    limit: 500
  pull_requests:
    states: [merged]
  since: 90d
```

```markdown
Monthly check for previously active contributors:

1. Identify contributors who were active 90+ days ago but not recently
2. Create a discussion titled "We miss you! Project updates"
3. Include:
   - Major changes since they were last active
   - New features or improvements
   - Easy issues to jump back in
   - Invitation to reconnect

This helps re-engage valuable community members.
```

</details>
