---
title: Files (update-file)
description: Enable agents to modify repository files
---

The `update-file` output enables your agent to modify files directly in your repository. This is the most powerful output, requiring careful configuration to prevent unintended changes.

## Configuration

### Simple Enable

Enable file updates with `allowed-paths`:

```yaml
permissions:
  contents: write

allowed-paths:
  - docs/**
  - README.md

outputs:
  update-file: true
```

**Note:** `update-file` requires `allowed-paths` allowlist.

### With Options

Enable commit signing for traceability:

```yaml
permissions:
  contents: write

allowed-paths:
  - docs/**

outputs:
  update-file: { sign: true }
```

**Options:**
- `sign` - Sign commits with GPG key (default: false)

## Permission Requirements

The `update-file` output requires two critical configurations:

### 1. GitHub Permissions

```yaml
permissions:
  contents: write
```

This is the only permission required for file modifications.

### 2. Path Allowlist

```yaml
allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
```

The `allowed-paths` field is **required** and restricts which files can be modified.

### Full Configuration Example

```yaml
permissions:
  contents: write

allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
  - scripts/*.sh

outputs:
  update-file: { sign: true }
```

## Allowed Paths Configuration

### Path Pattern Syntax

- `**` - Matches any number of nested directories
- `*` - Matches any filename in current directory
- `*.md` - Matches all markdown files
- `docs/**/*.md` - Markdown files in any docs subdirectory
- Exact paths - `README.md`, `.github/workflows/ci.yml`

### Pattern Examples

**Documentation Only:**
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
  - .prettierrc.json
```

**Specific Directories:**
```yaml
allowed-paths:
  - examples/**
  - samples/**
  - templates/**
```

**Multiple File Types:**
```yaml
allowed-paths:
  - docs/**
  - '*.md'
  - scripts/**
  - data/*.json
```

**Mixed Specific and Wildcard:**
```yaml
allowed-paths:
  - README.md
  - CHANGELOG.md
  - docs/**
  - examples/**
```

### Pattern Best Practices

**Good - Specific and Restrictive:**
```yaml
allowed-paths:
  - docs/**
  - README.md
```

**Avoid - Too Broad:**
```yaml
allowed-paths:
  - '**'         # Everything!
```

**Avoid - Risky Patterns:**
```yaml
allowed-paths:
  - src/**       # Source code
  - '*.json'     # All JSON anywhere
  - '**/*.yml'   # All YAML files
```

## File Modification Examples

### Documentation Updates

Automatically keep documentation current:

```yaml
permissions:
  contents: write

allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md

outputs:
  update-file: { sign: true }
```

### Configuration Sync

Update generated or synchronized configuration:

```yaml
permissions:
  contents: write

allowed-paths:
  - .github/workflows/generated-*.yml
  - config/auto-generated.json

outputs:
  update-file: { sign: false }
```

### Changelog Management

Automatically maintain changelog:

```yaml
permissions:
  contents: write

allowed-paths:
  - CHANGELOG.md
  - NEWS.md

outputs:
  update-file: { sign: true }
```

## Commit Signing

### Enable Signing

Sign commits for production changes:

```yaml
outputs:
  update-file: { sign: true }
```

### When to Sign

**Do sign:**
- Production code changes
- Important documentation
- Configuration files
- Security-related changes

**Don't sign:**
- Generated files
- Temporary files
- Auto-generated documentation
- Cache files

```yaml
# Sign important changes
outputs:
  update-file: { sign: true }

# Don't sign auto-generated
outputs:
  update-file: { sign: false }
```

### Signing Requirements

For signing to work:
1. Must run in GitHub Actions (automatic)
2. Signing is handled by GitHub
3. Requires proper token permissions

## Agent Configuration Examples

### Documentation Maintenance

```yaml
name: Update Documentation
on:
  schedule:
    - cron: '0 0 * * SUN'

permissions:
  contents: write

allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md

outputs:
  update-file: { sign: true }

inputs:
  pull_requests:
    since: 7d
```

**In your agent instructions:**
```markdown
Update documentation weekly:
- Review merged PRs from the past week
- Update docs/CHANGELOG.md with new features, bug fixes, breaking changes
- Update README.md statistics and latest release link

Only update if changes are needed.
```

### Version Bump Automation

```yaml
name: Bump Version
on:
  release:
    types:
      - published

permissions:
  contents: write

allowed-paths:
  - package.json
  - package-lock.json
  - version.txt
  - src/version.rs

outputs:
  update-file: { sign: true }
```

**In your agent instructions:**
```markdown
When a release is published:
- Extract version from release tag
- Update version in: package.json, version.txt, src/version.rs
- Commit message: "chore: Bump version to [version]"

Verify files exist before updating.
```

### README Statistics Update

```yaml
name: Update README Stats
on:
  schedule:
    - cron: '0 9 * * MON'

permissions:
  contents: write

allowed-paths:
  - README.md

outputs:
  update-file: true

inputs:
  pull_requests:
    since: 30d
  issues:
    since: 30d
```

**In your agent instructions:**
```markdown
Every Monday, update README.md statistics:
- Count PRs merged in last 30 days
- Count issues closed in last 30 days
- Update the "Statistics" section only
- Include latest version

Leave the rest of README unchanged.
```

### Contribution Guide Updates

```yaml
name: Update Contributing Guide
on:
  pull_request:
    types:
      - closed
    paths:
      - '.github/workflows/**'
      - 'docs/**'

permissions:
  contents: write

allowed-paths:
  - CONTRIBUTING.md
  - docs/contributing/**

outputs:
  update-file: { sign: true }
```

**In your agent instructions:**
```markdown
When workflow or doc changes merge:
- Identify what changed
- Update CONTRIBUTING.md if workflow requirements, dev setup, or process changed
- Update docs/contributing/setup.md with new details
- Keep style consistent

Only update if changes affect contributors.
```

### Configuration File Management

```yaml
name: Generate Configuration
on:
  workflow_dispatch

permissions:
  contents: write

allowed-paths:
  - .github/workflows/generated-*.yml
  - config/*.json

outputs:
  update-file: true
```

**In your agent instructions:**
```markdown
Generate configuration files:
- .github/workflows/generated-matrix.yml
- config/feature-flags.json
- config/environment-vars.json

Don't sign commits (auto-generated).
```

## Use Cases

### Documentation Automation
Keep docs, READMEs, and changelogs current:
```yaml
allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
outputs:
  update-file: { sign: true }
```

### Version Management
Bump versions across multiple files:
```yaml
allowed-paths:
  - package.json
  - version.txt
outputs:
  update-file: { sign: true }
```

### Configuration Generation
Auto-generate configuration files:
```yaml
allowed-paths:
  - config/**
  - .github/workflows/generated-*.yml
outputs:
  update-file: false
```

### Statistics Updates
Keep README statistics current:
```yaml
allowed-paths:
  - README.md
outputs:
  update-file: true
```

### Data File Updates
Update JSON, YAML, or CSV data files:
```yaml
allowed-paths:
  - data/**
outputs:
  update-file: true
```

## Best Practices

### 1. Strict Path Restrictions

Always use narrow `allowed-paths` patterns:

```yaml
# Good - specific files
allowed-paths:
  - docs/**
  - README.md

# Bad - too broad
allowed-paths:
  - '**'
  - src/**
```

### 2. Start Restrictive

Begin with minimal permissions:

```yaml
# Start here
allowed-paths:
  - docs/**

# Expand only if needed
allowed-paths:
  - docs/**
  - README.md
  - CHANGELOG.md
```

### 3. Sign Important Changes

Use signing for production changes:

```yaml
# For important changes
outputs:
  update-file: { sign: true }

# For generated files
outputs:
  update-file: { sign: false }
```

### 4. Preserve Content

Don't overwrite entire files unless necessary:

```markdown
# Good - targeted updates
Update the "Version" section only

# Bad - replace entire file
Rewrite the entire README
```

### 5. Validate Changes

Have the agent verify changes before updating:

```markdown
1. Check if file exists
2. Validate new content format
3. Preview changes
4. Commit only if valid
```

## Security Considerations

### Path Restrictions Are Critical

The `allowed-paths` field is your primary security control:

```yaml
# GOOD - Limited to docs
allowed-paths:
  - docs/**
  - README.md

# BAD - Can modify anything
allowed-paths:
  - '**'

# BAD - Can modify source code
allowed-paths:
  - src/**
  - docs/**
```

### Dangerous Patterns to Avoid

```yaml
# Avoid these patterns
allowed-paths:
  - '**'                 # Everything
  - '**/*.json'          # All JSON files anywhere
  - '.github/**'         # Workflow modifications
  - 'src/**'             # Source code
  - '*.yml'              # All YAML at root
```

### Safe Patterns

```yaml
# Good - specific and safe
allowed-paths:
  - docs/**              # Only docs
  - README.md            # Specific file
  - CHANGELOG.md         # Specific file
  - examples/**          # Examples directory
```

### Prevent Malicious Modifications

Never allow modifications to:
- Source code directories
- Workflow files
- Configuration that affects security
- Sensitive data files

```yaml
# Bad - allows dangerous files
allowed-paths:
  - '.github/workflows/**'  # Can modify CI/CD!
  - 'src/**'               # Can modify source!
  - '.env'                 # Can modify secrets!
```

### Content Validation

Have agents validate content before modifying:

```markdown
Before updating:
1. Validate file format (JSON validity, YAML syntax)
2. Verify content matches expected structure
3. Check file size isn't excessive
4. Ensure no injection attempts
```

## Troubleshooting

### Files Not Being Modified

Check that:
1. `permissions` includes `contents: write`
2. `allowed-paths` is configured and correct
3. File paths in agent match patterns exactly
4. Agent has logic to identify files to update

### Path Restrictions Too Strict

If the agent can't modify needed files:
1. Review `allowed-paths` patterns
2. Test patterns against actual file paths
3. Add patterns as needed
4. Remember: `/` is part of the path: `docs/guide/api.md`

### Commits Not Being Signed

Verify:
1. `sign: true` is configured
2. Agent is running in GitHub Actions
3. Token has appropriate permissions

### Unwanted File Changes

If files are being modified incorrectly:
1. Review the agent instructions
2. Check `allowed-paths` for overly broad patterns
3. Add conditions to the agent logic
4. Test with dry-run first

## Related Outputs

- [Pull Requests (create-pr, close-pr)](./pull-requests/) - Alternative for code review
- [Comments (add-comment)](./comments/) - For explaining changes
- [Issues (create-issue, close-issue)](./issues/) - For coordinating changes

## Next Steps

- Learn about [Permissions](../../guide/permissions/)
- Review [Security Best Practices](../../reference/security/)
- Explore [Examples](../../examples/issue-triage/)
