# Sprint Planner Agent

Suggests and prioritizes issues for upcoming sprints based on project goals and team capacity.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Schedule (bi-weekly), workflow_dispatch |
| **Schedule** | Every other Monday 8am UTC |
| **Permissions** | `issues: write`, `projects: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Sprint Planner optimizes sprint planning by:

- **Analyzing** the backlog for sprint candidates
- **Prioritizing** based on value, urgency, and dependencies
- **Balancing** work types (features, bugs, tech debt)
- **Considering** team capacity and skills
- **Generating** sprint recommendations

## Trigger Configuration

```yaml
on:
  schedule:
    - cron: '0 8 1,15 * *'  # 1st and 15th of each month
  workflow_dispatch:
    inputs:
      sprint_name:
        description: 'Sprint name/identifier'
        required: true
      capacity:
        description: 'Team capacity (story points)'
        required: false
```

Triggers on:
- **Bi-weekly**: Before sprint planning meetings
- **Manual**: On-demand planning

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Sprint recommendation report |
| `add-label` | unlimited | Sprint/priority labels |
| `create-issue` | 1 | Sprint planning issue |

## Context Collection

```yaml
context:
  issues:
    states: [open]
    exclude_labels: [blocked, on-hold, wontfix]
    limit: 200
  pull_requests:
    states: [open]
    limit: 50
  since: "30d"
```

Analyzes open issues and in-progress work.

## Prioritization Factors

### Value Assessment

| Factor | Weight | Description |
|--------|--------|-------------|
| User impact | 30% | How many users affected |
| Business value | 25% | Revenue/strategic importance |
| Technical value | 15% | Architecture improvement |
| Quick win | 10% | Low effort, high return |
| Dependencies | 20% | Unblocks other work |

### Urgency Signals

| Signal | Priority Boost |
|--------|----------------|
| `priority:critical` | +40 |
| `priority:high` | +25 |
| Security issue | +35 |
| Customer escalation | +30 |
| Blocking other work | +20 |
| SLA/deadline | +15 |

### Complexity Indicators

| Indicator | Story Points |
|-----------|--------------|
| Small/simple change | 1-2 |
| Well-defined task | 3 |
| Multiple files/components | 5 |
| Cross-team coordination | 8 |
| Architectural change | 13 |
| Unknown scope | Needs refinement |

## Planning Process

```
┌─────────────────────────────────────┐
│   Sprint planning trigger           │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Current State           │
│  - Review in-progress work          │
│  - Check carry-over items           │
│  - Note blocked issues              │
│  - Calculate velocity               │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Score Backlog Items             │
│  - Calculate value score            │
│  - Assess urgency                   │
│  - Estimate complexity              │
│  - Check dependencies               │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Balance Sprint                  │
│  - Mix of work types                │
│  - Respect capacity limits          │
│  - Consider skill requirements      │
│  - Include buffer for unknowns      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Identify Dependencies           │
│  - Map issue relationships          │
│  - Order by dependency              │
│  - Flag external dependencies       │
│  - Note parallel opportunities      │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Generate Recommendation         │
│  - Prioritized issue list           │
│  - Sprint goal suggestion           │
│  - Risk assessment                  │
│  - Alternative options              │
└─────────────────────────────────────┘
```

## Sprint Composition

### Recommended Balance

| Category | Percentage | Reasoning |
|----------|------------|-----------|
| Features | 40-50% | New value delivery |
| Bug fixes | 20-30% | Quality maintenance |
| Tech debt | 15-20% | Long-term health |
| Maintenance | 5-10% | Operational needs |
| Buffer | 10-15% | Unknown work |

### Healthy Sprint Indicators

✅ **Good Sprint:**
- Clear sprint goal
- Mix of work types
- No single issue >40% of capacity
- Dependencies mapped
- Some quick wins included

❌ **Warning Signs:**
- All work is one type
- Giant issues with unclear scope
- Circular dependencies
- No buffer for surprises
- Overcommitted capacity

## Report Template

```markdown
# 📋 Sprint Planning Recommendation

**Sprint**: Sprint 24 (Jan 15 - Jan 29)
**Team Capacity**: 40 story points
**Generated**: 2024-01-14

## 🎯 Suggested Sprint Goal

> Improve authentication reliability and launch user dashboard v2

## 📊 Recommended Issues

### High Priority (Must Have)

| Issue | Title | Type | Points | Value |
|-------|-------|------|--------|-------|
| #234 | Fix OAuth token refresh race condition | 🐛 Bug | 5 | Critical |
| #228 | User dashboard v2 - Core layout | ✨ Feature | 8 | High |
| #241 | Add rate limiting to auth endpoints | 🔒 Security | 3 | High |

**Subtotal**: 16 points

### Medium Priority (Should Have)

| Issue | Title | Type | Points | Value |
|-------|-------|------|--------|-------|
| #235 | Dashboard - Activity feed component | ✨ Feature | 5 | Medium |
| #242 | Improve error messages in auth flow | 🐛 Bug | 3 | Medium |
| #248 | Refactor auth middleware | 🧹 Tech Debt | 5 | Medium |

**Subtotal**: 13 points

### Nice to Have (If Capacity)

| Issue | Title | Type | Points | Value |
|-------|-------|------|--------|-------|
| #250 | Dashboard - Notifications panel | ✨ Feature | 5 | Low |
| #253 | Update auth documentation | 📚 Docs | 2 | Low |

**Subtotal**: 7 points

## 📈 Sprint Summary

| Category | Points | Percentage |
|----------|--------|------------|
| Features | 18 | 45% |
| Bug Fixes | 8 | 20% |
| Security | 3 | 8% |
| Tech Debt | 5 | 12% |
| Buffer | 6 | 15% |
| **Total** | **40** | **100%** |

## ⚠️ Dependencies

```
#228 (Dashboard layout)
  └── #235 (Activity feed) - can start after day 3
  └── #250 (Notifications) - can start after day 5

#234 (OAuth fix)
  └── #241 (Rate limiting) - parallel work OK
```

## 🚧 Blocked Issues (Excluded)

| Issue | Blocked By | Action Needed |
|-------|------------|---------------|
| #230 | External API documentation | Waiting on vendor |
| #245 | Design review | Needs design approval |

## 💡 Recommendations

1. **Start with #234** - Critical bug affecting users
2. **Parallel track** - Auth work and dashboard can proceed independently
3. **Mid-sprint checkpoint** - Review #228 progress before starting #250
4. **Risk**: #248 refactor might surface additional issues

## 🔄 Carry-Over from Last Sprint

| Issue | Points | Reason |
|-------|--------|--------|
| #220 | 5 | Scope increased mid-sprint |

---

*This is an AI-generated recommendation. Please review and adjust based on team knowledge and context.*
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Understand velocity** - What has the team delivered?
2. **Review backlog** - What's available to work on?
3. **Check dependencies** - What blocks what?
4. **Consider context** - Deadlines, team changes, etc.

### Prioritization Guidelines

1. **Value first** - What delivers most benefit?
2. **Urgency matters** - What can't wait?
3. **Dependencies** - What unblocks other work?
4. **Balance** - Mix of work types

### Estimation Guidelines

1. **Be conservative** - Overestimate slightly
2. **Include buffer** - Things take longer than expected
3. **Flag unknowns** - Issues needing refinement
4. **Consider context** - Team familiarity, complexity

### Key Behaviors

- **Never overcommit** - Leave buffer
- **Balance work types** - Not all features or all bugs
- **Flag risks** - Dependencies, unknowns
- **Be actionable** - Clear recommendations

## Labels Used

### Sprint Labels

- `sprint:current` - In current sprint
- `sprint:next` - Planned for next sprint
- `sprint:backlog` - In prioritized backlog

### Priority Labels

- `priority:critical` - Must do immediately
- `priority:high` - Important, do soon
- `priority:medium` - Normal priority
- `priority:low` - Nice to have

### Status Labels

- `blocked` - Cannot proceed
- `needs-refinement` - Scope unclear
- `ready` - Ready to work on

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| Schedule | Cron (bi-weekly) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Uses labels from [Issue Triage](./issue-triage.md)
- Considers output from [Issue Analyzer](./issue-analyzer.md)
- Works with project boards if configured

## Example Scenarios

### Scenario 1: Regular Sprint Planning

**Context:**
- Team velocity: 35-40 points
- 150 open issues in backlog
- 2 carry-over items from last sprint

**Action:**
1. Calculate available capacity (40 - 5 carry-over = 35)
2. Score all backlog items
3. Select top issues fitting capacity
4. Balance work types
5. Generate recommendation with alternatives

### Scenario 2: Release Deadline

**Context:**
- Release deadline in 2 sprints
- Several "must have" features incomplete

**Action:**
1. Identify release-critical items
2. Prioritize those highest
3. Defer non-critical work
4. Flag risk if capacity insufficient
5. Recommend scope discussion if overcommitted

### Scenario 3: Tech Debt Focus

**Context:**
- Recent production incidents
- Team requested tech debt sprint

**Action:**
1. Identify tech debt items
2. Prioritize by risk reduction
3. Include critical bugs only
4. Defer feature work
5. Create focused tech debt sprint plan

## Frontmatter Reference

```yaml
---
name: Sprint Planner
on:
  schedule:
    - cron: '0 8 1,15 * *'  # Bi-weekly
  workflow_dispatch:
    inputs:
      sprint_name:
        description: 'Sprint name'
        required: true
      capacity:
        description: 'Team capacity (points)'
        required: false
permissions:
  issues: write
  projects: write
outputs:
  add-comment: { max: 1 }
  add-label: true
  create-issue: { max: 1 }
context:
  issues:
    states: [open]
    exclude_labels: [blocked, on-hold, wontfix]
    limit: 200
  pull_requests:
    states: [open]
    limit: 50
  since: "30d"
rate_limit_minutes: 30
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.5
---
```

## Customization Options

### Velocity Tracking

Configure how velocity is calculated.

### Sprint Length

Adjust for different sprint durations.

### Work Type Categories

Customize categories for your team.

## Metrics to Track

- Sprint completion rate
- Velocity trend
- Carry-over frequency
- Recommendation acceptance rate
- Sprint goal achievement
