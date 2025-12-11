---
title: Schedule Triggers
description: Run agents on a recurring schedule
---

Execute your agent on a recurring schedule using cron syntax. Perfect for periodic tasks like reporting, cleanup, or monitoring.

## Basic Configuration

```yaml
on:
  schedule:
    - cron: '0 9 * * MON'  # Every Monday at 9am UTC
```

## Cron Syntax

GitHub Actions uses POSIX cron syntax:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
* * * * *
```

### Special Characters

- **`*`** - Any value (every minute, hour, etc.)
- **`,`** - Value list separator (`1,3,5`)
- **`-`** - Range of values (`1-5`)
- **`/`** - Step values (`*/15` = every 15 minutes)

## Common Schedules

### Daily

```yaml
# Every day at midnight UTC
schedule:
  - cron: '0 0 * * *'

# Every day at 9am UTC
schedule:
  - cron: '0 9 * * *'

# Twice daily (9am and 5pm UTC)
schedule:
  - cron: '0 9,17 * * *'
```

### Weekly

```yaml
# Every Monday at 9am UTC
schedule:
  - cron: '0 9 * * MON'

# Every Friday at 5pm UTC
schedule:
  - cron: '0 17 * * FRI'

# Weekdays at 10am UTC
schedule:
  - cron: '0 10 * * MON-FRI'
```

### Hourly

```yaml
# Every hour
schedule:
  - cron: '0 * * * *'

# Every 6 hours
schedule:
  - cron: '0 */6 * * *'

# Every 4 hours on weekdays
schedule:
  - cron: '0 */4 * * MON-FRI'
```

### Monthly

```yaml
# First day of every month at midnight
schedule:
  - cron: '0 0 1 * *'

# Last day of every month (approximate - uses 28th)
schedule:
  - cron: '0 0 28 * *'

# First Monday of every month at 9am
schedule:
  - cron: '0 9 1-7 * MON'
```

### Multiple Schedules

Run at different times:

```yaml
schedule:
  - cron: '0 9 * * MON'    # Monday 9am
  - cron: '0 13 * * WED'   # Wednesday 1pm
  - cron: '0 17 * * FRI'   # Friday 5pm
```

## Common Use Cases

### Daily Reports

Generate repository summaries:

```yaml
---
name: Daily Activity Report
on:
  schedule:
    - cron: '0 9 * * *'  # 9am UTC daily
permissions:
  issues: read
  pull_requests: read
---

Generate a daily summary:
1. List issues opened/closed in last 24 hours
2. List PRs opened/merged in last 24 hours
3. Highlight any high-priority items
4. Post summary as a discussion
```

### Weekly Cleanup

Close stale issues and PRs:

```yaml
---
name: Stale Item Cleanup
on:
  schedule:
    - cron: '0 0 * * MON'  # Mondays at midnight
permissions:
  issues: write
  pull_requests: write
---

Weekly cleanup:
1. Find issues/PRs with 'stale' label
2. Check if activity in last 7 days
3. Close items with no activity
4. Remove 'stale' label if activity present
```

### Periodic Health Checks

Monitor repository health:

```yaml
---
name: Repository Health Monitor
on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
permissions:
  issues: write
---

Check repository metrics:
1. Count open issues and PRs
2. Identify items without labels
3. Find issues without assignees
4. Create health report discussion
```

### Monthly Metrics

Generate monthly statistics:

```yaml
---
name: Monthly Metrics Report
on:
  schedule:
    - cron: '0 0 1 * *'  # First of month at midnight
permissions:
  issues: read
  pull_requests: read
---

Generate monthly report:
1. Count issues/PRs created this month
2. Calculate time-to-close metrics
3. List top contributors
4. Post as discussion with charts/tables
```

## Important Considerations

### UTC Timezone

All cron schedules run in UTC. Convert your local time:

```yaml
# Run at 9am Pacific (5pm UTC)
- cron: '0 17 * * *'

# Run at 6pm Eastern (11pm UTC)
- cron: '0 23 * * *'
```

### Minimum Interval

GitHub Actions supports minimum 5-minute intervals, but **don't run too frequently**:

```yaml
# ✅ Reasonable - every 15 minutes
- cron: '*/15 * * * *'

# ⚠️  Too frequent - every 5 minutes (consider rate limits)
- cron: '*/5 * * * *'

# ❌ Not supported - every minute
- cron: '* * * * *'
```

### Execution Delays

GitHub Actions may delay scheduled workflows during high-load periods. Don't rely on precise timing for critical operations.

### Rate Limiting

Even with scheduled triggers, consider using `rateLimitMinutes`:

```yaml
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
rate_limit_minutes: 60  # Ensure max once per hour
```

## Best Practices

### Choose Appropriate Frequency

Match frequency to task importance:

```yaml
# ✅ Good - daily report
schedule:
  - cron: '0 9 * * *'

# ❌ Excessive - hourly report (likely too much)
schedule:
  - cron: '0 * * * *'
```

### Off-Peak Hours

Run expensive operations during off-peak hours:

```yaml
# Good - runs at 2am UTC when traffic is low
schedule:
  - cron: '0 2 * * *'
```

### Combine with Other Triggers

Scheduled tasks can also be manually triggered:

```yaml
on:
  schedule:
    - cron: '0 9 * * MON'
  workflow_dispatch:  # Allow manual runs
```

### Test Schedules

Use workflow_dispatch to test before enabling schedule:

```yaml
on:
  workflow_dispatch:
  # schedule:
  #   - cron: '0 9 * * *'  # Uncomment after testing
```

## Examples

### Weekly Dependency Check

```yaml
---
name: Weekly Dependency Audit
on:
  schedule:
    - cron: '0 10 * * MON'  # Mondays at 10am UTC
permissions:
  issues: write
---

Check for outdated dependencies:
1. Run dependency audit
2. Identify security vulnerabilities
3. Create issues for critical updates
4. Label by severity
```

### Nightly Test Summary

```yaml
---
name: Nightly Test Report
on:
  schedule:
    - cron: '0 6 * * *'  # 6am UTC daily
permissions:
  issues: write
---

Summarize test failures:
1. Check recent workflow runs
2. Identify flaky tests
3. Create/update issue with failures
4. Tag relevant maintainers
```

### Monthly Contributor Recognition

```yaml
---
name: Monthly Contributor Thanks
on:
  schedule:
    - cron: '0 12 1 * *'  # First of month at noon UTC
permissions:
  discussions: write
---

Thank contributors:
1. Find all contributors from last month
2. Count their contributions
3. Create appreciation discussion
4. Highlight top contributors
```

## Debugging Schedules

### Testing Cron Expressions

Use [crontab.guru](https://crontab.guru/) to validate expressions:

- `0 9 * * *` → "At 09:00"
- `0 */6 * * *` → "At minute 0 past every 6th hour"
- `0 0 * * MON` → "At 00:00 on Monday"

### Manual Triggering

Test scheduled workflows manually:

```yaml
on:
  schedule:
    - cron: '0 9 * * *'
  workflow_dispatch:  # Add this for testing
```

Then trigger via GitHub UI or:

```bash
gh workflow run "Workflow Name"
```

## Next Steps

- Combine with [Issue triggers](/triggers/issues/) for comprehensive automation
- Use [Workflow Dispatch](/triggers/workflow-dispatch/) for manual testing
- Learn about [Permissions](/guide/permissions/)
