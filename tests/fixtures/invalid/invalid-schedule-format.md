---
name: Invalid Schedule Format
on:
  schedule:
    - cron: "every day at 9am"
    - cron: 0 9 * *
    - interval: "1d"
permissions:
  issues: write
outputs:
  create-issue: true
---

This agent has invalid cron schedule formats. Schedule must use proper cron syntax.
