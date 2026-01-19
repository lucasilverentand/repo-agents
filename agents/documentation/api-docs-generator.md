# API Docs Generator Agent

Generates human-readable API documentation from source code and type definitions.

## Overview

| Property | Value |
|----------|-------|
| **Trigger** | PR merge to main (API changes), weekly schedule |
| **Schedule** | Sunday 6am UTC |
| **Permissions** | `contents: write`, `pull_requests: write` |
| **Rate Limit** | 30 minutes |
| **Model** | claude-sonnet-4-20250514 |

## Purpose

The API Docs Generator creates comprehensive documentation by:

- **Extracting** API signatures from source code
- **Generating** human-readable descriptions
- **Creating** usage examples for each endpoint/function
- **Documenting** parameters, return types, and errors
- **Maintaining** consistency with code changes

## Trigger Configuration

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "src/api/**"
      - "src/public/**"
      - "lib/**"
  schedule:
    - cron: '0 6 * * 0'  # Sunday 6am UTC
  workflow_dispatch: {}
```

Triggers on:
- **PR merge**: When API files change
- **Weekly**: Full documentation audit
- **Manual**: On-demand generation

## Outputs

| Output | Max | Purpose |
|--------|-----|---------|
| `create-pr` | 1 | Documentation updates |
| `update-file` | unlimited | Update doc files |
| `add-label` | unlimited | Categorize PRs |

## Allowed Paths

```yaml
allowed-paths:
  - "docs/api/**"
  - "docs/reference/**"
  - "API.md"
```

Only modifies documentation files.

## Context Collection

```yaml
context:
  pull_requests:
    states: [merged]
    paths: ["src/api/**", "src/public/**"]
    limit: 20
  since: "7d"
```

Collects recently merged PRs that changed API code.

## Documentation Structure

### API Reference Layout

```
docs/api/
├── README.md           # API overview
├── authentication.md   # Auth guide
├── errors.md          # Error reference
├── endpoints/
│   ├── users.md       # User endpoints
│   ├── orders.md      # Order endpoints
│   └── products.md    # Product endpoints
└── types/
    ├── user.md        # User type
    └── order.md       # Order type
```

### Endpoint Documentation

```markdown
# Create User

Creates a new user account.

## Endpoint

```
POST /api/v1/users
```

## Authentication

Requires `Authorization: Bearer <token>` with `users:write` scope.

## Request

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes | Bearer token |
| `Content-Type` | Yes | `application/json` |

### Body

```typescript
interface CreateUserRequest {
  email: string;        // User's email address
  name: string;         // Display name
  role?: 'user' | 'admin';  // Account role (default: 'user')
}
```

### Example

```bash
curl -X POST https://api.example.com/api/v1/users \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "name": "John Doe"
  }'
```

## Response

### Success (201 Created)

```typescript
interface CreateUserResponse {
  id: string;           // Unique user ID
  email: string;        // User's email
  name: string;         // Display name
  role: string;         // Account role
  createdAt: string;    // ISO 8601 timestamp
}
```

```json
{
  "id": "usr_123abc",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### Errors

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_EMAIL` | Email format is invalid |
| 400 | `NAME_REQUIRED` | Name field is required |
| 409 | `EMAIL_EXISTS` | Email already registered |
| 401 | `UNAUTHORIZED` | Invalid or missing token |
| 403 | `FORBIDDEN` | Insufficient permissions |

## Rate Limiting

- 100 requests per minute per API key
- Returns `429 Too Many Requests` when exceeded
```

## Generation Process

```
┌─────────────────────────────────────┐
│   Trigger (PR merge/schedule)       │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  1. Analyze Source Code             │
│  - Find all API endpoints           │
│  - Extract function signatures      │
│  - Parse type definitions           │
│  - Read existing JSDoc/comments     │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  2. Compare with Existing Docs      │
│  - Check what's documented          │
│  - Find outdated sections           │
│  - Identify gaps                    │
│  - Note deprecated items            │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  3. Generate Documentation          │
│  - Write descriptions               │
│  - Create examples                  │
│  - Document parameters              │
│  - List error cases                 │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  4. Validate Content                │
│  - Check example accuracy           │
│  - Verify type definitions          │
│  - Ensure consistency               │
│  - Check links work                 │
└─────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│  5. Create PR                       │
│  - Update changed docs              │
│  - Add new endpoint docs            │
│  - Remove deprecated docs           │
│  - Update navigation                │
└─────────────────────────────────────┘
```

## Documentation Types

### 1. Endpoint Documentation

For REST APIs:
- HTTP method and path
- Authentication requirements
- Request parameters and body
- Response format and examples
- Error codes and meanings

### 2. Function Documentation

For libraries:
- Function signature
- Parameter descriptions
- Return value
- Usage examples
- Error handling

### 3. Type Documentation

For TypeScript/interfaces:
- Property descriptions
- Optional vs required
- Default values
- Related types

### 4. Configuration Documentation

For config options:
- Option name and type
- Default value
- Valid values
- Example usage

## Writing Guidelines

### Descriptions

| Element | Style |
|---------|-------|
| Endpoint | Verb + object: "Creates a new user" |
| Parameter | What it controls: "Maximum items to return" |
| Response field | What it contains: "Unique identifier for the user" |
| Error | When it occurs: "Email already registered" |

### Examples

1. **Be realistic** - Use plausible values
2. **Be complete** - Show all required fields
3. **Be runnable** - curl/code should work
4. **Be consistent** - Same style throughout

### Good Example

```markdown
## Get User

Retrieves a user by their unique identifier.

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | string | Yes | The user's unique identifier (e.g., `usr_123abc`) |

### Example

```bash
curl https://api.example.com/api/v1/users/usr_123abc \
  -H "Authorization: Bearer <token>"
```
```

## PR Template

```markdown
## API Documentation Update

### Summary

Updates API documentation to reflect recent code changes.

### Changes

#### New Documentation
- Added docs for `POST /api/v1/webhooks` endpoint
- Added docs for `WebhookEvent` type

#### Updated Documentation
- Updated `POST /api/v1/users` with new `metadata` field
- Fixed incorrect example in `GET /api/v1/orders`

#### Removed Documentation
- Removed deprecated `GET /api/v1/users/search` (use `/api/v2/users` instead)

### Related PRs
- #234: Added webhooks endpoint
- #235: Added metadata to users

### Validation
- [ ] Examples tested and working
- [ ] Types match source code
- [ ] Links verified
```

## Agent Instructions

The full instructions for Claude should cover:

### Analysis Strategy

1. **Read source code** - Understand what the API does
2. **Extract signatures** - Get types and parameters
3. **Find existing docs** - What's already documented
4. **Identify gaps** - What's missing or outdated

### Writing Guidelines

1. **Be clear** - No jargon without explanation
2. **Be complete** - Document all parameters
3. **Be accurate** - Match the actual code
4. **Be helpful** - Include useful examples

### Quality Standards

1. **Consistency** - Same format throughout
2. **Accuracy** - Matches implementation
3. **Completeness** - All public APIs documented
4. **Usability** - Easy to find and understand

### Key Behaviors

- **Never guess** - Verify from source code
- **Show examples** - Every endpoint needs one
- **Document errors** - Users need to handle them
- **Stay current** - Update when code changes

## Inter-Agent Relationships

### Triggers Other Agents

| Action | Triggers |
|--------|----------|
| Creates PR | [PR Reviewer](./pr-reviewer.md) |

### Triggered By

| Source | Via |
|--------|-----|
| PR merge with API changes | `pull_request: closed` |
| Schedule | Cron (Sunday 6am UTC) |
| Human | `workflow_dispatch` |

### Coordination Notes

- Works with [Documentation Sync](./documentation-sync.md) for general docs
- Uses output from [Breaking Change Detector](./breaking-change-detector.md)
- API changes should trigger doc updates

## Example Scenarios

### Scenario 1: New Endpoint

**Context:**
- PR merged adding `POST /api/v1/webhooks`
- No documentation exists

**Action:**
1. Read endpoint implementation
2. Extract types and parameters
3. Generate full endpoint documentation
4. Create example curl command
5. Document error cases
6. Create PR with new docs

### Scenario 2: Parameter Added

**Context:**
- PR added optional `metadata` field to users endpoint
- Existing docs don't mention it

**Action:**
1. Detect new field in type definition
2. Update parameter table
3. Update example to show usage
4. Create PR with updates

### Scenario 3: Weekly Audit

**Context:**
- Weekly scheduled run
- Multiple small changes accumulated

**Action:**
1. Scan all API source files
2. Compare with existing docs
3. Identify all gaps and outdated content
4. Generate comprehensive update PR

## Frontmatter Reference

```yaml
---
name: API Docs Generator
on:
  pull_request:
    types: [closed]
    branches: [main]
    paths:
      - "src/api/**"
      - "src/public/**"
  schedule:
    - cron: '0 6 * * 0'
  workflow_dispatch: {}
permissions:
  contents: write
  pull_requests: write
outputs:
  create-pr: { max: 1 }
  update-file: true
  add-label: true
allowed-paths:
  - "docs/api/**"
  - "docs/reference/**"
  - "API.md"
context:
  pull_requests:
    states: [merged]
    paths: ["src/api/**"]
    limit: 20
  since: "7d"
rate_limit_minutes: 30
claude:
  model: claude-sonnet-4-20250514
  maxTokens: 16384
  temperature: 0.5
---
```

## Customization Options

### Documentation Format

Choose output format:
- Markdown (default)
- OpenAPI/Swagger
- Custom template

### API Paths

Configure which paths contain API code.

### Example Generation

Configure example generation style.

## Metrics to Track

- Documentation coverage percentage
- Docs update lag after code change
- Example accuracy rate
- User feedback on clarity
- Documentation page views
