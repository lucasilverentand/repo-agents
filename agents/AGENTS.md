# Repository Agent Suite

A comprehensive 23-agent automation suite for complete repository workflow management. These agents work together to handle issues, pull requests, continuous code improvement, and project management.

> **Detailed Specifications**: Each agent has a detailed specification in this folder with full documentation on behavior, configuration, and examples.

## Quick Start

Copy the agents from `.github/agents/` to your repository and configure:

1. Set up secrets: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN`
2. (Optional) Configure GitHub App for signed commits: `GH_APP_ID`, `GH_APP_PRIVATE_KEY`
3. Run `repo-agents compile` to generate workflows
4. Create the required labels (see [Label Taxonomy](#label-taxonomy))

---

## Agent Overview

### Issue Lifecycle

| Agent | Trigger | Purpose |
|-------|---------|---------|
| [Issue Analyzer](issue-lifecycle/issue-analyzer.md) | Issue opened | Analyze completeness, request info or mark ready |
| [Issue Triage](issue-lifecycle/issue-triage.md) | `ready-for-triage` label | Auto-categorize with type/priority/area labels |
| [Issue Formatter](issue-lifecycle/issue-formatter.md) | `needs-formatting` label | Restructure into templates without altering content |
| [Issue Implementer](issue-lifecycle/issue-implementer.md) | `approved` label | Implement and create pull request |

### Pull Request Lifecycle

| Agent | Trigger | Purpose |
|-------|---------|---------|
| [PR Reviewer](pr-lifecycle/pr-reviewer.md) | PR opened/updated | Review for quality, security, test coverage |
| [PR Fixer](pr-lifecycle/pr-fixer.md) | `fix-requested` label | Apply fixes based on review feedback |
| [Security Review](pr-lifecycle/security-review.md) | PR opened/updated | Deep security vulnerability analysis |
| [Breaking Change Detector](pr-lifecycle/breaking-change-detector.md) | PR opened/updated | Identify API breaking changes |
| [Performance Analyzer](pr-lifecycle/performance-analyzer.md) | PR opened/updated, weekly | Find performance bottlenecks |

### Continuous Improvement

| Agent | Schedule | Purpose |
|-------|----------|---------|
| [Code Quality](continuous-improvement/code-quality.md) | Monday 6am UTC | Fix lint issues, code smells, style violations |
| [Dead Code Finder](continuous-improvement/dead-code-finder.md) | Tuesday 6am UTC | Remove unused code, dependencies, files |
| [Test Coverage](continuous-improvement/test-coverage.md) | Wednesday 6am UTC | Generate missing tests |
| [Documentation Sync](continuous-improvement/documentation-sync.md) | Friday 8am UTC + PR merge | Keep docs in sync with code |
| [Refactoring Agent](continuous-improvement/refactoring.md) | 1st of month | Improve code structure, reduce duplication |

### Documentation

| Agent | Trigger | Purpose |
|-------|---------|---------|
| [API Docs Generator](documentation/api-docs-generator.md) | PR merge, weekly | Generate API documentation from code |
| [Example Validator](documentation/example-validator.md) | PR merge, weekly | Test code examples in docs |
| [Translation Sync](documentation/translation-sync.md) | PR merge, weekly | Keep translations in sync |

### Release & Migration

| Agent | Trigger | Purpose |
|-------|---------|---------|
| [Release Notes Generator](releases/release-notes-generator.md) | Release published | Generate changelogs from PRs |
| [Migration Assistant](releases/migration-assistant.md) | `migration` label | Help upgrade frameworks/libraries |

### Project Management

| Agent | Schedule | Purpose |
|-------|----------|---------|
| [Sprint Planner](project-management/sprint-planner.md) | Bi-weekly | Suggest sprint priorities |
| [Workload Balancer](project-management/workload-balancer.md) | `ready` label, daily | Distribute work across team |

### Utilities

| Agent | Trigger | Purpose |
|-------|---------|---------|
| [Duplicate Detector](utilities/duplicate-detector.md) | Issue opened/edited | Find and link/close duplicate issues |
| [Stale Issue Manager](utilities/stale-issue-manager.md) | Monday 9am UTC | Warn and close inactive issues |

---

## Workflow Coordination

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ISSUE LIFECYCLE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

  Issue Created
       │
       ▼
  ┌─────────────┐     ┌──────────────────────┐
  │   Issue     │────►│  "ready-for-triage"  │
  │  Analyzer   │     │   or "needs-info"    │
  └─────────────┘     └──────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       │                       │                       │
       ▼                       ▼                       ▼
  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
  │  Duplicate  │     │  Issue Triage   │     │ Issue Formatter │
  │  Detector   │     │ (adds type/pri) │     │ (if requested)  │
  └─────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                      Human adds "approved"
                               │
                               ▼
                      ┌─────────────────┐
                      │     Issue       │────► Creates PR
                      │  Implementer    │
                      └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          PR LIFECYCLE                                        │
└─────────────────────────────────────────────────────────────────────────────┘

  PR Created/Updated
       │
       ▼
  ┌─────────────┐
  │ PR Reviewer │────► Adds review labels
  └─────────────┘
       │
       ├────► "review:approved" ────► Ready to merge
       │
       └────► "review:changes-requested"
                    │
                    ▼
           Human adds "fix-requested"
                    │
                    ▼
              ┌──────────┐
              │ PR Fixer │────► Pushes fixes
              └──────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                     CONTINUOUS IMPROVEMENT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

   Monday          Tuesday        Wednesday       Friday          Monthly
     │                │               │              │               │
     ▼                ▼               ▼              ▼               ▼
  ┌────────┐    ┌──────────┐    ┌──────────┐  ┌───────────┐  ┌────────────┐
  │ Code   │    │ Dead Code│    │  Test    │  │   Docs    │  │ Refactoring│
  │Quality │    │  Finder  │    │ Coverage │  │   Sync    │  │   Agent    │
  └────────┘    └──────────┘    └──────────┘  └───────────┘  └────────────┘
       │              │               │              │               │
       └──────────────┴───────────────┴──────────────┴───────────────┘
                                      │
                                      ▼
                              Creates improvement PRs
                                      │
                                      ▼
                                PR Reviewer
```

---

## Agent Details

### Issue Analyzer

**Purpose**: Analyze newly created issues for completeness and prepare them for triage.

**Trigger**: `issues: opened`

**Actions**:
- Analyze issue title and body for completeness
- Check for clear problem statement, reproduction steps (bugs), expected behavior
- Add appropriate labels:
  - `needs-info` - Missing critical information (pauses pipeline)
  - `ready-for-triage` - Complete and ready for categorization
  - `good-first-issue` - Approachable for newcomers
- Comment acknowledging issue and requesting any missing info

**Outputs**: `add-comment`, `add-label`

---

### Issue Triage

**Purpose**: Automatically categorize and prioritize issues ready for triage.

**Trigger**: `issues: labeled` with `ready-for-triage`

**Actions**:
- Categorize by type: `bug`, `feature`, `enhancement`, `documentation`, `question`, `chore`
- Assess priority: `priority:critical`, `priority:high`, `priority:medium`, `priority:low`
- Identify area: `area:frontend`, `area:backend`, `area:api`, `area:infra`, etc.
- Remove `ready-for-triage`, add `triaged`
- Comment summarizing categorization

**Outputs**: `add-comment`, `add-label`, `remove-label`

---

### Issue Formatter

**Purpose**: Restructure poorly formatted issues into proper templates while preserving all content.

**Trigger**: `issues: labeled` with `needs-formatting`

**Actions**:
- Restructure into appropriate template:
  - **Bug Report**: Summary, Steps to Reproduce, Expected/Actual Behavior, Environment
  - **Feature Request**: Summary, Problem Statement, Proposed Solution, Alternatives
  - **Question**: Question, Context, What I've Tried
- NEVER alter meaning or remove information
- Preserve technical details, logs, screenshots
- Improve formatting (code blocks, lists, headers)

**Outputs**: `edit-issue`, `add-comment`, `add-label`, `remove-label`

---

### Issue Implementer

**Purpose**: Implement approved issues and create pull requests.

**Trigger**: `issues: labeled` with `approved` or `ready-to-implement`

**Actions**:
- Read and understand the issue thoroughly
- Explore codebase to understand architecture and patterns
- Implement the requested feature/fix
- Write or update tests
- Create PR with:
  - Clear title referencing issue
  - Comprehensive description
  - Test plan
  - "Closes #X" or "Fixes #X" linkage
- Add `implementation-in-progress` label to issue

**Outputs**: `create-pr`, `add-comment`, `add-label`

**Allowed Paths**: `src/**`, `lib/**`, `tests/**`, `test/**`, `docs/**`, `*.md`, `*.json`, `*.yaml`

---

### PR Reviewer

**Purpose**: Automatically review pull requests for quality, security, and completeness.

**Trigger**: `pull_request: opened, synchronize, ready_for_review`

**Actions**:
- Analyze all changed files
- Check for:
  - Code quality issues (complexity, readability)
  - Security vulnerabilities
  - Test coverage
  - Documentation needs
  - Breaking changes
  - Performance implications
- Add review labels:
  - `review:approved` - No significant issues
  - `review:changes-requested` - Issues to address
  - `needs-tests` - Missing test coverage
  - `needs-docs` - Documentation needed
  - `security-concern` - Security issues found

**Outputs**: `add-comment`, `add-label`, `request-review`

---

### PR Fixer

**Purpose**: Automatically address review feedback when requested.

**Trigger**: `pull_request: labeled` with `fix-requested` or `auto-fix`

**Actions**:
- Read all review comments
- Implement fixes for actionable feedback
- Push fixes as new commits
- Comment summarizing changes
- Remove `fix-requested`, add `fixes-applied`

**Outputs**: `update-file`, `add-comment`, `add-label`, `remove-label`

**Allowed Paths**: `src/**`, `lib/**`, `tests/**`, `test/**`, `docs/**`

---

### Code Quality Agent

**Purpose**: Proactively find and fix code quality issues.

**Schedule**: Monday 6am UTC (weekly)

**Actions**:
- Scan codebase for:
  - Linting issues and style violations
  - Code smells (long methods, deep nesting)
  - TODO/FIXME comments that can be resolved
  - Missing type annotations
  - Deprecated API usage
- Create focused PRs fixing one category at a time
- Create issues for complex problems needing discussion

**Outputs**: `create-pr` (max 3), `create-issue` (max 2), `add-label`

**Context**: Commits from last 7 days

---

### Dead Code Finder

**Purpose**: Identify and remove unused code, dependencies, and files.

**Schedule**: Tuesday 6am UTC (weekly)

**Actions**:
- Identify:
  - Unused exports and functions
  - Unreachable code paths
  - Unused dependencies
  - Orphaned test files
  - Commented-out code blocks
- Create PRs with explanation of why code is unused
- Create issues for uncertain cases needing human review

**Outputs**: `create-pr` (max 2), `create-issue` (max 3), `add-label`

**Context**: Commits from last 7 days

---

### Test Coverage Agent

**Purpose**: Identify areas lacking tests and generate coverage.

**Schedule**: Wednesday 6am UTC (weekly)

**Actions**:
- Analyze codebase for:
  - Functions/modules without tests
  - Complex logic without adequate coverage
  - Edge cases not covered
  - Recently changed code without test updates
- Generate tests following existing patterns
- Focus on high-value coverage (critical paths, complex logic)

**Outputs**: `create-pr` (max 3), `add-label`

**Allowed Paths**: `tests/**`, `test/**`, `src/**/*.test.ts`, `src/**/*.spec.ts`

**Context**: Merged PRs and commits from last 7 days

---

### Documentation Sync

**Purpose**: Keep documentation in sync with code changes.

**Schedule**: Friday 8am UTC (weekly) + on PR merge to main

**Actions**:
- On PR merge: Analyze changes for documentation impact
- On schedule: Audit docs vs code consistency
- Check for:
  - API changes needing doc updates
  - New features without documentation
  - Outdated examples
  - Broken links
- Create issues for documentation gaps
- Create PRs for straightforward fixes

**Outputs**: `create-issue` (max 5), `create-pr` (max 2), `add-comment`, `add-label`

**Allowed Paths**: `docs/**`, `README.md`, `CONTRIBUTING.md`, `*.md`

---

### Refactoring Agent

**Purpose**: Identify and implement structural improvements.

**Schedule**: 1st of each month

**Actions**:
- Analyze codebase for:
  - Code duplication to extract
  - Classes with too many responsibilities
  - Tightly coupled components
  - Outdated patterns
  - Inconsistent approaches
- Create focused refactoring PRs that change structure without behavior
- Create issues for larger refactorings needing discussion

**Outputs**: `create-pr` (max 2), `create-issue` (max 5), `add-label`

**Context**: Commits from last 30 days, open tech-debt issues

---

### Duplicate Detector

**Purpose**: Find and link duplicate issues, closing clear duplicates.

**Trigger**: `issues: opened, edited`

**Actions**:
- Compare new issue against existing open issues
- Check for semantic similarity, matching errors, same feature requests
- Confidence scoring:
  - **High (80%+)**: Close as duplicate with link
  - **Medium (50-79%)**: Link but don't close
  - **Low (30-49%)**: Mention for awareness
- Always thank reporter and explain decision

**Outputs**: `add-comment`, `add-label`, `close-issue`

**Context**: Open issues (limit 200)

---

### Stale Issue Manager

**Purpose**: Manage inactive issues to keep the backlog clean.

**Schedule**: Monday 9am UTC (weekly)

**Actions**:
- Identify issues inactive for 60+ days
- Exclude protected labels: `pinned`, `security`, `critical`, `in-progress`, `approved`, `long-term`
- First warning: Add `stale` label with 14-day notice
- Final action: Close if still stale after 14 days
- Remove `stale` if activity resumes

**Outputs**: `add-comment` (max 20), `add-label`, `remove-label`, `close-issue`

**Context**: Open issues excluding protected labels

---

### Security Review

**Purpose**: Deep security analysis of pull request changes.

**Trigger**: `pull_request: opened, synchronize`

**Actions**:
- Scan for OWASP Top 10 vulnerabilities
- Detect injection patterns (SQL, XSS, command)
- Check for hardcoded secrets
- Review authentication/authorization code
- Identify unsafe dependencies

**Outputs**: `add-comment`, `add-label`

---

### Breaking Change Detector

**Purpose**: Identify API breaking changes in pull requests.

**Trigger**: `pull_request: opened, synchronize`

**Actions**:
- Analyze public API changes
- Detect removed/renamed exports
- Check function signature changes
- Identify type narrowing
- Recommend semver version bump

**Outputs**: `add-comment`, `add-label`

---

### Performance Analyzer

**Purpose**: Find and fix performance bottlenecks.

**Trigger**: `pull_request: opened, synchronize` + Thursday 6am UTC (weekly)

**Actions**:
- Detect N+1 query patterns
- Identify algorithmic complexity issues
- Find memory leak patterns
- Suggest caching opportunities
- Recommend optimizations with code examples

**Outputs**: `add-comment`, `create-issue` (max 3), `add-label`

---

### API Docs Generator

**Purpose**: Generate human-readable API documentation from code.

**Trigger**: PR merge to main (API changes) + Sunday 6am UTC (weekly)

**Actions**:
- Extract API signatures from source
- Generate endpoint documentation
- Create usage examples
- Document parameters and return types
- Keep docs in sync with code

**Outputs**: `create-pr`, `update-file`, `add-label`

**Allowed Paths**: `docs/api/**`, `docs/reference/**`, `API.md`

---

### Example Validator

**Purpose**: Test code examples in documentation to ensure they work.

**Trigger**: PR merge to main + Saturday 6am UTC (weekly)

**Actions**:
- Extract code examples from markdown
- Validate imports exist
- Check API signatures match
- Auto-fix simple issues
- Create issues for complex problems

**Outputs**: `create-pr`, `create-issue` (max 3), `update-file`, `add-label`

**Allowed Paths**: `docs/**`, `README.md`, `*.md`

---

### Translation Sync

**Purpose**: Keep translated documentation in sync with source language.

**Trigger**: PR merge to main (docs) + Sunday 8am UTC (weekly)

**Actions**:
- Detect changes in source documentation
- Translate new and changed content
- Preserve unchanged translations
- Track translation coverage
- Flag complex content for human review

**Outputs**: `create-pr`, `create-issue` (max 2), `update-file`, `add-label`

**Allowed Paths**: `docs/*/**`, `i18n/**`, `locales/**`

---

### Release Notes Generator

**Purpose**: Generate comprehensive changelogs from merged PRs.

**Trigger**: `release: published` + workflow_dispatch

**Actions**:
- Collect all PRs merged since last release
- Categorize by type (features, fixes, breaking)
- Generate user-friendly summaries
- Highlight breaking changes
- Credit contributors

**Outputs**: `update-file`, `add-comment`

**Allowed Paths**: `CHANGELOG.md`, `RELEASE_NOTES.md`

---

### Migration Assistant

**Purpose**: Help upgrade frameworks, libraries, and patterns.

**Trigger**: Issue labeled `migration` + workflow_dispatch

**Actions**:
- Analyze codebase for migration requirements
- Transform code patterns to new APIs
- Update configuration files
- Generate migration PR with documentation
- Flag manual steps needed

**Outputs**: `create-pr`, `add-comment` (max 2), `update-file`, `add-label`

**Allowed Paths**: `src/**`, `lib/**`, `tests/**`, `package.json`, `tsconfig.json`, `*.config.js`

---

### Sprint Planner

**Purpose**: Suggest and prioritize issues for upcoming sprints.

**Schedule**: Bi-weekly (1st and 15th of month)

**Actions**:
- Analyze backlog for sprint candidates
- Score by value, urgency, and dependencies
- Balance work types (features, bugs, tech debt)
- Consider team capacity
- Generate sprint recommendations

**Outputs**: `add-comment`, `add-label`, `create-issue`

**Context**: Open issues (limit 200), open PRs (limit 50)

---

### Workload Balancer

**Purpose**: Distribute issues across team based on skills and capacity.

**Trigger**: Issue labeled `ready` + weekdays 9am UTC

**Actions**:
- Calculate current workload per team member
- Match issue skills to team expertise
- Suggest optimal assignments
- Alert on overloaded team members
- Identify skill gaps

**Outputs**: `add-comment` (max 5), `add-label`

**Context**: Open issues (limit 100), open PRs (limit 50)

---

## Label Taxonomy

### Required Labels

Create these labels in your repository for the agents to function properly.

#### State Labels (set by agents)
| Label | Color | Description |
|-------|-------|-------------|
| `needs-info` | `#d93f0b` | Issue needs more information from reporter |
| `ready-for-triage` | `#0e8a16` | Ready for categorization |
| `triaged` | `#1d76db` | Has been categorized |
| `formatted` | `#5319e7` | Issue has been reformatted |
| `implementation-in-progress` | `#fbca04` | Currently being implemented |
| `stale` | `#ffffff` | No recent activity |
| `duplicate` | `#cfd3d7` | Duplicate of another issue |

#### Approval Labels (set by humans)
| Label | Color | Description |
|-------|-------|-------------|
| `approved` | `#0e8a16` | Approved for implementation |
| `ready-to-implement` | `#0e8a16` | Alternative approval signal |
| `fix-requested` | `#d93f0b` | PR needs automated fixes |
| `auto-fix` | `#d93f0b` | Allow auto-fix of PR issues |
| `needs-formatting` | `#fbca04` | Issue needs reformatting |

#### Type Labels
| Label | Color | Description |
|-------|-------|-------------|
| `bug` | `#d73a4a` | Something isn't working |
| `feature` | `#a2eeef` | New feature request |
| `enhancement` | `#84b6eb` | Improvement to existing feature |
| `documentation` | `#0075ca` | Documentation related |
| `question` | `#d876e3` | Question or support request |
| `chore` | `#fef2c0` | Maintenance task |

#### Priority Labels
| Label | Color | Description |
|-------|-------|-------------|
| `priority:critical` | `#b60205` | Must be addressed immediately |
| `priority:high` | `#d93f0b` | Should be addressed soon |
| `priority:medium` | `#fbca04` | Normal priority |
| `priority:low` | `#0e8a16` | Nice to have |

#### Review Labels
| Label | Color | Description |
|-------|-------|-------------|
| `review:approved` | `#0e8a16` | PR review passed |
| `review:changes-requested` | `#d93f0b` | Changes needed |
| `needs-tests` | `#fbca04` | Test coverage needed |
| `needs-docs` | `#0075ca` | Documentation needed |
| `security-concern` | `#b60205` | Security issues found |
| `fixes-applied` | `#1d76db` | Review feedback addressed |

#### Automation Labels
| Label | Color | Description |
|-------|-------|-------------|
| `automated` | `#ededed` | Created by automation |
| `code-quality` | `#5319e7` | Code quality improvement |
| `dead-code` | `#5319e7` | Dead code removal |
| `test-coverage` | `#5319e7` | Test coverage addition |
| `refactoring` | `#5319e7` | Structural improvement |
| `tech-debt` | `#fbca04` | Technical debt item |

#### Protective Labels (prevent stale closure)
| Label | Color | Description |
|-------|-------|-------------|
| `pinned` | `#006b75` | Important, keep open |
| `security` | `#b60205` | Security related |
| `critical` | `#b60205` | Critical priority |
| `in-progress` | `#fbca04` | Actively being worked |
| `long-term` | `#bfd4f2` | Long-term initiative |
| `good-first-issue` | `#7057ff` | Good for newcomers |

---

## Configuration

### Secrets Required

| Secret | Required | Description |
|--------|----------|-------------|
| `ANTHROPIC_API_KEY` | One of | Claude API key |
| `CLAUDE_CODE_OAUTH_TOKEN` | these | Claude OAuth token |
| `GH_APP_ID` | Optional | GitHub App ID for signed commits |
| `GH_APP_PRIVATE_KEY` | Optional | GitHub App private key |

### Customization

Each agent can be customized by editing its markdown file:

1. **Adjust triggers**: Change schedules, add/remove trigger labels
2. **Modify outputs**: Adjust `max` limits, enable/disable specific outputs
3. **Update allowed-paths**: Restrict or expand file access
4. **Tune model settings**: Change temperature, max tokens, or model
5. **Customize instructions**: Modify the markdown body for different behavior

### Rate Limiting

Default rate limits prevent excessive runs:

| Agent Type | Default Limit |
|------------|---------------|
| Event-triggered | 1-5 minutes |
| Implementation | 10 minutes |
| Scheduled | 60 minutes |
| Refactoring | 120 minutes |

---

## Safety

### File Restrictions

Agents NEVER modify:
- `.github/workflows/**` - Workflow files
- `*.lock` - Lock files
- `.env*` - Environment files
- Credentials or secrets

### Output Limits

All agents have `max` constraints on outputs to prevent runaway automation:
- PRs: 1-3 per run
- Issues: 2-5 per run
- Comments: 1-2 per run

### Human Oversight

Key actions require human approval via labels:
- `approved` - Before implementing issues
- `fix-requested` - Before auto-fixing PRs
- `needs-formatting` - Before reformatting issues

---

## Troubleshooting

### Agent not triggering?
1. Check trigger conditions (events, labels)
2. Verify secrets are configured
3. Check rate limiting (may be within cooldown)
4. Review workflow logs in Actions tab

### Unexpected behavior?
1. Check agent markdown instructions
2. Review recent changes to agent file
3. Check Claude model outputs in workflow logs
4. Verify label names match exactly

### PRs not being created?
1. Verify `contents: write` permission
2. Check `allowed-paths` includes target files
3. Ensure branch protection allows automation
4. Check for GitHub App configuration if using signed commits
