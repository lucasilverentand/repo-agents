---
name: scheduled-agent
on:
  schedule:
    - cron: "0 0 * * *"
    - cron: "0 12 * * *"
permissions:
  issues: write
  pull_requests: read
rate_limit_minutes: 60
---

Agent that runs on a schedule twice daily.
