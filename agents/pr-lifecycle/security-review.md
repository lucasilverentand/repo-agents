# Security Review Agent

Reviews pull requests for security vulnerabilities, unsafe patterns, and potential exploits.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR opened, synchronize |
| **Schedule** | N/A (event-driven) |
| **Permissions** | `pull_requests: write`, `contents: read` |
| **Rate Limit** | 5 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The Security Review Agent protects the codebase by:

- **Identifying** common vulnerability patterns (OWASP Top 10)
- **Detecting** unsafe code practices and anti-patterns
- **Flagging** potential injection points and data leaks
- **Suggesting** secure alternatives and mitigations
- **Blocking** critical security issues from merging

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

Triggers on:
- **opened**: Review new PRs for security issues
- **synchronize**: Re-review when new commits are pushed

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `add-comment` | 1 | Detailed security review |
| `add-label` | unlimited | Security status labels |

## Context Collection

```yaml
context:
  pull_requests:
    states: [open]
    limit: 1
```

Focuses on the current PR diff and changed files.

## Security Checks

### 1. Injection Vulnerabilities

| Type | Pattern | Severity |
|------|---------|----------|
| SQL Injection | String concatenation in queries | Critical |
| Command Injection | Unsanitized shell commands | Critical |
| XSS | Unescaped user input in HTML | High |
| Path Traversal | User input in file paths | High |
| LDAP Injection | Unsanitized LDAP queries | High |

### 2. Authentication & Authorization

| Check | Issue | Severity |
|-------|-------|----------|
| Hardcoded credentials | Passwords, API keys in code | Critical |
| Weak crypto | MD5, SHA1 for passwords | High |
| Missing auth checks | Unprotected endpoints | High |
| Insecure session | Weak session management | Medium |
| IDOR | Direct object references | Medium |

### 3. Data Exposure

| Check | Issue | Severity |
|-------|-------|----------|
| Sensitive logging | PII in logs | High |
| Error disclosure | Stack traces to users | Medium |
| Verbose errors | Internal details exposed | Medium |
| Insecure storage | Plaintext sensitive data | High |

### 4. Dependencies & Configuration

| Check | Issue | Severity |
|-------|-------|----------|
| Unsafe dependencies | Known vulnerable packages | Varies |
| Debug mode | Debug enabled in production | Medium |
| CORS misconfiguration | Overly permissive CORS | Medium |
| Insecure defaults | Unsafe default settings | Medium |

## Review Process

```
┌─────────────────────────────────────┐
│   PR opened/synchronized            │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Changed Files           │
│  - Parse diff content               │
│  - Identify file types              │
│  - Map to security contexts         │
│  - Note removed vs added code       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Pattern Detection               │
│  - Scan for injection patterns      │
│  - Check authentication code        │
│  - Review data handling             │
│  - Analyze crypto usage             │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Contextual Analysis             │
│  - Understand data flow             │
│  - Check input sources              │
│  - Trace to output sinks            │
│  - Consider trust boundaries        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Risk Assessment                 │
│  - Classify severity                │
│  - Determine exploitability         │
│  - Consider business impact         │
│  - Check for false positives        │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Report Findings                 │
│  - Critical: Block merge            │
│  - High: Request changes            │
│  - Medium: Warning comment          │
│  - Low: Informational note          │
└─────────────────────────────────────┘
```

## Severity Levels

| Level | Action | Label |
|-------|--------|-------|
| **Critical** | Block merge, immediate fix required | `security:critical` |
| **High** | Request changes, should fix before merge | `security:high` |
| **Medium** | Warning, recommend fixing | `security:medium` |
| **Low** | Informational, consider fixing | `security:low` |
| **None** | No issues found | `security:passed` |

## Comment Templates

### Critical Finding

```markdown
## 🚨 Security Review: Critical Issues Found

This PR contains **critical security vulnerabilities** that must be fixed before merging.

### Critical Issues

#### 1. SQL Injection in `src/api/users.ts:45`

```typescript
// VULNERABLE: User input directly in query
const query = `SELECT * FROM users WHERE id = '${userId}'`;
```

**Risk**: Attackers can execute arbitrary SQL, potentially accessing or modifying all database data.

**Fix**: Use parameterized queries:
```typescript
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [userId]);
```

---

⛔ **This PR should not be merged until critical issues are resolved.**

<details>
<summary>Security review powered by AI</summary>
This review checks for common vulnerability patterns. Manual security review is still recommended for sensitive changes.
</details>
```

### High Severity Finding

```markdown
## ⚠️ Security Review: Issues Found

This PR has security concerns that should be addressed.

### High Severity

#### Hardcoded API Key in `src/config.ts:12`

```typescript
const API_KEY = 'sk-1234567890abcdef';
```

**Risk**: API keys in source code can be leaked through version control.

**Fix**: Use environment variables:
```typescript
const API_KEY = process.env.API_KEY;
```

### Recommendations

1. Move all secrets to environment variables
2. Add `.env` to `.gitignore`
3. Consider using a secrets manager

---

Please address these issues before merging.
```

### Clean Review

```markdown
## ✅ Security Review: Passed

No security issues detected in this PR.

### Checks Performed
- ✅ Injection vulnerabilities (SQL, XSS, Command)
- ✅ Authentication and authorization
- ✅ Sensitive data handling
- ✅ Cryptographic practices
- ✅ Configuration security

---

<details>
<summary>About this review</summary>
This automated review checks for common vulnerability patterns. It does not replace manual security review for critical systems.
</details>
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Understand context** - What does this code do?
2. **Identify trust boundaries** - Where does external input enter?
3. **Trace data flow** - How does data move through the code?
4. **Check sinks** - Where is data used dangerously?

### Detection Guidelines

1. **Be thorough** - Check all changed code
2. **Consider context** - Is this test code or production?
3. **Trace variables** - Follow user input through the code
4. **Check frameworks** - Know framework-specific patterns

### Reporting Guidelines

1. **Be specific** - Point to exact lines
2. **Explain risk** - Why is this dangerous?
3. **Provide fixes** - Show secure alternatives
4. **Prioritize** - Critical issues first

### Key Behaviors

- **Never ignore** critical vulnerabilities
- **Explain clearly** - developers need to understand
- **Avoid false positives** - check context carefully
- **Be educational** - help developers learn

## Language-Specific Checks

### JavaScript/TypeScript

- `eval()`, `Function()` with user input
- `innerHTML` without sanitization
- `child_process.exec()` with user input
- Prototype pollution patterns
- Regex DoS (ReDoS)

### Python

- `eval()`, `exec()` with user input
- `pickle.loads()` on untrusted data
- SQL string formatting
- `subprocess.shell=True`
- YAML `load()` vs `safe_load()`

### Go

- `fmt.Sprintf` in SQL queries
- `os/exec` with user input
- Path traversal in file operations
- Unsafe pointer operations

### Java

- SQL string concatenation
- XML External Entity (XXE)
- Deserialization vulnerabilities
- JNDI injection

## Inter-Agent Relationships

### Triggers Other Agents

None directly.

### Triggered By

| Source | Via |
|--------|-----|
| New PRs | `pull_request: opened` |
| PR updates | `pull_request: synchronize` |

### Coordination Notes

- Runs alongside [PR Reviewer](./pr-reviewer.md)
- Critical findings should block merge
- Works with GitHub branch protection rules

## Example Scenarios

### Scenario 1: SQL Injection

**PR Change:**
```typescript
async function getUser(id: string) {
  return db.query(`SELECT * FROM users WHERE id = '${id}'`);
}
```

**Action:**
1. Detect string interpolation in SQL
2. Label: `security:critical`
3. Comment with fix using parameterized query
4. Request changes

### Scenario 2: XSS Vulnerability

**PR Change:**
```typescript
element.innerHTML = userComment;
```

**Action:**
1. Detect innerHTML with user input
2. Label: `security:high`
3. Comment suggesting sanitization or textContent
4. Request changes

### Scenario 3: Secure Code

**PR Change:**
```typescript
const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
```

**Action:**
1. Recognize parameterized query pattern
2. Label: `security:passed`
3. Brief approval comment

## Frontmatter Reference

```yaml
---
name: Security Review
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  pull_requests: write
  contents: read
outputs:
  add-comment: { max: 1 }
  add-label: true
rate_limit_minutes: 5
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 8192
  temperature: 0.3
---
```

## Customization Options

### Severity Thresholds

Adjust what blocks merging vs warnings.

### Language Focus

Configure for your primary languages.

### False Positive Tuning

Add patterns to ignore (e.g., test files).

## Metrics to Track

- Vulnerabilities found per severity
- False positive rate
- Time to fix after detection
- Vulnerabilities caught vs missed (post-incident)
- Most common vulnerability types
