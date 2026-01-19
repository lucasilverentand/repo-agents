# Duplicate Detector Agent

Finds and links duplicate issues, closing clear duplicates while preserving information.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Issue opened or edited |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `issues: write` |
| **Rate Limit** | 2 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Duplicate Detector reduces maintenance burden by:

- **Finding** issues that describe the same problem
- **Linking** related issues for cross-reference
- **Closing** clear duplicates with helpful context
- **Preserving** unique information by noting it on originals

## Trigger Configuration

```yaml
on:
  issues:
    types: [opened, edited]
```

Triggers on:
- **opened**: Check new issues against existing ones
- **edited**: Re-check if description changes significantly

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Explain duplicate finding |
| `add-label` | unlimited | Mark as duplicate |
| `close-issue` | 1 | Close confirmed duplicates |

## Context Collection

```yaml
context:
  issues:
    states: [open]
    limit: 200
```

Loads recent open issues for comparison.

## Detection Criteria

### Semantic Similarity

| Factor | Weight | Example |
|--------|--------|---------|
| Same problem description | High | "App crashes on login" ≈ "Login causes crash" |
| Matching error messages | High | Same stack trace or error code |
| Same feature request | High | "Add dark mode" ≈ "Dark theme support" |
| Similar reproduction steps | Medium | Same sequence of actions |
| Related component | Medium | Both about authentication |
| Same environment | Low | Both on iOS |

### Confidence Levels

| Level | Score | Action |
|-------|-------|--------|
| **Definite** | 90%+ | Close as duplicate with link |
| **High** | 80-89% | Close with note, invite response |
| **Medium** | 50-79% | Link issues, don't close |
| **Low** | 30-49% | Mention similarity |
| **None** | <30% | No action |

## Detection Process

```
┌─────────────────────────────────────┐
│   Issue opened/edited               │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Extract Key Information         │
│  - Problem description              │
│  - Error messages/codes             │
│  - Steps to reproduce               │
│  - Affected components              │
│  - Environment details              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Search Open Issues              │
│  - Semantic similarity search       │
│  - Keyword matching                 │
│  - Error code matching              │
│  - Component overlap                │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Score Candidates                │
│  - Calculate similarity scores      │
│  - Weight by factor importance      │
│  - Consider issue age               │
│  - Check for false positives        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Take Action                     │
│  - Definite (90%+): Close           │
│  - High (80%+): Close with invite   │
│  - Medium (50%+): Link only         │
│  - Low (30%+): Mention              │
│  - None: No action                  │
└─────────────────────────────────────┘
```

## Duplicate Identification

### Strong Duplicate Signals

1. **Identical error messages**
   - Same stack trace
   - Same error code
   - Same error text

2. **Same reproduction steps**
   - Identical sequence
   - Same trigger conditions
   - Same environment

3. **Matching technical details**
   - Same file/function mentioned
   - Same configuration
   - Same version affected

### Weak Duplicate Signals

1. **Similar symptoms** (may be different root causes)
2. **Same component** (may be different issues)
3. **Similar timing** (may be coincidence)

### Not Duplicates

1. **Same area, different problems** (e.g., two different auth bugs)
2. **Same symptom, different cause** (investigate first)
3. **Enhancement vs bug** (request vs report)

## Comment Templates

### Definite Duplicate (Close)

```markdown
Thank you for reporting this issue!

This appears to be a duplicate of #123, which describes the same problem with
[brief description].

I'm closing this as a duplicate to keep the discussion in one place. Please
follow #123 for updates and feel free to add any additional information there
that might help with resolution.

If you believe this is actually a different issue, please comment and we'll
reopen for further investigation.
```

### High Confidence Duplicate (Close with invite)

```markdown
Thank you for this report!

This looks very similar to #456, which describes [brief description].

I'm closing this as a likely duplicate, but if you have additional information
that distinguishes this issue, please comment and we can reopen.

Key similarity: [what makes them similar]
```

### Medium Confidence (Link only)

```markdown
This issue appears related to #789.

**Similarity**: Both describe [common aspect].

I'm not closing this as a duplicate because [difference noted], but you may want
to follow #789 as well, as they might have the same root cause or solution.
```

### Low Confidence (Mention)

```markdown
FYI: You might want to check #101, which describes a potentially related issue
with [topic]. It's not clear if they're duplicates, but there may be useful
context there.
```

## Preserving Information

When closing duplicates, the agent should:

1. **Quote unique details** from the duplicate on the original
2. **Note different environments** tested
3. **Add reproduction steps** if more detailed
4. **Reference workarounds** mentioned

### Example

On original issue #123:
```markdown
Additional context from #456 (closed as duplicate):

> "I also see this on Windows 11 with Node 20"
> "Workaround: Setting TIMEOUT=60 seems to help temporarily"

@reporter from #456 - feel free to follow here for updates!
```

## Agent Instructions

The full instructions for Claude should cover:

### Comparison Strategy

1. **Extract keywords** - Problem, error, component
2. **Identify signatures** - Error messages, codes, traces
3. **Compare semantically** - Same problem, different words
4. **Consider context** - Version, environment, timing

### Scoring Guidelines

1. **Same error message** = +40%
2. **Same reproduction steps** = +30%
3. **Same component** = +20%
4. **Similar description** = +15%
5. **Same environment** = +10%

### Safety Guidelines

1. **When in doubt, don't close** - Link instead
2. **Preserve information** - Note unique details
3. **Be welcoming** - Thank reporters
4. **Enable reversal** - Explain how to reopen

### Key Behaviors

- **Never dismiss** - Every report has value
- **Always link** - Help reporters follow updates
- **Be specific** - Explain why it's a duplicate
- **Be humble** - Acknowledge uncertainty

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| New issues | `issues: opened` |
| Edited issues | `issues: edited` |

### Coordination Notes

- Runs after [Issue Analyzer](./issue-analyzer.md) validates completeness
- Does not interfere with triage or implementation pipeline
- Closed duplicates are excluded from other agent processing

## Example Scenarios

### Scenario 1: Definite Duplicate

**New Issue:**
```
Title: App crashes when clicking export

The app crashes whenever I click the export button.
Error: "Cannot read property 'map' of undefined"
at ExportService.ts:45
```

**Existing Issue #100:**
```
Title: Export button causes crash

Clicking export throws an error.
Error: "Cannot read property 'map' of undefined"
at ExportService.ts:45
```

**Action:**
- Confidence: 95% (same error, same location)
- Close new issue as duplicate of #100
- Comment explaining the match

### Scenario 2: Medium Confidence

**New Issue:**
```
Title: Login not working

I can't log in. It just shows a spinner forever.
```

**Existing Issue #200:**
```
Title: Authentication timeout

Login takes forever and eventually times out.
Using OAuth provider XYZ.
```

**Action:**
- Confidence: 60% (similar symptom, could be different cause)
- Link issues, don't close
- Comment noting potential relationship

### Scenario 3: Different Issues

**New Issue:**
```
Title: Password reset email not received

I requested a password reset but never got the email.
```

**Existing Issue #300:**
```
Title: Login button unresponsive

The login button doesn't respond when I click it.
```

**Action:**
- Confidence: 10% (both auth-related, different problems)
- No action needed

## Frontmatter Reference

```yaml
---
name: Duplicate Detector
on:
  issues:
    types: [opened, edited]
permissions:
  issues: write
outputs:
  add-comment: { max: 1 }
  add-label: true
  close-issue: true
context:
  issues:
    states: [open]
    limit: 200
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 4096
  temperature: 0.4
---
```

## Customization Options

### Confidence Thresholds

Adjust thresholds for more/less aggressive duplicate closing.

### Search Scope

Include closed issues for broader matching:
```yaml
context:
  issues:
    states: [open, closed]
    limit: 500
```

### Label-Based Exclusions

Exclude certain labels from duplicate consideration (e.g., `not-a-bug`).

## Metrics to Track

- Duplicates detected per period
- False positive rate (reopened issues)
- Time saved (estimated)
- Reporter feedback
- Original issue engagement after duplicate linking
