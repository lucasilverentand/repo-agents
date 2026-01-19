# Release Notes Generator Agent

Automatically generates comprehensive release notes from merged pull requests.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Release published, workflow_dispatch |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `contents: write`, `pull_requests: read` |
| **Rate Limit** | 10 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Release Notes Generator creates professional changelogs by:

- **Analyzing** all PRs merged since the last release
- **Categorizing** changes by type (features, fixes, breaking)
- **Summarizing** technical changes in user-friendly language
- **Highlighting** breaking changes and migration needs
- **Crediting** contributors automatically

## Trigger Configuration

```yaml
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag to generate notes for'
        required: true
```

Triggers on:
- **release published**: Generate notes when release is created
- **workflow_dispatch**: Manual generation for any tag

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `update-file` | 1 | Update CHANGELOG.md |
| `add-comment` | 1 | Post notes on release |

## Allowed Paths

```yaml
allowed-paths:
  - "CHANGELOG.md"
  - "RELEASE_NOTES.md"
```

Only updates changelog files.

## Context Collection

```yaml
context:
  pull_requests:
    states: [merged]
    limit: 200
  commits:
    branches: [main]
    limit: 500
  since: "last-release"
```

Collects all PRs and commits since the previous release.

## Change Categories

### Standard Categories

| Category | PR Labels | Description |
|----------|-----------|-------------|
| 🚨 Breaking Changes | `breaking-change` | API incompatibilities |
| ✨ New Features | `feature`, `enhancement` | New functionality |
| 🐛 Bug Fixes | `bug`, `fix` | Issue resolutions |
| 🔒 Security | `security` | Security patches |
| ⚡ Performance | `performance` | Speed improvements |
| 📚 Documentation | `documentation`, `docs` | Doc updates |
| 🧹 Maintenance | `chore`, `refactor` | Internal improvements |
| 📦 Dependencies | `dependencies` | Dependency updates |

### Priority Ordering

1. Breaking Changes (always first)
2. Security (critical visibility)
3. New Features
4. Bug Fixes
5. Performance
6. Documentation
7. Maintenance
8. Dependencies

## Generation Process

```
┌─────────────────────────────────────┐
│   Release published                 │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Determine Release Range         │
│  - Find previous release tag        │
│  - Get current release tag          │
│  - Calculate commit range           │
│  - Note release date                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Collect Merged PRs              │
│  - Query PRs merged in range        │
│  - Include PR metadata              │
│  - Get associated commits           │
│  - Note PR authors                  │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Categorize Changes              │
│  - Parse PR labels                  │
│  - Analyze PR titles/descriptions   │
│  - Detect breaking changes          │
│  - Group by category                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Generate Summaries              │
│  - Write user-friendly descriptions │
│  - Highlight important changes      │
│  - Note migration requirements      │
│  - Credit contributors              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Update Changelog                │
│  - Format in Keep a Changelog style │
│  - Prepend to CHANGELOG.md          │
│  - Update release description       │
└─────────────────────────────────────┘
```

## Output Format

### Changelog Entry

```markdown
## [2.0.0] - 2024-01-15

### 🚨 Breaking Changes

- **API**: Renamed `createUser()` to `registerUser()` for clarity ([#234])
  - Migration: Update all calls from `createUser(email)` to `registerUser({ email })`
- **Config**: Removed deprecated `legacyMode` option ([#228])

### ✨ New Features

- Add dark mode support with automatic system preference detection ([#245]) - @contributor1
- Implement webhook notifications for account events ([#241]) - @contributor2
- Add bulk export functionality for user data ([#238])

### 🐛 Bug Fixes

- Fix race condition in concurrent file uploads ([#251]) - @contributor3
- Resolve memory leak in long-running processes ([#247])
- Fix incorrect timezone handling in scheduled tasks ([#243])

### 🔒 Security

- Upgrade authentication library to address CVE-2024-1234 ([#252])
- Add rate limiting to prevent brute force attacks ([#249])

### ⚡ Performance

- Optimize database queries reducing load time by 40% ([#246])
- Implement caching for frequently accessed resources ([#242])

### 📚 Documentation

- Add comprehensive API reference documentation ([#250])
- Update getting started guide with new examples ([#244])

### 🧹 Maintenance

- Migrate test suite to Vitest ([#248])
- Refactor authentication module for better maintainability ([#240])

### 📦 Dependencies

- Bump typescript from 5.2 to 5.3 ([#253])
- Update React to 18.2.0 ([#239])

---

### Contributors

Thanks to all contributors who made this release possible:

@contributor1, @contributor2, @contributor3, @contributor4

**Full Changelog**: https://github.com/org/repo/compare/v1.5.0...v2.0.0

[#234]: https://github.com/org/repo/pull/234
[#228]: https://github.com/org/repo/pull/228
...
```

### Release Summary

For GitHub release description:

```markdown
## Highlights

🎉 **Dark Mode Support** - The most requested feature is here! Enable dark mode in settings or let it follow your system preference.

🔒 **Enhanced Security** - Critical security updates and new rate limiting protection.

⚡ **40% Faster** - Significant performance improvements across the board.

## ⚠️ Breaking Changes

This release includes breaking changes. Please review the migration guide before upgrading.

- `createUser()` renamed to `registerUser()`
- `legacyMode` config option removed

[View full changelog](./CHANGELOG.md)
```

## Writing Guidelines

### Summaries Should Be

1. **User-focused** - Explain benefit, not implementation
2. **Concise** - One line when possible
3. **Actionable** - What can users do now?
4. **Consistent** - Same style throughout

### Good vs Bad Examples

| Bad | Good |
|-----|------|
| "Refactored UserService class" | "Improved reliability of user operations" |
| "Fixed bug in #234" | "Fix login failures on slow connections" |
| "Added new parameter" | "Add option to customize timeout duration" |
| "Updated dependencies" | "Security update for authentication library" |

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Collect all PRs** - Get full list since last release
2. **Read PR content** - Understand what changed
3. **Check labels** - Use for categorization
4. **Analyze impact** - What does this mean for users?

### Writing Guidelines

1. **Be user-centric** - Write for end users
2. **Highlight impact** - What's the benefit?
3. **Note breaking changes** - Be explicit about migrations
4. **Credit contributors** - Acknowledge all authors

### Formatting Guidelines

1. **Use Keep a Changelog** format
2. **Link to PRs** - Reference all PRs
3. **Group logically** - By category then importance
4. **Be consistent** - Same style throughout

### Key Behaviors

- **Never miss** breaking changes
- **Always credit** contributors
- **Write clearly** - avoid jargon
- **Be complete** - include all significant changes

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| Release | `release: published` |
| Human | `workflow_dispatch` |

### Coordination Notes

- Uses information from [Breaking Change Detector](./breaking-change-detector.md)
- May reference [PR Reviewer](./pr-reviewer.md) feedback
- Changelog should match semantic versioning

## Example Scenarios

### Scenario 1: Major Release

**Context:**
- Previous release: v1.5.0
- New release: v2.0.0
- 45 PRs merged, 3 breaking changes

**Action:**
1. Collect all 45 PRs
2. Categorize by labels
3. Highlight 3 breaking changes at top
4. Generate migration guide
5. Credit all 12 contributors

### Scenario 2: Patch Release

**Context:**
- Previous release: v2.0.0
- New release: v2.0.1
- 3 PRs merged, all bug fixes

**Action:**
1. Collect 3 PRs
2. All categorized as Bug Fixes
3. Generate concise changelog
4. No breaking changes section needed

### Scenario 3: Security Release

**Context:**
- Urgent security fix
- 1 PR merged with `security` label

**Action:**
1. Generate security-focused notes
2. Highlight CVE reference
3. Recommend immediate upgrade
4. Keep details minimal (no exploit info)

## Frontmatter Reference

```yaml
---
name: Release Notes Generator
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      tag:
        description: 'Release tag'
        required: true
permissions:
  contents: write
  pull_requests: read
outputs:
  update-file: { max: 1 }
  add-comment: { max: 1 }
allowed-paths:
  - "CHANGELOG.md"
  - "RELEASE_NOTES.md"
context:
  pull_requests:
    states: [merged]
    limit: 200
  commits:
    branches: [main]
    limit: 500
rate_limit_minutes: 10
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.5
---
```

## Customization Options

### Category Mapping

Customize label-to-category mapping:
```yaml
categories:
  breaking: [breaking-change, breaking]
  features: [feature, enhancement, feat]
  fixes: [bug, fix, bugfix]
```

### Output Format

Choose changelog format:
- Keep a Changelog (default)
- Conventional Changelog
- Custom template

### Contributor Display

Configure how contributors are shown.

## Metrics to Track

- Release notes generation time
- Manual edits needed after generation
- User feedback on clarity
- Coverage of PRs (none missed)
- Breaking change documentation accuracy
