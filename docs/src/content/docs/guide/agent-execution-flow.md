---
title: Agent Execution Flow
description: Visual overview of the complete agent execution pipeline
---

When a trigger fires, gh-claude agents run through a multi-job workflow in GitHub Actions. This page provides a visual overview of how agents execute and what happens at each stage.

## Complete Execution Flow

```mermaid
flowchart TD
    subgraph trigger["🎯 Trigger Event"]
        T[Issue opened / PR created / Schedule / Manual]
    end

    subgraph preflight["🔒 Pre-Flight Job"]
        PF1[Generate GitHub Token]
        PF2[Check Secrets]
        PF3[Check User Authorization]
        PF4[Check Required Labels]
        PF5[Check Rate Limit]
        PF6[Upload Validation Audit]

        PF1 --> PF2
        PF2 --> PF3
        PF3 --> PF4
        PF4 --> PF5
        PF5 --> PF6
    end

    subgraph collect["📥 Collect Inputs Job"]
        CI1[Query GitHub API]
        CI2[Filter by Time Range]
        CI3[Check min_items Threshold]

        CI1 --> CI2
        CI2 --> CI3
    end

    subgraph agent["🤖 Claude Agent Job"]
        CA1[Checkout Repository]
        CA2[Setup Bun & Install CLI]
        CA3[Prepare Context File]
        CA4[Create Skills File]
        CA5[Run Claude]
        CA6[Extract Metrics]
        CA7[Upload Outputs Artifact]

        CA1 --> CA2
        CA2 --> CA3
        CA3 --> CA4
        CA4 --> CA5
        CA5 --> CA6
        CA6 --> CA7
    end

    subgraph execute["⚡ Execute Outputs Job"]
        EO1[Download Outputs Artifact]
        EO2[Validate Output Files]
        EO3[Execute GitHub Actions]
        EO4[Upload Validation Results]

        EO1 --> EO2
        EO2 --> EO3
        EO3 --> EO4
    end

    subgraph report["📊 Report Results Job"]
        RR1[Download Validation Results]
        RR2[Check for Errors]
        RR3[Post Error Comment]

        RR1 --> RR2
        RR2 --> RR3
    end

    subgraph audit["📋 Audit Report Job"]
        AR1[Download All Artifacts]
        AR2[Generate Audit Report]
        AR3[Check for Failures]
        AR4[Run Diagnostic Agent]
        AR5[Create Failure Issue]
        AR6[Upload Audit Report]

        AR1 --> AR2
        AR2 --> AR3
        AR3 -->|Failures| AR4
        AR4 --> AR5
        AR3 -->|Success| AR6
        AR5 --> AR6
    end

    T --> preflight
    preflight -->|should-run=true| collect
    preflight -->|should-run=true, no inputs| agent
    collect -->|has-inputs=true| agent
    collect -->|has-inputs=false| audit
    agent -->|success| execute
    agent -->|failure| audit
    execute --> report
    execute --> audit
    report --> audit
```

## Job Dependencies

The workflow uses a dependency chain to ensure proper execution order:

```mermaid
flowchart LR
    PF[pre-flight] --> CI[collect-inputs]
    PF --> CA[claude-agent]
    CI --> CA
    CA --> EO[execute-outputs]
    EO --> RR[report-results]
    PF --> AR[audit-report]
    CA --> AR
    EO --> AR
```

| Job | Depends On | Condition |
|-----|------------|-----------|
| `pre-flight` | — | Always runs |
| `collect-inputs` | `pre-flight` | Only if `inputs` configured and pre-flight passes |
| `claude-agent` | `pre-flight`, `collect-inputs` | Pre-flight passes AND inputs threshold met |
| `execute-outputs` | `claude-agent` | Only if `outputs` configured and agent succeeds |
| `report-results` | `execute-outputs` | Only if `outputs` configured |
| `audit-report` | All jobs | Always runs (tracks success/failure) |

## Job Details

### Pre-Flight Job

The pre-flight job runs security and validation checks before allowing agent execution.

**Steps:**
1. **Generate GitHub Token** — Creates a GitHub App token (if configured) or uses default `GITHUB_TOKEN`
2. **Check Secrets** — Verifies `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` exists
3. **Check User Authorization** — Validates the triggering user has permission (admin/write/org member/allowed list)
4. **Check Required Labels** — Verifies trigger labels are present (if configured)
5. **Check Rate Limit** — Ensures minimum interval between runs (default: 5 minutes)

**Outputs:**
- `should-run` — `true` if all checks pass
- `rate-limited` — `true` if skipped due to rate limiting

### Collect Inputs Job

*Only runs if `inputs` is configured in the agent definition.*

Collects repository data for scheduled or batch-processing agents.

**Capabilities:**
- Query issues, PRs, discussions, commits, releases, workflow runs, stars, forks
- Filter by time range (`last-run`, `1h`, `24h`, `7d`)
- Skip execution if `min_items` threshold not met

**Outputs:**
- `has-inputs` — `true` if enough data collected
- `inputs-data` — Formatted markdown of collected data

### Claude Agent Job

The main execution job where Claude analyzes and responds.

**Steps:**
1. **Checkout Repository** — Clone the repository for Claude to read
2. **Setup Bun & Install CLI** — Prepare the Claude Code CLI
3. **Prepare Context File** — Combine event data, collected inputs, issue/PR details
4. **Create Skills File** — Generate `.claude/CLAUDE.md` with output instructions
5. **Run Claude** — Execute Claude with the prepared context
6. **Extract Metrics** — Log cost, turns, duration, session ID
7. **Upload Outputs Artifact** — Save output files for the next job

**Tool Permissions:**
- With outputs: `Write(/tmp/outputs/*),Read,Glob,Grep`
- Without outputs: `Read,Glob,Grep`

### Execute Outputs Job

*Only runs if `outputs` is configured in the agent definition.*

Validates and executes agent outputs using a matrix strategy (parallel execution).

**Steps:**
1. **Download Outputs Artifact** — Retrieve files from claude-agent job
2. **Validate Output Files** — Check against JSON schemas
3. **Execute GitHub Actions** — Run `gh` CLI commands
4. **Upload Validation Results** — Save results for reporting

**Matrix Strategy:**
Each output type (add-comment, add-label, create-pr, etc.) runs as a separate parallel job instance.

### Report Results Job

*Only runs if `outputs` is configured.*

Collects validation errors and reports them.

**Steps:**
1. **Download Validation Results** — Merge results from all matrix instances
2. **Check for Errors** — Identify failed validations
3. **Post Error Comment** — Add comment to issue/PR with error details

### Audit Report Job

Always runs to track execution metrics and handle failures.

**Steps:**
1. **Download All Artifacts** — Collect validation, metrics, and output data
2. **Generate Audit Report** — Create markdown report with job results and metrics
3. **Check for Failures** — Determine if any job failed
4. **Run Diagnostic Agent** *(on failure)* — Claude analyzes failure in safe read-only mode
5. **Create Failure Issue** *(on failure)* — Open issue with diagnosis and remediation steps
6. **Upload Audit Report** — Save report as artifact

## Conditional Job Execution

Different agent configurations result in different workflow structures:

### Minimal Agent (no inputs, no outputs)

```mermaid
flowchart LR
    PF[pre-flight] --> CA[claude-agent]
    PF --> AR[audit-report]
    CA --> AR
```

### Agent with Inputs Only

```mermaid
flowchart LR
    PF[pre-flight] --> CI[collect-inputs]
    CI --> CA[claude-agent]
    PF --> AR[audit-report]
    CA --> AR
```

### Agent with Outputs Only

```mermaid
flowchart LR
    PF[pre-flight] --> CA[claude-agent]
    CA --> EO[execute-outputs]
    EO --> RR[report-results]
    PF --> AR[audit-report]
    CA --> AR
    EO --> AR
```

### Full Agent (inputs + outputs)

```mermaid
flowchart LR
    PF[pre-flight] --> CI[collect-inputs]
    CI --> CA[claude-agent]
    CA --> EO[execute-outputs]
    EO --> RR[report-results]
    PF --> AR[audit-report]
    CA --> AR
    EO --> AR
```

## Failure Handling

When failures occur, the audit-report job:

1. **Detects the failure** by checking job results
2. **Runs a diagnostic agent** in safe read-only mode
3. **Creates a GitHub issue** with:
   - Failure summary
   - Root cause analysis
   - Specific remediation steps
   - Link to workflow run
   - Full audit report

This ensures failures are visible and actionable, not silently lost in logs.

## Next Steps

- Learn about [Pre-Flight Checks](../reference/security-model/) in the security model
- Configure [Inputs](../inputs/) for data collection
- Set up [Outputs](../outputs/) for agent actions
- Review [Troubleshooting](./troubleshooting/) for common issues
