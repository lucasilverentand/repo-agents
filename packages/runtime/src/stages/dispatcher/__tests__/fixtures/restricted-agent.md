---
name: restricted-agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
allowed_users:
  - alice
  - bob
allowed_teams:
  - core-team
  - security-team
rate_limit_minutes: 15
---

Agent with strict authorization requirements.
