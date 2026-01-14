---
title: Publish Outputs Stage
slug: stages/publish-outputs
description: Validating and publishing agent outputs to GitHub
sidebar:
  label: 4. Publish Outputs
---

After execution, this stage validates and publishes the agent's actions to GitHub. It validates output files against JSON schemas, then executes GitHub operations via the `gh` CLI. This includes posting comments, adding labels, and creating issues or PRs. Any validation errors are reported back to the relevant issues or PRs.

**This stage only runs if `outputs` is configured in the agent definition.**

## Purpose

- Validate output files against JSON schemas
- Execute GitHub operations via the `gh` CLI
- Post comments, add labels, create issues or PRs
- Report validation errors back to issues/PRs

## Steps

### 1. Download Outputs Artifact

Retrieves the output files created by Claude from the previous stage.

### 2. Validate Output Files

Each output file is validated against its schema:

- File exists and is valid JSON
- Required fields are present
- Field types are correct
- Values are within allowed limits

### 3. Execute GitHub Actions

Valid outputs are executed using the GitHub CLI:

| Output Type | Action |
|-------------|--------|
| `add-comment` | Posts comment to issue or PR |
| `add-label` | Adds label to issue or PR |
| `remove-label` | Removes label from issue or PR |
| `create-issue` | Creates a new issue |
| `create-pr` | Creates a pull request |
| `close-issue` | Closes an issue |
| `close-pr` | Closes a pull request |
| `update-file` | Commits file changes |
| `create-discussion` | Creates a discussion |

### 4. Upload Validation Results

Saves validation results for the report-results stage to process.

## Matrix Strategy

Each output type runs as a separate parallel job. This means:
- Multiple outputs execute in parallel
- One failure doesn't stop other outputs
- Each output has isolated validation

## Output Limits

Outputs can have limits to prevent abuse. If Claude creates more files than allowed, only the first N are executed.

## Validation Errors

Common validation errors:

| Error | Cause | Resolution |
|-------|-------|------------|
| Invalid JSON | Malformed output file | Claude will retry on next run |
| Missing field | Required field not provided | Check skills documentation |
| Invalid label | Label doesn't exist | Use existing labels only |
| Path not allowed | File outside `allowed-paths` | Update path restrictions |

## Output File Format

Claude creates JSON files in `/tmp/outputs/` with the naming convention `{output-type}-{sequence}.json`.

For example:
- `add-comment-1.json`
- `add-label-1.json`
- `add-label-2.json`
- `create-pr-1.json`

