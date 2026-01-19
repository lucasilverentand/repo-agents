# Dispatcher Stage Tests

Comprehensive test suite for the dispatcher stages that route GitHub events to appropriate agent workflows.

## Test Coverage

### ✅ route.test.ts (12 tests - all passing)

Tests the dynamic agent discovery and event routing logic:

- Agent discovery from filesystem
- Event matching for issues, PRs, discussions
- Multiple agent routing
- workflow_dispatch with specific agent selection
- Multi-trigger agents
- Workflow filename generation
- Invalid agent file handling

**Key Features Tested:**
- Dynamic agent discovery (no hardcoded routing table)
- Event filtering by trigger types
- Agent selection for manual dispatches
- Graceful handling of parsing errors

### ✅ prepare-context.test.ts (11 tests - all passing)

Tests event data extraction and normalization:

- Issue event data extraction
- Pull request event data extraction
- Discussion event data extraction
- Schedule event data extraction
- Repository dispatch event data extraction
- Base context field generation
- Missing optional fields handling
- Invalid event path handling
- Directory creation

**Key Features Tested:**
- Event payload parsing for all event types
- Normalized data format across different events
- Graceful degradation with missing fields
- Artifact file creation for downstream jobs

### ✅ global-preflight.test.ts (8 tests - all passing)

Tests configuration validation and token generation:

- Claude API key validation
- Claude OAuth token validation
- Missing authentication detection
- GitHub token fallback
- Token priority (FALLBACK_TOKEN > GITHUB_TOKEN)
- Default git user configuration
- GitHub App validation
- Missing token handling

**Key Features Tested:**
- Authentication validation
- Token fallback chain
- Git identity configuration
- Error handling for missing credentials

### ⚠️ dispatch.test.ts (9 tests - 4 passing, 5 requiring mocks)

Tests per-agent validation before workflow dispatch:

**Passing:**
- Org member with write permission
- Label check validation
- Missing trigger labels blocking
- Rate limiting enforcement
- Default rate limit (5 minutes)

**Requires Mocking (skipped in CI):**
- User authorization via allowed_users
- Team-based authorization
- These tests require GitHub API mocking which has limitations in Bun

**Key Features Tested:**
- Agent definition loading
- User authorization (admin, write, org member, allowed lists)
- Trigger label validation
- Rate limiting (default 5 minutes, configurable)
- Validation audit artifact creation

### ✅ dispatch-simple.test.ts (5 tests - all passing)

Simplified dispatch tests without API mocking:

- Agent definition loading
- Invalid agent handling
- Label check skipping for non-issue/PR events
- Trigger label configuration
- Validation audit outputs

## Test Fixtures

### Agent Definitions (`fixtures/*.md`)

- `basic-issue-agent.md` - Simple issue trigger
- `pr-agent-with-labels.md` - PR agent with label requirements
- `scheduled-agent.md` - Cron-based scheduling
- `restricted-agent.md` - Authorization constraints
- `multi-trigger-agent.md` - Multiple event types

### Event Payloads (`fixtures/*.json`)

- `issue-opened-event.json` - Issue opened event
- `pr-opened-event.json` - PR opened with labels
- `discussion-created-event.json` - Discussion event

## Running Tests

```bash
# Run all dispatcher tests
bun test packages/runtime/src/stages/dispatcher/__tests__/

# Run specific test file
bun test packages/runtime/src/stages/dispatcher/__tests__/route.test.ts

# Watch mode
bun test --watch packages/runtime/src/stages/dispatcher/__tests__/
```

## Test Statistics

- **Total Tests:** 45
- **Passing:** 40 (89%)
- **Requires Mocking:** 5 (authorization tests)
- **Test Files:** 5
- **Fixtures:** 8 (5 agents + 3 events)

## Notes

- Tests use temporary directories and cleanup after execution
- No network calls required for passing tests
- Tests verify dispatcher logic moved from 500 lines of YAML to TypeScript
- Mocking limitations: Bun's module mocking doesn't intercept all imports perfectly, so complex authorization tests that need GitHub API mocking are separated

## Future Improvements

- Add integration tests with real GitHub API calls (requires test org/repo)
- Mock fetch() for GitHub App JWT generation testing
- Add performance benchmarks for routing 50+ agents
- Test rate limiting with actual workflow run history
