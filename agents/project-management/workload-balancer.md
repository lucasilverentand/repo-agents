# Workload Balancer Agent

Distributes issues across team members based on skills, capacity, and workload.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | Issue labeled `ready`, schedule (daily) |
| **Schedule** | Weekdays 9am UTC |
| **Permissions** | `issues: write` |
| **Rate Limit** | 10 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Workload Balancer optimizes team productivity by:

- **Matching** issues to team members with relevant skills
- **Distributing** work evenly across the team
- **Avoiding** overloading any individual
- **Considering** ongoing work and availability
- **Suggesting** assignments for unassigned issues

## Trigger Configuration

```yaml
on:
  issues:
    types: [labeled]
  schedule:
    - cron: '0 9 * * 1-5'  # Weekdays 9am UTC
  workflow_dispatch: {}
```

Triggers on:
- **labeled**: When issue gets `ready` label
- **Daily**: Morning workload check
- **Manual**: On-demand balancing

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 5 | Assignment suggestions |
| `add-label` | unlimited | Status labels |

## Context Collection

```yaml
context:
  issues:
    states: [open]
    limit: 100
  pull_requests:
    states: [open]
    limit: 50
```

Analyzes current workload across issues and PRs.

## Team Configuration

### Team Member Profile

```yaml
team:
  - username: alice
    skills: [frontend, react, typescript]
    capacity: 40  # hours per week
    timezone: UTC-5

  - username: bob
    skills: [backend, python, databases]
    capacity: 40
    timezone: UTC+0

  - username: carol
    skills: [fullstack, devops, security]
    capacity: 32  # part-time
    timezone: UTC+8
```

### Skill Categories

| Category | Skills |
|----------|--------|
| Frontend | react, vue, angular, css, accessibility |
| Backend | node, python, go, rust, databases |
| DevOps | kubernetes, docker, ci-cd, aws, gcp |
| Data | sql, analytics, machine-learning |
| Security | authentication, encryption, penetration |

## Balancing Factors

### Assignment Scoring

| Factor | Weight | Description |
|--------|--------|-------------|
| Skill match | 35% | Has required skills |
| Current load | 30% | Available capacity |
| Recent work | 15% | Familiarity with area |
| Availability | 10% | Timezone, PTO |
| Growth opportunity | 10% | Learning new skills |

### Load Calculation

```
Current Load = (Assigned Issues × Avg Hours) + (Open PRs × Review Hours)

Available Capacity = Weekly Capacity - Current Load - Buffer

Overload Threshold = Capacity × 1.2
```

### Assignment Rules

1. **Never exceed** 120% capacity
2. **Prefer** skill match over availability
3. **Consider** timezone for time-sensitive work
4. **Balance** challenging and routine work
5. **Rotate** undesirable tasks fairly

## Balancing Process

```
┌─────────────────────────────────────┐
│   Trigger (label/schedule)          │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Calculate Current Workload      │
│  - Count assigned issues per person │
│  - Count open PRs per person        │
│  - Check PR review requests         │
│  - Note recent completions          │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Identify Unassigned Work        │
│  - Find issues with `ready` label   │
│  - Check for priority issues        │
│  - Note required skills             │
│  - Check dependencies               │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Match Skills to Issues          │
│  - Extract required skills          │
│  - Score team members               │
│  - Consider secondary skills        │
│  - Account for learning goals       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Balance Distribution            │
│  - Check capacity constraints       │
│  - Avoid overloading individuals    │
│  - Distribute evenly when equal     │
│  - Consider timezone needs          │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Generate Suggestions            │
│  - Primary recommendation           │
│  - Alternative options              │
│  - Flag capacity concerns           │
│  - Note skill gaps                  │
└─────────────────────────────────────┘
```

## Comment Templates

### Assignment Suggestion

```markdown
## 👤 Assignment Suggestion

Based on skills and current workload, here's a recommended assignment:

### Recommended: @alice

| Factor | Score | Notes |
|--------|-------|-------|
| Skill match | 95% | Strong React/TypeScript experience |
| Current load | 70% | 3 issues, 1 PR in progress |
| Recent work | High | Worked on related component last sprint |
| Availability | Good | Same timezone as stakeholder |

### Alternatives

| Team Member | Match | Load | Notes |
|-------------|-------|------|-------|
| @bob | 60% | 85% | Could do it, but busier |
| @carol | 75% | 50% | Good match, different timezone |

### Current Team Workload

```
alice:  ████████░░ 80%
bob:    █████████░ 85%
carol:  █████░░░░░ 50%
```

---

*To assign, a maintainer can add the `@username` assignee.*
```

### Workload Alert

```markdown
## ⚠️ Workload Alert

The daily workload check identified some concerns:

### Overloaded Team Members

| Member | Load | Threshold | Action Needed |
|--------|------|-----------|---------------|
| @bob | 130% | 120% | Reassign 1-2 issues |

### Unassigned Ready Issues

| Issue | Priority | Skills Needed | Suggested |
|-------|----------|---------------|-----------|
| #234 | High | React, API | @alice |
| #235 | Medium | Python | @carol |
| #236 | Low | Docs | Anyone |

### Capacity Summary

| Member | Assigned | In Review | Available |
|--------|----------|-----------|-----------|
| @alice | 3 issues | 1 PR | 20% |
| @bob | 5 issues | 2 PRs | -10% ⚠️ |
| @carol | 2 issues | 0 PRs | 50% |

### Recommendations

1. **Reassign** #230 from @bob to @carol (both have SQL skills)
2. **Prioritize** @bob's current work to reduce WIP
3. **Consider** bringing in help for backend work

---

*This is an automated workload analysis. Please review with team context.*
```

### Skill Gap Alert

```markdown
## 🎓 Skill Gap Identified

An issue requires skills not well-covered by available team members.

### Issue: #240 - Implement Kubernetes autoscaling

**Required Skills**: kubernetes, helm, monitoring

### Team Coverage

| Skill | Team Members | Proficiency |
|-------|--------------|-------------|
| kubernetes | @carol | Intermediate |
| helm | (none) | ❌ Gap |
| monitoring | @carol | Basic |

### Options

1. **Assign to @carol** with extended timeline
2. **Pair programming** with external expert
3. **Training opportunity** for interested team member
4. **External help** if time-sensitive

---

*Consider this a growth opportunity or identify external resources.*
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Map current state** - Who has what?
2. **Identify needs** - What's unassigned?
3. **Match skills** - Who can do what?
4. **Balance load** - Distribute fairly

### Assignment Guidelines

1. **Skills first** - Match expertise to need
2. **Capacity second** - Don't overload
3. **Growth third** - Learning opportunities
4. **Fairness fourth** - Rotate undesirable work

### Communication Guidelines

1. **Suggest, don't assign** - Human makes final call
2. **Explain reasoning** - Why this person?
3. **Show alternatives** - Other options
4. **Flag concerns** - Capacity issues

### Key Behaviors

- **Never auto-assign** - Only suggest
- **Respect capacity** - Don't overload
- **Consider growth** - Learning matters
- **Be transparent** - Show the math

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| Ready issues | `issues: labeled` with `ready` |
| Schedule | Cron (weekday mornings) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Uses output from [Issue Triage](./issue-triage.md) for skills
- Considers [Sprint Planner](./sprint-planner.md) priorities
- Works with [Issue Implementer](./issue-implementer.md) when no humans available

## Example Scenarios

### Scenario 1: New Ready Issue

**Context:**
- Issue #234 labeled `ready`
- Labels: `frontend`, `react`, `priority:high`

**Action:**
1. Extract skill requirements (frontend, react)
2. Score team members on skills
3. Check current workload
4. Suggest best match with reasoning

### Scenario 2: Morning Check

**Context:**
- Daily 9am trigger
- 5 unassigned ready issues
- 1 team member overloaded

**Action:**
1. Calculate all team workloads
2. Alert about overloaded member
3. Suggest reassignments
4. Match unassigned issues to available capacity

### Scenario 3: Skill Gap

**Context:**
- Issue requires Kubernetes expertise
- No team member has strong K8s skills

**Action:**
1. Identify skill gap
2. Suggest closest match
3. Recommend pairing or training
4. Flag for manager attention

## Frontmatter Reference

```yaml
---
name: Workload Balancer
on:
  issues:
    types: [labeled]
  schedule:
    - cron: '0 9 * * 1-5'
  workflow_dispatch: {}
trigger_labels: [ready]
permissions:
  issues: write
outputs:
  add-comment: { max: 5 }
  add-label: true
context:
  issues:
    states: [open]
    limit: 100
  pull_requests:
    states: [open]
    limit: 50
rate_limit_minutes: 10
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 4096
  temperature: 0.5
---
```

## Customization Options

### Team Configuration

Define team members, skills, and capacity.

### Skill Taxonomy

Customize skill categories for your domain.

### Load Thresholds

Adjust overload and capacity thresholds.

## Metrics to Track

- Assignment acceptance rate
- Time to assignment
- Workload distribution variance
- Skill match accuracy
- Team satisfaction feedback
