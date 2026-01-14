---
title: Audit Stage
slug: stages/audit
description: Tracking execution metrics and handling failures
sidebar:
  label: 5. Audit
---

The audit stage always runs, regardless of success or failure, to track metrics and handle problems. It collects all audit artifacts from previous stages and generates a comprehensive audit report with execution metrics like tokens, cost, and duration. When failures occur, it runs a diagnostic agent in safe, read-only mode. If configured, it can create GitHub issues for failures to ensure they're tracked and addressed.

## Purpose

- Collect all audit artifacts from previous stages
- Generate comprehensive audit report with execution metrics (tokens, cost, duration)
- Run diagnostic agent in safe, read-only mode on failures
- Create GitHub issues for failures (if configured)

## Steps

### 1. Collect All Artifacts

Collects audit artifacts from all previous stages:
- Dispatcher audit (pre-flight check results)
- Claude metrics (cost, turns, duration)
- Output files (what Claude created)
- Validation results (output execution results)

### 2. Generate Audit Report

Generates a comprehensive audit report with execution metrics, including:
- Agent name and trigger
- Pre-flight check results
- Execution metrics (tokens, cost, duration)
- Outputs executed and their status
- Job results summary

### 3. Check for Failures

Determines if any job in the workflow failed.

### 4. Run Diagnostic Agent (on failure)

When a failure occurs, a diagnostic agent runs in safe, read-only mode to:
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

