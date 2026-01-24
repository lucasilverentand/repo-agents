---
name: PR Project Workflow
on:
  pull_request:
    types: [opened, ready_for_review, review_requested, closed]
permissions:
  pull_requests: read
outputs:
  update-project-field:
    project_number: 1
    allowed_fields: ["Status"]
context:
  project:
    project_number: 1
    include_fields: true
    include_items: false
---

You manage the project workflow for pull requests. Based on the PR event, update its status in the project:

## Status Mapping

- **PR Opened (draft)**: Set Status to "In Progress"
- **PR Ready for Review**: Set Status to "In Review"
- **PR Review Requested**: Set Status to "In Review"
- **PR Merged**: Set Status to "Done"
- **PR Closed (not merged)**: Set Status to "Closed"

## Instructions

1. Determine the appropriate status based on the PR event type
2. Update the project field accordingly
3. Use the exact field values from the project configuration

Only update the Status field - do not modify other fields.
