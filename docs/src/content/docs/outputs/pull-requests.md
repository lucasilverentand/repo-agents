---
title: Pull Requests (create-pr, close-pr)
description: Enable agents to create and close pull requests
---

The `create-pr` and `close-pr` outputs enable your agent to manage pull requests in your repository. Use pull requests for code review and change management workflows.

## Configuration

### Simple Enable

Enable PR management without restrictions:

```yaml
outputs:
  create-pr: true
  close-pr: true
```

With `create-pr`, you must also configure `allowed-paths`:

```yaml
allowed-paths:
  - docs/**
  - README.md

outputs:
  create-pr: true
```

### With Options

Configure signing and limits:

```yaml
outputs:
  create-pr: { sign: true, max: 1 }
  close-pr: true
```

**Options for `create-pr`:**
- `sign` - Sign commits with GPG key (default: false)
- `max` - Maximum number of PRs to create per run (default: unlimited)

**Options for `close-pr`:**
- No configuration options available

### Individual Control

Enable only the operations needed:

```yaml
outputs:
  create-pr: { max: 1 }  # Can create PRs
  # close-pr not specified - cannot close
```

## Permission Requirements

### create-pr

Requires `contents: write` and `pull_requests: write` permissions:

```yaml
permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**
  - README.md

outputs:
  create-pr: { max: 1 }
```

### close-pr

Requires `pull_requests: write` permission:

```yaml
permissions:
  pull_requests: write

outputs:
  close-pr: true
```

### Both Operations

```yaml
permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**
  - README.md

outputs:
  create-pr: { sign: true, max: 1 }
  close-pr: true
```

## Required allowed-paths

The `create-pr` output **requires** an `allowed-paths` allowlist. This restricts which files the agent can modify:

```yaml
allowed-paths:
  - docs/**/*.md          # All markdown in docs
  - README.md             # Specific file
  - CHANGELOG.md
  - .github/workflows/*.md # Workflow docs

outputs:
  create-pr: { max: 1 }
```

### Path Pattern Syntax

- `**` - Matches any number of nested directories
- `*` - Matches any filename in a single directory
- `*.md` - Matches all markdown files
- `docs/**/README.md` - Markdown files in any docs subdirectory
- Exact paths - `README.md`, `src/config.json`

### Examples

**Documentation Updates:**
```yaml
allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
  - CONTRIBUTING.md
```

**Configuration Files:**
```yaml
allowed-paths:
  - .github/workflows/**
  - config/**
  - .eslintrc.js
```

**Specific Directories:**
```yaml
allowed-paths:
  - examples/**
  - samples/**
```

**Multiple Patterns:**
```yaml
allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
  - scripts/generate-*.sh
```

## Commit Signing

### Enable Signing

Sign commits to provide cryptographic verification:

```yaml
outputs:
  create-pr: { sign: true }
  update-file: { sign: true }
```

### Why Sign Commits?

- Verifies commit authenticity
- Provides traceability
- Increases security and trust
- Required by some organizations

### Signing Requirements

For signing to work:
1. Must have GitHub account with GPG key configured
2. Agent runs in GitHub Actions (which handles signing)
3. Token must have appropriate permissions

## Creating Pull Requests

### Single PR Per Run

Recommended to prevent excessive PRs:

```yaml
permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**

outputs:
  create-pr: { max: 1 }
```

### Multiple PRs

Allow creating multiple PRs when handling batches:

```yaml
permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**
  - examples/**

outputs:
  create-pr: { max: 5, sign: true }
```

### PR Structure

Create PRs with clear title, description, and branch naming:

```markdown
Branch: docs/update-api-reference

Title: "docs: Update API reference for v2.0"

Body:
## Changes
- Updated endpoint documentation
- Added new response examples
- Fixed parameter descriptions

## Related Issues
Fixes #123

## Type of Change
- [ ] Bug fix
- [x] Documentation update
- [ ] New feature
- [ ] Breaking change

## Checklist
- [x] Changes follow style guidelines
- [x] Documentation updated
- [x] No new warnings generated
```

## Closing Pull Requests

### Basic Close

Close PRs without additional context:

```yaml
permissions:
  pull_requests: write

outputs:
  close-pr: true
```

### Close with Comment

Combine with `add-comment` to explain closure:

```yaml
permissions:
  pull_requests: write

outputs:
  close-pr: true
  add-comment: { max: 1 }
```

## Agent Configuration Examples

### Documentation Automation

```yaml
name: Auto-Update Docs
on:
  schedule:
    - cron: '0 0 * * MON'

permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**
  - README.md

outputs:
  create-pr: { sign: true, max: 1 }

inputs:
  pull_requests:
    since: 7d
```

**In your agent instructions:**
```markdown
Every Monday:
- Review PRs merged in the last week
- Update docs/CHANGELOG.md with new features and fixes
- Update README.md statistics
- Create PR titled "docs: Weekly update [date]"

Only create PR if there are changes to document.
```

### Dependency Update Automation

```yaml
name: Update Dependencies
on:
  schedule:
    - cron: '0 0 * * 0'

permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - package.json
  - package-lock.json
  - requirements.txt

outputs:
  create-pr: { sign: true, max: 1 }
  add-label: true

inputs:
  workflow_runs:
    since: 7d
```

**In your agent instructions:**
```markdown
If vulnerability alerts exist:
- Create branch: "deps/security-updates"
- Run npm audit fix or pip-audit --fix
- Create PR titled "chore: Security dependency updates"
- List fixed vulnerabilities in description
- Add labels: chore, dependencies

Only create PR if updates were applied.
```

### Code Generation and Updates

```yaml
name: Generate Files
on:
  pull_request:
    types:
      - opened
      - synchronize
    paths:
      - 'src/schema/**'

permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - src/generated/**
  - docs/api/**

outputs:
  create-pr: { max: 1 }
```

**In your agent instructions:**
```markdown
When schema files change:
- Generate TypeScript types from schema
- Generate API documentation
- If changes detected, create PR titled "chore: Regenerate from schema"
- Label: generated
- Link to triggering PR

Don't sign commits for generated code.
```

### Automated Refactoring

```yaml
name: Code Refactoring
on:
  schedule:
    - cron: '0 2 * * MON'

permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - src/**
  - tests/**

outputs:
  create-pr: { sign: true, max: 1 }

inputs:
  issues:
    since: 30d
```

**In your agent instructions:**
```markdown
Look for refactoring opportunities:
- Check for deprecation warnings
- Find unused imports or variables
- Identify repeated patterns (DRY violations)
- If found, create PR titled "refactor: Improve code quality [date]"
- Explain what changed and why
- Label: refactor
```

## Use Cases

### Documentation Updates
Keep docs in sync with code:
```yaml
allowed-paths:
  - docs/**
  - README.md
outputs:
  create-pr: { sign: true, max: 1 }
```

### Automated Maintenance
Dependency updates, code cleanup:
```yaml
allowed-paths:
  - package.json
  - .github/workflows/**
outputs:
  create-pr: { sign: true, max: 1 }
```

### Code Generation
Auto-generate code from schemas or templates:
```yaml
allowed-paths:
  - src/generated/**
outputs:
  create-pr: { max: 1 }
```

### Bulk Updates
Update multiple files across the repo:
```yaml
allowed-paths:
  - src/**
  - docs/**
outputs:
  create-pr: { sign: true, max: 1 }
```

## Best Practices

### 1. Strict Allowed Paths

Always use narrow `allowed-paths` patterns:

```yaml
# Good - specific paths
allowed-paths:
  - docs/**
  - README.md

# Avoid - too broad
allowed-paths:
  - '**'

# Avoid - single top-level directory
allowed-paths:
  - src/**
```

### 2. Set Creation Limits

Always use `max` for `create-pr`:

```yaml
outputs:
  create-pr: { max: 1 }  # Recommended
```

Without limits, PRs could proliferate unexpectedly.

### 3. Sign Important Changes

Use commit signing for production code:

```yaml
outputs:
  create-pr: { sign: true }      # Production code
  create-pr: { sign: false }     # Generated files, docs
```

### 4. Meaningful Commit Messages

Follow conventional commits:

```markdown
feat: Add new feature
fix: Resolve bug
docs: Update documentation
refactor: Improve code structure
chore: Maintenance tasks
test: Add or update tests
```

### 5. Provide Clear PR Descriptions

Include context and rationale:

```markdown
## What
Updated documentation for new API endpoints

## Why
API v2.0 has breaking changes that need documentation

## Testing
- [ ] Verified against actual endpoints
- [ ] Examples tested locally
```

## Security Considerations

### File Path Restrictions

`allowed-paths` is critical security control:

```yaml
# Good - restrictive
allowed-paths:
  - docs/**
  - README.md

# Bad - allows sensitive files
allowed-paths:
  - '**'
  - src/**  # Includes source code
```

### Commit Signing

Sign commits to verify authenticity:

```yaml
outputs:
  create-pr: { sign: true }
```

### PR Templates

Use PR templates to enforce standards:

```markdown
# .github/pull_request_template.md

## Changes
[Description here]

## Type
- [ ] Bug fix
- [ ] Feature
- [ ] Breaking change

## Testing
- [ ] Tests added/updated
- [ ] Verified locally
```

### Access Control

Grant minimal permissions:

```yaml
# Good - specific and limited
permissions:
  contents: write
  pull_requests: write

allowed-paths:
  - docs/**

outputs:
  create-pr: { max: 1 }
```

## Troubleshooting

### PRs Not Being Created

Check that:
1. `permissions` includes `contents: write` and `pull_requests: write`
2. `allowed-paths` is configured for `create-pr`
3. Agent has logic to determine when to create PRs
4. The `max` limit hasn't been reached

### Commits Not Being Signed

Verify:
1. `sign: true` is configured
2. GitHub account has GPG key configured
3. Agent is running in GitHub Actions (required for signing)

### Path Restrictions Too Strict

If PRs can't modify needed files:
1. Review `allowed-paths` patterns
2. Ensure patterns match intended files
3. Test glob patterns

### Unexpected File Changes

If PRs modify files outside `allowed-paths`:
1. Review `allowed-paths` configuration
2. Check for overly broad patterns like `**`
3. Verify agent logic

## Related Outputs

- [Comments (add-comment)](./comments/) - Pair with PRs for feedback
- [Labels (add-label, remove-label)](./labels/) - For PR organization
- [Files (update-file)](./files/) - For file modifications without PRs
- [Issues (create-issue, close-issue)](./issues/) - For issue management

## Next Steps

- Learn about [Permissions](../../guide/permissions/)
- Explore [File Modifications](./files/)
- Review [Security Best Practices](../../reference/security/)
