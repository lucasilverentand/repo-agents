# Issue Formatter Agent

Restructures poorly formatted issues into proper templates while preserving all original content and meaning.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | `needs-formatting` label added |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `issues: write` |
| **Rate Limit** | 2 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Issue Formatter improves issue readability and structure without changing the substance. This helps:

- **Maintainers**: Quickly understand issues with consistent formatting
- **Contributors**: See examples of well-structured issues
- **Automation**: Other agents work better with structured content
- **Search**: Better structured issues are easier to find

## Trigger Configuration

```yaml
on:
  issues:
    types: [labeled]
trigger_labels: [needs-formatting]
```

Only triggers when a human or another agent explicitly requests formatting via label.

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `edit-issue` | 1 | Update issue body with formatted content |
| `add-comment` | 1 | Explain what was reformatted |
| `add-label` | unlimited | Mark as formatted |
| `remove-label` | unlimited | Remove trigger label |

## Labels Used

### Labels Set by This Agent

| Label | When Applied |
|-------|--------------|
| `formatted` | After successful reformatting |

### Labels Removed by This Agent

| Label | When Removed |
|-------|--------------|
| `needs-formatting` | After processing |

### Labels That Trigger This Agent

| Label | Effect |
|-------|--------|
| `needs-formatting` | Triggers formatting process |

## Templates

### Bug Report Template

```markdown
## Summary
[Brief description of the bug]

## Steps to Reproduce
1. [First step]
2. [Second step]
3. [Continue as needed]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- **OS**: [e.g., macOS 14.0, Windows 11, Ubuntu 22.04]
- **Version**: [e.g., v1.2.3]
- **Browser**: [if applicable]

## Additional Context
[Screenshots, logs, related issues]
```

### Feature Request Template

```markdown
## Summary
[Brief description of the feature]

## Problem Statement
[What problem does this solve? Why is it needed?]

## Proposed Solution
[How should this work?]

## Alternatives Considered
[Other approaches thought about]

## Additional Context
[Mockups, examples, related features]
```

### Question Template

```markdown
## Question
[The specific question being asked]

## Context
[Background information relevant to the question]

## What I've Tried
[Steps already taken to find the answer]

## Additional Information
[Related code, configurations, links]
```

### Enhancement Template

```markdown
## Summary
[Brief description of the enhancement]

## Current Behavior
[How it works now]

## Proposed Enhancement
[How it should work]

## Benefits
[Why this improvement is valuable]

## Implementation Notes
[Any technical considerations]
```

## Decision Logic

```
┌─────────────────────────────────────┐
│   needs-formatting label added      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Analyze Current Issue           │
│  - Read title and body              │
│  - Detect issue type                │
│  - Extract all information          │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Map to Template                 │
│  - Select appropriate template      │
│  - Identify where each piece of     │
│    information belongs              │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Preserve Content                │
│  - Keep ALL original information    │
│  - Maintain technical accuracy      │
│  - Preserve code blocks, logs       │
│  - Keep screenshots/links           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Apply Formatting                │
│  - Use proper markdown syntax       │
│  - Add code fences for code         │
│  - Create lists where appropriate   │
│  - Add headers for sections         │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│     Update Issue                    │
│  - Edit issue body                  │
│  - Remove needs-formatting          │
│  - Add formatted label              │
│  - Comment explaining changes       │
└─────────────────────────────────────┘
```

## Formatting Rules

### Content Preservation (Critical)

The agent MUST:

1. **Never remove information** - All original content must be preserved
2. **Never change meaning** - Technical details must remain accurate
3. **Never add assumptions** - Don't fill in missing information
4. **Preserve code exactly** - Code snippets, error messages, logs unchanged
5. **Keep all links** - URLs, references, related issues maintained

### Formatting Improvements

The agent SHOULD:

1. **Add section headers** - Organize content into logical sections
2. **Use code fences** - Wrap code, errors, logs in appropriate blocks
3. **Create lists** - Convert run-on text to bullet/numbered lists
4. **Fix markdown** - Correct broken links, malformed formatting
5. **Improve readability** - Add spacing, consistent styling

### What NOT to Format

The agent should NOT change:

1. **Inline code** - Technical terms, commands, file paths
2. **Quoted text** - User quotes from other sources
3. **Specific values** - Error codes, version numbers, IDs
4. **Personal style** - Non-technical phrasing that doesn't harm clarity

## Comment Templates

### After Formatting

```markdown
I've restructured this issue into a standard template format for better readability.

**Changes made:**
- Organized content into clear sections
- Added proper code formatting for [code/errors/logs]
- [Other specific changes]

All original information has been preserved. If anything was missed or incorrectly
categorized, please feel free to edit.
```

### Minimal Changes Needed

```markdown
This issue was already well-structured. I made minor formatting improvements:

- [Specific change 1]
- [Specific change 2]

All original content has been preserved.
```

## Agent Instructions

The full instructions for Claude should cover:

1. **Content First**: Always prioritize preserving information over formatting
2. **Type Detection**: Identify issue type to select correct template
3. **Information Extraction**: Systematically find all pieces of information
4. **Smart Mapping**: Place information in the most appropriate section
5. **Graceful Handling**: If unsure, keep original structure with minor improvements

### Key Behaviors

- **Never invent content** - Only reorganize what exists
- **Preserve uncertainty** - If reporter was unsure, keep that uncertainty
- **Maintain voice** - Don't rewrite descriptions, just organize them
- **Handle mixed types** - Some issues are bug+feature; handle appropriately
- **Respect length** - Long, detailed issues should stay detailed

## Inter-Agent Relationships

### Triggers Other Agents

None directly - formatting doesn't change issue state.

### Triggered By

| Source | Via |
|--------|-----|
| Human | `needs-formatting` label |
| [Issue Analyzer](./issue-analyzer.md) | Can suggest formatting needed |

### Coordination Notes

- Works independently of the triage pipeline
- Can be triggered at any point in issue lifecycle
- Does not affect `triaged`, `approved`, or other state labels

## Example Scenarios

### Scenario 1: Unstructured Bug Report

**Input Issue:**
```
Title: Login broken

the login doesnt work anymore. i click login and nothing happens.
using chrome on mac. error in console says "undefined is not a function"
at auth.js line 42. this started after the last update i think.
version 2.1.0
```

**Output Issue:**
```markdown
## Summary
The login functionality is not working - clicking login has no effect.

## Steps to Reproduce
1. Navigate to login page
2. Enter credentials
3. Click login button
4. Nothing happens

## Expected Behavior
User should be logged in and redirected.

## Actual Behavior
Nothing happens when clicking login.

## Error Messages
```
undefined is not a function at auth.js line 42
```

## Environment
- **OS**: macOS
- **Browser**: Chrome
- **Version**: 2.1.0

## Additional Context
Issue started after the last update.
```

### Scenario 2: Wall of Text Feature Request

**Input Issue:**
```
Title: dark mode

i work late at night and the bright colors hurt my eyes. it would be
great if there was a dark mode. other apps have it. could be a toggle
in settings. should remember my preference. maybe follow system settings
too? i tried using browser dark mode extensions but they make things
look weird. thanks!
```

**Output Issue:**
```markdown
## Summary
Request for dark mode to reduce eye strain during nighttime use.

## Problem Statement
Working late at night, the bright interface causes eye strain.

## Proposed Solution
Add a dark mode feature with:
- Toggle in settings
- Persist user preference
- Option to follow system settings

## Alternatives Considered
- Browser dark mode extensions - causes visual issues with the application

## Additional Context
Similar to dark mode implementations in other applications.
```

## Frontmatter Reference

```yaml
---
name: Issue Formatter
on:
  issues:
    types: [labeled]
trigger_labels: [needs-formatting]
permissions:
  issues: write
outputs:
  edit-issue: true
  add-comment: { max: 1 }
  remove-label: true
  add-label: true
rate_limit_minutes: 2
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 4096
  temperature: 0.3
---
```

## Customization Options

### Custom Templates

Modify templates to match your project's issue templates.

### Strictness Levels

- **Strict**: Enforce exact template structure
- **Flexible**: Preserve more of original structure with light improvements

### Language-Specific Code Formatting

Configure language detection for proper syntax highlighting in code blocks.

## Metrics to Track

- Issues formatted per time period
- Human edits after formatting (indicates quality)
- Reporter feedback on formatting changes
- Time saved in issue reading (estimated)
