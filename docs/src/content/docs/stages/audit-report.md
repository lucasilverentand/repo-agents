---
title: Audit Report Stage
description: Tracking execution metrics and handling failures
---

The audit-report stage always runs at the end of every workflow, regardless of success or failure. It tracks metrics, diagnoses failures, and creates issues for visibility.

## Purpose

- Collect execution metrics from all stages
- Generate a comprehensive audit report
- Run diagnostic agent on failures
- Create GitHub issues for failures
- Ensure failures are visible and actionable

## Steps

### 1. Download All Artifacts

Collects data from all previous stages:
- Validation audit (pre-flight results)
- Claude metrics (cost, turns, duration)
- Output files (what Claude created)
- Validation results (output execution results)

### 2. Generate Audit Report

Creates a markdown report summarizing the run, including:
- Agent name and trigger
- Pre-flight check results
- Execution metrics (model, cost, turns, duration)
- Outputs executed and their status
- Job results summary

### 3. Check for Failures

Determines if any job in the workflow failed.

### 4. Run Diagnostic Agent (on failure)

When a failure occurs, a diagnostic Claude agent runs in safe read-only mode to:
- Analyze the failure
- Identify root cause
- Suggest remediation steps

The diagnostic agent only has read access to the repository and workflow logs.

### 5. Create Failure Issue (on failure)

Opens a GitHub issue with:
- Error summary
- Root cause analysis from diagnostic agent
- Specific remediation steps
- Prevention recommendations
- Link to workflow run
- Full audit report in collapsed details

### 6. Upload Audit Report

Saves the report as a workflow artifact for later review.

## Metrics Tracked

| Metric | Description |
|--------|-------------|
| `cost` | API cost for Claude execution |
| `turns` | Number of conversation turns |
| `duration` | Total execution time |
| `session_id` | Claude session ID for debugging |
| `model` | Model used |
| `input_tokens` | Tokens in prompt |
| `output_tokens` | Tokens in response |

## Failure Issue Labels

Default labels added to failure issues:
- `agent-failure` — Identifies automated failure issues
- Agent name label — e.g., `agent:issue-triage`

You can customize labels with the `audit.issue_labels` configuration.

## Viewing Audit Reports

Audit reports are saved as workflow artifacts. You can:
1. Go to the Actions tab in your repository
2. Click on the workflow run
3. Download the `audit-report` artifact
4. Open `report.md`

## Configuration

You can configure audit behavior in your agent definition:
- `audit.create_issues` — Whether to create issues on failure (default: true)
- `audit.issue_labels` — Custom labels for failure issues

## See Also

- [Troubleshooting](/repo-agents/guide/troubleshooting/) - Common issues
- [FAQ](/repo-agents/reference/faq/) - Frequently asked questions
- [Pre-Flight](/repo-agents/stages/pre-flight/) - First stage
