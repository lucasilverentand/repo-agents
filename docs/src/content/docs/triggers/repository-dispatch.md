---
title: Repository Dispatch
description: Trigger workflows via GitHub API or external webhooks
---

Trigger your agent programmatically via the GitHub API, enabling integration with external systems, CI/CD pipelines, and custom automation.

## Basic Configuration

```yaml
on:
  repository_dispatch:
    types: [custom-event]
```

## Event Types

You define custom event type names. The `types` array specifies which event types trigger your agent:

```yaml
on:
  repository_dispatch:
    types: [deploy-completed, tests-passed, data-updated]
```

## Triggering via API

### Using cURL

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/dispatches \
  -d '{
    "event_type": "deploy-completed",
    "client_payload": {
      "environment": "production",
      "version": "1.2.3",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'
```

### Using GitHub CLI

```bash
gh api repos/OWNER/REPO/dispatches \
  -f event_type=deploy-completed \
  -f client_payload[environment]=production \
  -f client_payload[version]=1.2.3
```

### Using Octokit (JavaScript)

```javascript
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

await octokit.repos.createDispatchEvent({
  owner: 'OWNER',
  repo: 'REPO',
  event_type: 'deploy-completed',
  client_payload: {
    environment: 'production',
    version: '1.2.3'
  }
});
```

## Accessing Payload Data

The `client_payload` is available via GitHub context:

```yaml
---
name: Deployment Handler
on:
  repository_dispatch:
    types: [deploy-completed]
permissions:
  issues: write
---

Handle deployment completion:

Environment: ${{ github.event.client_payload.environment }}
Version: ${{ github.event.client_payload.version }}

1. Create deployment notification
2. Update relevant issues
3. Post to team discussion
```

Access in bash:

```bash
ENV="${{ github.event.client_payload.environment }}"
VERSION="${{ github.event.client_payload.version }}"

echo "Deployment to $ENV completed: $VERSION"
```

## Common Use Cases

### CI/CD Integration

React to external build/deploy events:

```yaml
---
name: Deployment Notifier
on:
  repository_dispatch:
    types: [deployment-completed, deployment-failed]
permissions:
  issues: write
  discussions: write
---

Handle deployment events:
1. Check deployment status from payload
2. If successful:
   - Close related issues with "fix-deployed" label
   - Post success message to discussions
3. If failed:
   - Create incident issue
   - Tag on-call team
   - Post failure details
```

### External System Integration

Respond to webhooks from other services:

```yaml
---
name: Customer Feedback Handler
on:
  repository_dispatch:
    types: [customer-feedback, support-ticket]
permissions:
  issues: write
---

Process customer feedback:
1. Extract feedback from client_payload
2. Check if similar issue exists
3. Create or update issue with feedback
4. Tag product team
5. Add 'customer-feedback' label
```

### Data Sync Triggers

Coordinate updates across systems:

```yaml
---
name: Documentation Sync
on:
  repository_dispatch:
    types: [docs-updated, api-schema-changed]
permissions:
  issues: write
---

Handle external documentation updates:
1. Parse update details from payload
2. Check if local docs need updating
3. Create issue if sync required
4. Tag documentation team
```

### Cross-Repository Workflows

Coordinate between repositories:

```yaml
---
name: Dependency Update Handler
on:
  repository_dispatch:
    types: [dependency-updated]
permissions:
  issues: write
---

Handle dependency updates from other repos:
1. Check which dependency was updated
2. Verify compatibility
3. Create PR to update dependency
4. Run tests
5. Report status
```

## Multiple Event Types

Handle different events differently:

```yaml
---
name: Multi-Event Handler
on:
  repository_dispatch:
    types: [event-a, event-b, event-c]
---

Process based on event type:

Event Type: ${{ github.event.action }}

1. Check event type
2. Route to appropriate handler
3. Process accordingly
```

Access event type:

```bash
EVENT_TYPE="${{ github.event.action }}"

case $EVENT_TYPE in
  event-a)
    echo "Handling event A"
    ;;
  event-b)
    echo "Handling event B"
    ;;
  *)
    echo "Unknown event"
    ;;
esac
```

## Required Permissions

### To Trigger (Caller)

The API caller needs a token with `repo` scope:

```bash
# Create token with repo scope
gh auth token
```

### For Agent (Workflow)

Configure permissions based on what your agent does:

```yaml
permissions:
  issues: write
  discussions: write
```

See [Permissions](/guide/permissions/) for details.

## Best Practices

### Use Descriptive Event Types

Choose clear, semantic event names:

```yaml
# ✅ Good - descriptive
types: [deployment-completed, test-suite-passed, security-scan-failed]

# ❌ Unclear - vague
types: [event1, trigger, webhook]
```

### Include Context in Payload

Send all necessary data:

```javascript
// ✅ Good - complete context
client_payload: {
  environment: 'production',
  version: '1.2.3',
  deployer: 'alice',
  timestamp: '2024-01-15T10:30:00Z',
  commit_sha: 'abc123'
}

// ❌ Incomplete - missing context
client_payload: {
  version: '1.2.3'
}
```

### Validate Payload Data

Always validate data from external sources:

```yaml
---
name: Safe Handler
on:
  repository_dispatch:
    types: [external-event]
---

Before processing:
1. Validate payload structure
2. Check required fields exist
3. Sanitize user-provided data
4. Verify data types and ranges
5. Then proceed safely
```

### Use Specific Event Types

Don't use one event type for everything:

```yaml
# ✅ Good - specific types
types: [deploy-started, deploy-completed, deploy-failed]

# ❌ Bad - generic catch-all
types: [deploy]  # How do you know the status?
```

### Document Your Events

Document what events your repository accepts:

```markdown
## Repository Dispatch Events

This repository accepts the following dispatch events:

### `deployment-completed`
Triggered when a deployment completes successfully.

**Payload:**
- `environment` (string, required): Target environment
- `version` (string, required): Deployed version
- `deployer` (string, optional): Who deployed

**Example:**
\`\`\`bash
gh api repos/owner/repo/dispatches \
  -f event_type=deployment-completed \
  -f client_payload[environment]=production \
  -f client_payload[version]=1.2.3
\`\`\`
```

## Security Considerations

### Validate Sources

Consider where dispatch events come from:

```yaml
---
name: Secure Handler
on:
  repository_dispatch:
    types: [trusted-event]
---

Security checks:
1. Validate payload signature if possible
2. Check event source (actor)
3. Verify payload against schema
4. Sanitize any user input
5. Use least-privilege permissions
```

### Limit Scope

Only listen to events you need:

```yaml
# ✅ Specific - only expected events
types: [deployment-completed]

# ❌ Too open - accepts anything
types: ['*']  # Not supported, but avoid broad matches
```

### Use Secrets Safely

Never expose secrets in payloads:

```javascript
// ❌ NEVER - secrets in payload
client_payload: {
  api_key: 'secret-key-123'  // NEVER DO THIS
}

// ✅ Good - reference secrets by ID
client_payload: {
  secret_id: 'prod-api-key'  // Reference, not value
}
```

## Examples

### Deployment Tracker

```yaml
---
name: Deployment Tracker
on:
  repository_dispatch:
    types: [deployment-started, deployment-completed, deployment-failed]
permissions:
  issues: write
---

Track deployment lifecycle:

Event: ${{ github.event.action }}
Environment: ${{ github.event.client_payload.environment }}
Version: ${{ github.event.client_payload.version }}

1. Find or create deployment tracking issue
2. Update status based on event type
3. If completed: close related feature issues
4. If failed: create incident issue
5. Post updates to team discussion
```

### Security Alert Handler

```yaml
---
name: Security Alert Handler
on:
  repository_dispatch:
    types: [security-alert, vulnerability-detected]
permissions:
  issues: write
---

Handle security alerts from external scanners:

Alert Type: ${{ github.event.client_payload.alert_type }}
Severity: ${{ github.event.client_payload.severity }}

1. Create security issue if not exists
2. Tag security team
3. Add severity label
4. If critical: ping on-call
5. Link to scanner results
```

### Test Results Processor

```yaml
---
name: External Test Results
on:
  repository_dispatch:
    types: [test-results]
permissions:
  pull_requests: write
---

Process test results from external CI:

PR: ${{ github.event.client_payload.pr_number }}
Status: ${{ github.event.client_payload.status }}
Coverage: ${{ github.event.client_payload.coverage }}

1. Find related PR
2. Post test results as comment
3. Update PR labels based on status
4. If failed: request review
5. If passed: approve if auto-merge enabled
```

## Debugging

### Test Events Locally

Use curl to test locally:

```bash
# Set your token
export GITHUB_TOKEN="your-token"

# Trigger event
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo/dispatches \
  -d '{
    "event_type": "test-event",
    "client_payload": {"test": true}
  }'
```

### Check Workflow Runs

View triggered workflows:

```bash
gh run list --workflow="your-workflow.yml"
```

### Inspect Payload

Log payload in workflow:

```yaml
---
name: Debug Payload
on:
  repository_dispatch:
    types: [debug]
---

Debug information:

Event Type: ${{ github.event.action }}
Full Payload: ${{ toJson(github.event.client_payload) }}

Inspect the payload structure here.
```

## Limitations

- Event type names must be alphanumeric, hyphens, or underscores
- Payload size limited to ~65KB
- No built-in payload validation
- No automatic retries on failure
- Events are fire-and-forget (no response to caller)

## Next Steps

- Compare with [Workflow Dispatch](/triggers/workflow-dispatch/) for manual triggers
- Combine with [Schedule triggers](/triggers/schedule/) for hybrid automation
- Understand [Permissions](/guide/permissions/)
- Learn about [Outputs](/guide/outputs/)
