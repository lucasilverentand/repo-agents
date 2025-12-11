---
title: Workflow Dispatch
description: Manually trigger agents with optional inputs
---

Allow manual triggering of your agent through the GitHub UI or API, optionally with user-provided inputs.

## Basic Configuration

```yaml
on:
  workflow_dispatch:
```

This enables manual triggering with no inputs.

## With Inputs

Define inputs to collect data when manually triggered:

```yaml
on:
  workflow_dispatch:
    inputs:
      target:
        description: 'Target to process'
        required: true
        type: string
      dryRun:
        description: 'Run in dry-run mode'
        required: false
        type: boolean
        default: false
```

## Input Types

### String Input

Text input field:

```yaml
inputs:
  message:
    description: 'Message to process'
    required: true
    type: string
    default: 'Hello world'
```

### Boolean Input

Checkbox (true/false):

```yaml
inputs:
  skipTests:
    description: 'Skip running tests'
    required: false
    type: boolean
    default: false
```

### Choice Input

Dropdown with predefined options:

```yaml
inputs:
  environment:
    description: 'Target environment'
    required: true
    type: choice
    options:
      - development
      - staging
      - production
    default: development
```

## Input Fields

All input types support these fields:

- **`description`** - Help text shown in GitHub UI (required)
- **`required`** - Whether input must be provided (default: `false`)
- **`default`** - Default value if not provided
- **`type`** - Input type: `string`, `boolean`, or `choice`
- **`options`** - Array of allowed values (only for `choice` type)

## Accessing Input Values

Input values are available via GitHub context:

```bash
# Access in your agent using environment variables
TARGET="${{ inputs.target }}"
DRY_RUN="${{ inputs.dryRun }}"

echo "Processing target: $TARGET"
echo "Dry run mode: $DRY_RUN"
```

## Common Use Cases

### Manual Analysis

On-demand repository analysis:

```yaml
---
name: Manual Repository Analysis
on:
  workflow_dispatch:
    inputs:
      scope:
        description: 'Analysis scope'
        type: choice
        options:
          - recent
          - all
          - custom
        default: recent
      days:
        description: 'Days to analyze (if scope=recent)'
        type: string
        default: '7'
permissions:
  issues: read
  pull_requests: read
---

Analyze repository based on inputs:
1. Determine scope from input
2. Gather issues and PRs
3. Generate analysis report
4. Post as discussion
```

### Emergency Response

Quick investigation or fixes:

```yaml
---
name: Emergency Issue Investigation
on:
  workflow_dispatch:
    inputs:
      issueNumber:
        description: 'Issue number to investigate'
        required: true
        type: string
      priority:
        description: 'Priority level'
        type: choice
        options:
          - critical
          - high
          - normal
        default: normal
permissions:
  issues: write
---

Investigate the specified issue:
1. Fetch issue details
2. Analyze based on priority
3. Add investigation findings
4. Suggest next steps
```

### Batch Operations

Process multiple items:

```yaml
---
name: Bulk Label Update
on:
  workflow_dispatch:
    inputs:
      oldLabel:
        description: 'Old label name'
        required: true
        type: string
      newLabel:
        description: 'New label name'
        required: true
        type: string
      dryRun:
        description: 'Preview changes without applying'
        type: boolean
        default: true
permissions:
  issues: write
---

Update labels:
1. Find all issues with old label
2. If dry run, list changes
3. If not dry run, update labels
4. Report results
```

### Testing New Agents

Test agent behavior before enabling automatic triggers:

```yaml
---
name: Test Agent
on:
  workflow_dispatch:
    inputs:
      testMode:
        description: 'Test mode'
        type: choice
        options:
          - minimal
          - full
        default: minimal
  # issues:
  #   types: [opened]  # Enable after testing
permissions:
  issues: write
---

Test agent functionality safely before enabling automatic triggers.
```

## Triggering Workflows

### Via GitHub UI

1. Go to **Actions** tab
2. Select your workflow
3. Click **Run workflow**
4. Fill in inputs
5. Click **Run workflow** button

### Via GitHub CLI

```bash
# Trigger with no inputs
gh workflow run "Workflow Name"

# Trigger with inputs
gh workflow run "Workflow Name" \
  -f target=production \
  -f dryRun=false
```

### Via API

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/actions/workflows/workflow.yml/dispatches \
  -d '{
    "ref": "main",
    "inputs": {
      "target": "production",
      "dryRun": "false"
    }
  }'
```

## Best Practices

### Provide Clear Descriptions

Help users understand what each input does:

```yaml
# ✅ Good - clear description
inputs:
  issueNumber:
    description: 'Issue number to process (e.g., 123)'
    required: true
    type: string

# ❌ Unclear - vague description
inputs:
  number:
    description: 'Number'
    type: string
```

### Use Sensible Defaults

Make common cases easy:

```yaml
inputs:
  environment:
    description: 'Target environment'
    type: choice
    options:
      - development
      - staging
      - production
    default: development  # Safe default
```

### Use Choice for Limited Options

Prefer dropdowns over free text when values are limited:

```yaml
# ✅ Good - limited options
inputs:
  priority:
    type: choice
    options: [low, medium, high]

# ❌ Fragile - free text allows typos
inputs:
  priority:
    type: string
    description: 'Priority (low/medium/high)'
```

### Add Dry Run Mode

For operations that modify data:

```yaml
inputs:
  dryRun:
    description: 'Preview changes without applying them'
    type: boolean
    default: true  # Safe default
```

### Validate Inputs

Check input values in your agent:

```yaml
---
name: Validated Agent
on:
  workflow_dispatch:
    inputs:
      issueNumber:
        description: 'Issue number'
        required: true
        type: string
---

Before processing:
1. Validate issue number is numeric
2. Verify issue exists
3. Check you have necessary permissions
4. Then proceed with operation
```

## Combining with Other Triggers

Use workflow_dispatch alongside automatic triggers:

```yaml
on:
  issues:
    types: [opened]
  workflow_dispatch:
    inputs:
      issueNumber:
        description: 'Process specific issue number'
        type: string
```

This allows:
- Automatic triggering for new issues
- Manual triggering for specific issues

Access in agent:

```bash
# Use input if provided, otherwise use event issue
ISSUE_NUM="${{ inputs.issueNumber || github.event.issue.number }}"
```

## Examples

### Custom Report Generator

```yaml
---
name: Custom Report
on:
  workflow_dispatch:
    inputs:
      reportType:
        description: 'Report type'
        type: choice
        options:
          - issues-summary
          - pr-summary
          - contributor-stats
      startDate:
        description: 'Start date (YYYY-MM-DD)'
        required: true
        type: string
      endDate:
        description: 'End date (YYYY-MM-DD)'
        required: true
        type: string
      format:
        description: 'Output format'
        type: choice
        options:
          - markdown
          - json
        default: markdown
permissions:
  issues: read
  pull_requests: read
---

Generate custom report based on inputs:
1. Validate date range
2. Fetch data based on report type
3. Format according to specified format
4. Post as discussion or comment
```

### Migration Tool

```yaml
---
name: Label Migration
on:
  workflow_dispatch:
    inputs:
      fromLabel:
        description: 'Source label'
        required: true
        type: string
      toLabel:
        description: 'Destination label'
        required: true
        type: string
      scope:
        description: 'What to migrate'
        type: choice
        options:
          - issues-only
          - prs-only
          - both
        default: both
      confirmMigration:
        description: 'Confirm you want to proceed'
        type: boolean
        required: true
permissions:
  issues: write
  pull_requests: write
---

Migrate labels from one to another:
1. Verify both labels exist
2. Find all items with source label
3. Apply destination label
4. Optionally remove source label
5. Report results
```

## Limitations

- Maximum 10 inputs per workflow
- Input descriptions limited to 255 characters
- Choice inputs limited to ~10 options (UI constraint)
- All inputs are passed as strings in API (even booleans)

## Next Steps

- Learn about [Repository Dispatch](repository-dispatch/) for API triggering
- Combine with [Schedule triggers](schedule/) for hybrid automation
- Understand [Permissions](../../guide/permissions/)
