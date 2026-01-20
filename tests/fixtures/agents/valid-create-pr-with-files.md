---
name: Auto-fix PR Agent
on:
  issues:
    types: [labeled]
  workflow_dispatch:
    inputs:
      issue_number:
        description: "Issue number to create PR for"
        required: true
        type: string
permissions:
  contents: write
  issues: write
  pull_requests: write
outputs:
  create-pr: { sign: true }
  update-file: true
  add-comment: true
allowed-paths:
  - "src/**/*.ts"
  - "tests/**/*.test.ts"
  - "package.json"
  - "*.config.js"
trigger_labels:
  - "auto-fix"
---

# Automated Fix PR Agent

This agent creates pull requests with code fixes based on issue descriptions.

## Instructions

When an issue is labeled with "auto-fix":

1. Analyze the issue description to understand what needs to be fixed
2. Make the necessary code changes in TypeScript files
3. Update or add tests if needed
4. Update package.json if dependencies need to change
5. Create a pull request with:
   - Clear title referencing the issue
   - Description explaining the changes made
   - Link to the original issue
6. Add a comment to the issue with the PR link

Sign all commits when creating the PR.

## Constraints

- Only modify files matching the allowed paths
- Ensure all changes are related to the issue
- Write clear commit messages
- Keep changes focused and minimal
