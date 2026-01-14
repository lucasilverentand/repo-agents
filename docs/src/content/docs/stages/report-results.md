---
title: Report Results Stage
description: Reporting validation errors to issues and PRs
---

The report-results stage collects validation errors from the execute-outputs stage and posts them as comments on the triggering issue or PR.

**This stage only runs if `outputs` is configured in the agent definition.**

## Purpose

- Collect validation results from all output matrix jobs
- Identify any validation errors
- Post error details to the issue/PR for visibility
- Help users understand what went wrong

## Steps

### 1. Download Validation Results

Merges validation results from all matrix instances of the execute-outputs stage.

### 2. Check for Errors

Scans validation results for any failures.

### 3. Post Error Comment

If errors exist, posts a comment to the issue/PR with details including:
- Which outputs failed
- The specific error message
- The file contents that caused the error
- Link to the workflow run

## Error Types

### Validation Errors

Output file doesn't match expected schema (missing fields, wrong types).

### Execution Errors

GitHub operation failed (label doesn't exist, branch already exists).

### Limit Errors

More outputs were created than allowed by the configuration.

## Comment Format

The error comment includes:

1. **Summary** — Quick overview of what failed
2. **Error details** — Specific error message for each failure
3. **File contents** — The actual output Claude created
4. **Workflow link** — Direct link to the Actions run for debugging

## Debugging Tips

When you see validation errors:

1. **Check the output schema** — Review the expected format in the Outputs documentation
2. **Review agent instructions** — Ensure your markdown clearly explains the output format
3. **Check available labels** — For `add-label`, verify the label exists in your repository
4. **Check permissions** — For `create-pr` or `update-file`, verify `contents: write` is set

## See Also

- [Execute Outputs](/repo-agents/stages/execute-outputs/) - Output execution
- [Audit Report](/repo-agents/stages/audit-report/) - Failure tracking
- [Troubleshooting](/repo-agents/guide/troubleshooting/) - Common issues
