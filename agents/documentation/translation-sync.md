# Translation Sync Agent

Keeps translated documentation in sync with the source language.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR merge to main (docs changes), weekly schedule |
| **Schedule** | Sunday 8am UTC |
| **Permissions** | `contents: write`, `pull_requests: write`, `issues: write` |
| **Rate Limit** | 60 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Translation Sync Agent maintains multilingual docs by:

- **Detecting** changes in source language documentation
- **Identifying** translated files that need updates
- **Translating** new and changed content
- **Preserving** existing translations where unchanged
- **Tracking** translation coverage and freshness

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "docs/**"
  schedule:
    - cron: '0 8 * * 0'  # Sunday 8am UTC
  workflow_dispatch:
    inputs:
      language:
        description: 'Target language code (e.g., es, fr, ja)'
        required: false
      force_full:
        description: 'Force full retranslation'
        type: boolean
        default: false
```

Triggers on:
- **PR merge**: When source docs change
- **Weekly**: Catch any missed updates
- **Manual**: Force sync or specific language

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 1 | Translation updates |
| `create-issue` | 2 | Complex translation needs |
| `update-file` | unlimited | Update translated files |
| `add-label` | unlimited | Status labels |

## Allowed Paths

```yaml
allowed-paths:
  - "docs/*/**"  # All language subdirectories
  - "i18n/**"
  - "locales/**"
```

Only modifies documentation and translation files.

## Context Collection

```yaml
context:
  pull_requests:
    states: [merged]
    paths: ["docs/en/**"]  # Source language path
    limit: 20
  since: "7d"
```

Tracks changes to source documentation.

## Directory Structure

### Standard Layout

```
docs/
├── en/                    # Source language (English)
│   ├── getting-started.md
│   ├── api/
│   │   └── users.md
│   └── guides/
│       └── authentication.md
├── es/                    # Spanish translations
│   ├── getting-started.md
│   ├── api/
│   │   └── users.md
│   └── guides/
│       └── authentication.md
├── fr/                    # French translations
│   └── ...
├── ja/                    # Japanese translations
│   └── ...
└── zh/                    # Chinese translations
    └── ...
```

### Translation Metadata

Each translated file includes metadata:

```markdown
---
title: Primeros pasos
original: docs/en/getting-started.md
original_hash: abc123def456
last_synced: 2024-01-15
translation_status: current  # current | outdated | needs_review
---
```

## Sync Process

```
┌─────────────────────────────────────┐
│   Trigger (PR merge/schedule)       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Detect Source Changes           │
│  - Find changed source files        │
│  - Calculate content hashes         │
│  - Compare with translation hashes  │
│  - List files needing sync          │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Analyze Change Scope            │
│  - Full file rewrite?               │
│  - Section changes?                 │
│  - Minor text updates?              │
│  - Structural changes?              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Generate Translations           │
│  - Translate changed sections       │
│  - Preserve unchanged content       │
│  - Maintain formatting              │
│  - Keep code blocks untranslated    │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Validate Translations           │
│  - Check completeness               │
│  - Verify links work                │
│  - Ensure code examples intact      │
│  - Check formatting preserved       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Create PR                       │
│  - Group by language                │
│  - Include sync report              │
│  - Flag for native review           │
└─────────────────────────────────────┘
```

## Translation Guidelines

### What to Translate

| Content | Translate | Notes |
|---------|-----------|-------|
| Prose text | ✅ Yes | All explanatory text |
| Headings | ✅ Yes | Section titles |
| List items | ✅ Yes | Bullet points |
| Image alt text | ✅ Yes | Accessibility |
| UI strings in examples | ✅ Yes | When showing user-facing text |
| Error messages | ✅ Yes | User-facing errors |

### What NOT to Translate

| Content | Translate | Notes |
|---------|-----------|-------|
| Code blocks | ❌ No | Keep original |
| Variable names | ❌ No | Technical identifiers |
| File paths | ❌ No | System paths |
| URLs | ❌ No | Links should work |
| API endpoints | ❌ No | Technical specifications |
| CLI commands | ❌ No | Must be exact |
| Package names | ❌ No | Technical identifiers |

### Special Handling

```markdown
<!-- Source (English) -->
Run the following command to install:

```bash
npm install @org/package
```

This will output:
```
Installation complete!
```

<!-- Translation (Spanish) -->
Ejecuta el siguiente comando para instalar:

```bash
npm install @org/package
```

Esto mostrará:
```
Installation complete!
```
<!-- Note: CLI output kept in English as it matches actual program output -->
```

## Supported Languages

| Code | Language | Status |
|------|----------|--------|
| `en` | English | Source |
| `es` | Spanish | Supported |
| `fr` | French | Supported |
| `de` | German | Supported |
| `ja` | Japanese | Supported |
| `zh` | Chinese (Simplified) | Supported |
| `ko` | Korean | Supported |
| `pt` | Portuguese | Supported |

## PR Template

```markdown
## Translation Sync: [Languages]

### Summary

Syncs translations for documentation changes from the past week.

### Source Changes

| File | Change Type | PRs |
|------|-------------|-----|
| `docs/en/getting-started.md` | Updated | #234 |
| `docs/en/api/users.md` | New section | #235, #236 |
| `docs/en/guides/auth.md` | Minor fixes | #237 |

### Translation Updates

#### Spanish (es)
| File | Status |
|------|--------|
| `docs/es/getting-started.md` | ✅ Updated |
| `docs/es/api/users.md` | ✅ Updated |
| `docs/es/guides/auth.md` | ✅ Updated |

#### French (fr)
| File | Status |
|------|--------|
| `docs/fr/getting-started.md` | ✅ Updated |
| `docs/fr/api/users.md` | ✅ Updated |
| `docs/fr/guides/auth.md` | ✅ Updated |

#### Japanese (ja)
| File | Status |
|------|--------|
| `docs/ja/getting-started.md` | ✅ Updated |
| `docs/ja/api/users.md` | ⚠️ Needs review |
| `docs/ja/guides/auth.md` | ✅ Updated |

### Review Notes

- Japanese API docs flagged for review due to complex technical terminology
- All code blocks preserved unchanged
- Links updated to point to correct language versions

### Requested Reviewers

- @spanish-maintainer for Spanish
- @french-maintainer for French
- @japanese-maintainer for Japanese
```

## Issue Template (Complex Translation)

```markdown
## Translation Help Needed: [File]

### Context

The following content requires human translation review due to its complexity.

### Source Content
**File**: `docs/en/guides/advanced-concepts.md`
**Section**: "Understanding Event Loops"

```markdown
The event loop is a fundamental concept that determines how asynchronous
operations are handled. Unlike traditional threading models, JavaScript uses
a single-threaded event loop that processes callbacks in a specific order...
```

### Why AI Translation Insufficient

- Contains nuanced technical concepts
- Requires domain expertise for accurate translation
- Idiomatic expressions that don't translate directly

### Target Languages
- [ ] Japanese (`docs/ja/guides/advanced-concepts.md`)
- [ ] Chinese (`docs/zh/guides/advanced-concepts.md`)

### Current Machine Translation (for reference)

[Machine translation provided as starting point, but flagged for review]

---
Labels: `translation`, `help-wanted`, `documentation`
```

## Sync Status Report

```markdown
## 📊 Translation Sync Report

### Coverage Summary

| Language | Files | Translated | Current | Outdated |
|----------|-------|------------|---------|----------|
| Spanish | 45 | 45 (100%) | 42 (93%) | 3 (7%) |
| French | 45 | 43 (96%) | 40 (89%) | 3 (7%) |
| Japanese | 45 | 40 (89%) | 35 (78%) | 5 (11%) |
| Chinese | 45 | 38 (84%) | 30 (67%) | 8 (18%) |

### Recently Updated

- `getting-started.md`: All languages synced ✅
- `api/users.md`: es, fr synced; ja, zh pending

### Needs Attention

1. **Japanese**: 5 files outdated by >30 days
2. **Chinese**: 8 files outdated, 7 files missing

### Sync History

| Date | Files Synced | Languages |
|------|--------------|-----------|
| 2024-01-15 | 12 | es, fr, ja, zh |
| 2024-01-08 | 5 | es, fr |
| 2024-01-01 | 8 | es, fr, ja |
```

## Agent Instructions

The full instructions for Claude should cover:

### Change Detection Strategy

1. **Compare hashes** - Detect content changes
2. **Analyze diff** - Understand what changed
3. **Map sections** - Find corresponding translated sections
4. **Prioritize** - Important docs first

### Translation Guidelines

1. **Preserve meaning** - Accuracy over literalness
2. **Match tone** - Keep same level of formality
3. **Respect culture** - Appropriate for target audience
4. **Keep technical** - Don't translate code/identifiers

### Quality Standards

1. **Completeness** - All content translated
2. **Consistency** - Same terms throughout
3. **Formatting** - Preserve markdown structure
4. **Links** - Update to correct language version

### Key Behaviors

- **Never modify** code blocks
- **Flag uncertainty** - Create issues for complex content
- **Preserve structure** - Same headings/sections
- **Track freshness** - Update metadata

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |
| Creates issue | May be claimed by translators |

### Triggered By

| Source | Via |
|--------|-----|
| Doc changes | `pull_request: closed` |
| Schedule | Cron (Sunday 8am UTC) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Works after [Documentation Sync](./documentation-sync.md)
- Complements [API Docs Generator](./api-docs-generator.md)
- Source changes should trigger translation sync

## Example Scenarios

### Scenario 1: Section Update

**Source Change:**
```diff
  ## Installation

- Run `npm install package` to install.
+ Run `bun add package` to install.
+
+ Alternatively, use npm:
+ ```bash
+ npm install package
+ ```
```

**Action:**
1. Detect changed section in source
2. Find corresponding sections in translations
3. Translate new/changed prose
4. Keep code blocks unchanged
5. Update all language versions

### Scenario 2: New File

**Source Change:**
- New file: `docs/en/guides/new-feature.md`

**Action:**
1. Detect new source file
2. Create corresponding files for all languages
3. Translate full content
4. Add translation metadata
5. Create PR with all new files

### Scenario 3: Complex Content

**Source Change:**
- Technical deep-dive with domain-specific terminology

**Action:**
1. Attempt translation
2. Flag as needing review
3. Create issue for native speaker review
4. Provide machine translation as starting point

## Frontmatter Reference

```yaml
---
name: Translation Sync
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "docs/**"
  schedule:
    - cron: '0 8 * * 0'
  workflow_dispatch:
    inputs:
      language:
        description: 'Target language code'
        required: false
permissions:
  contents: write
  pull_requests: write
  issues: write
outputs:
  create-pr: { max: 1 }
  create-issue: { max: 2 }
  update-file: true
  add-label: true
allowed-paths:
  - "docs/*/**"
  - "i18n/**"
  - "locales/**"
context:
  pull_requests:
    states: [merged]
    paths: ["docs/en/**"]
    limit: 20
  since: "7d"
rate_limit_minutes: 60
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.5
---
```

## Customization Options

### Source Language

Configure primary documentation language.

### Target Languages

Configure which languages to maintain.

### Translation Memory

Use glossary for consistent terminology.

## Metrics to Track

- Translation coverage by language
- Sync lag (time from source change to translation)
- Review rate for flagged translations
- Contributor engagement per language
- Page views by language
