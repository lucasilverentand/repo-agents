---
name: pr-agent-with-labels
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
  contents: read
trigger_labels:
  - needs-review
  - automated
---

PR agent that requires specific labels to trigger.
