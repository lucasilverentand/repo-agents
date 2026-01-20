# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Repo Agents** is a CLI tool that transforms natural language markdown files into GitHub Actions workflows powered by AI. Users write agent definitions in `.github/agents/*.md` files (markdown with YAML frontmatter), and the tool compiles these into executable GitHub Actions workflows that use the Claude Code CLI.

## Tech Stack

- **Runtime**: Bun (Node.js compatible)
- **Language**: TypeScript
- **Testing**: Bun test (Jest-compatible)
- **CLI Framework**: Commander.js
- **Schema Validation**: Zod
- **YAML Processing**: gray-matter (parsing), js-yaml (generation)

## Core Architecture

### Three-Stage Pipeline

1. **Parser** ([src/parser/](src/parser/)) - Parses markdown files with YAML frontmatter
   - Uses `gray-matter` to extract frontmatter and markdown body
   - Validates frontmatter against Zod schemas ([src/parser/schemas.ts](src/parser/schemas.ts))
   - Returns `AgentDefinition` objects with validation errors
   - Performs business logic validation (e.g., `update-file` requires `allowed-paths`)

2. **Generator** ([src/generator/](src/generator/)) - Converts agent definitions to GitHub Actions YAML
   - Creates multi-job workflow structure with validation, execution, and audit phases
   - Generates GitHub App token for branded identity (optional)
   - Creates skills documentation for Claude based on configured outputs
   - Collects repository data context before execution (when configured)

3. **CLI** ([src/cli/](src/cli/)) - Commander.js-based command interface
   - `init`: Scaffolds `.github/agents/` directory and examples
   - `compile`: Parses agent markdown and generates workflow YAML
   - `validate`: Validates agent definitions without generating workflows
   - `list`: Lists all agents in repository
   - `setup-token`: Configures Claude API authentication (API key or OAuth)
   - `setup-app`: Configures GitHub App for branded identity and CI triggering

### Type System

All core types are defined in [src/types/index.ts](src/types/index.ts):
- `AgentDefinition`: Complete agent specification (frontmatter + markdown)
- `TriggerConfig`: GitHub event triggers (issues, PRs, discussions, schedule, etc.)
- `PermissionsConfig`: GitHub permissions (contents, issues, pull_requests, discussions)
- `OutputConfig`: Allowed agent actions with constraints
- `Output`: Output type literals (add-comment, add-label, create-pr, etc.)
- `ContextConfig`: Data collection configuration for scheduled/batch agents
- `AuditConfig`: Failure reporting and issue creation settings
- Execution audit types for tracking metrics and errors

## Development Commands

### Build and Test
```bash
bun test                   # Run Bun tests
bun run test:watch         # Run tests in watch mode
bun run test:coverage      # Generate coverage report
./test-all.sh              # Comprehensive integration test suite
```

### Code Quality
```bash
bun run lint               # Biome check (linting + formatting)
bun run lint:fix           # Biome fix (auto-fix issues)
bun run format             # Biome format
bun run typecheck          # TypeScript type checking
```

### Local Development
```bash
bun run cli                # Run CLI directly from TypeScript source
```

### Documentation Site
```bash
bun run docs:dev           # Start Astro dev server for docs
bun run docs:build         # Build documentation site
bun run docs:preview       # Preview built docs
```

## Key Implementation Details

### Generated Workflow Structure

The system generates a **single unified workflow** (`.github/workflows/agents.yml`) that handles all agents with 6 jobs:

#### Unified Workflow Architecture

**Benefits:**
- Single workflow file instead of 1 dispatcher + N agent workflows
- Eliminates ~10-15 seconds of workflow_dispatch overhead
- Better visibility - all agent execution in one workflow run
- Simplified architecture with matrix-based parallelism

**Job Structure:**

1. **global-preflight job**: Claude authentication validation
   - Checks required secrets (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)
   - Outputs: `should-continue`
   - Runtime: ~5 seconds

2. **route-event job**: Discovers and matches agents to events
   - Scans `.github/agents/` directory for all agent definitions
   - Parses agent configurations and builds routing table
   - Matches current event (issues, PRs, discussions, schedule, etc.) to agent triggers
   - Handles closed issue retry logic for blocking dependencies
   - Outputs: `matching-agents` (JSON array with full agent config)
   - Runtime: ~10 seconds

3. **agent-validation job** (matrix): Per-agent validation
   - **Matrix strategy**: One job per matching agent (parallel execution)
   - Validates user authorization (repo permission, org membership, allowed lists, teams)
   - Checks trigger labels (if configured)
   - Enforces rate limiting (default: 5 minutes between runs)
   - Checks max open PRs limit (if configured)
   - Checks blocking issues (if configured)
   - Creates progress comment (if enabled)
   - Encodes event payload for agent context
   - Outputs: `should-run`, `skip-reason`, validation metadata
   - Uploads validation audit artifact
   - Runtime: ~20-30 seconds per agent (parallel)

4. **agent-execution job** (matrix): Runs Claude for validated agents
   - **Matrix strategy**: One job per matching agent (parallel execution)
   - **Conditional execution**: Only runs if validation passed
   - Checks out code and sets up environment
   - Generates GitHub App token (if GH_APP_ID and GH_APP_PRIVATE_KEY configured)
   - **Inline context collection**: Runs context collection as conditional step
     - Collects repository data (issues, PRs, discussions, commits) if configured
     - Skips agent execution if min_items threshold not met
   - Configures git identity (uses app identity if available)
   - Runs Claude Code CLI with agent instructions
   - Uploads agent outputs artifact (if outputs configured)
   - Uploads audit metrics artifact
   - Runtime: ~2-5 minutes per agent (depends on Claude execution)

5. **execute-outputs job** (matrix): Executes agent outputs
   - **Matrix strategy**: One job per (agent × output-type)
   - Downloads agent outputs artifact
   - Validates output files against schemas
   - Executes GitHub operations via gh CLI (add-comment, create-pr, etc.)
   - Runtime: ~10-20 seconds per output (parallel)

6. **audit-report job** (matrix): Generates audit reports
   - **Matrix strategy**: One job per agent that executed
   - **Always runs**: Even on failures
   - Downloads all artifacts for the agent
   - Collects job results from previous stages
   - Generates comprehensive audit report
   - Creates GitHub issue for failures (if audit configured)
   - Updates progress comment with final status
   - Runtime: ~15-20 seconds per agent (parallel)

**Workflow File:**
- Location: `.github/workflows/agents.yml`
- Triggers: Union of all agent triggers (aggregated automatically)
- Permissions: Maximum permissions needed across all agents
- Matrix parallelism: Multiple agents execute simultaneously

### Output Handlers System

The output system ([src/generator/outputs/](src/generator/outputs/)) uses a registry pattern:

- **Base interface** ([src/generator/outputs/base.ts](src/generator/outputs/base.ts)):
  - `getContextScript()`: Fetches dynamic context (e.g., available labels)
  - `generateSkill()`: Creates Claude instructions for the output
  - `generateValidationScript()`: Validates and executes the output

- **Registry** ([src/generator/outputs/index.ts](src/generator/outputs/index.ts)):
  - Singleton registry mapping output types to handlers
  - All handlers registered at module load time

- **Available handlers**:
  - `add-comment`: Add comments to issues/PRs
  - `add-label`, `remove-label`: Label management
  - `create-issue`: Create new issues
  - `create-discussion`: Create discussions
  - `create-pr`: Create pull requests with code changes
  - `update-file`: Modify repository files
  - `close-issue`, `close-pr`: Close issues/PRs

### Skills System

The skills system ([src/generator/skills.ts](src/generator/skills.ts)) generates documentation for Claude:
- Creates "Available Operations" section based on enabled outputs
- Documents MCP tool usage for each operation
- Includes constraints, examples, and path restrictions
- Written to `.claude/CLAUDE.md` in the workflow

### Context Collection System

The context system ([src/generator/context-collector.ts](src/generator/context-collector.ts)) enables agents to collect repository data:

**Key Features**:
- Collects issues, PRs, discussions, commits, releases, workflow runs, stars, forks
- Filters data by time range (`since` field: "last-run", "1h", "24h", "7d")
- Skips agent execution if `min_items` threshold not met
- Formats collected data as markdown sections for Claude

**Implementation Details**:
- Collection script generated by `ContextCollector.generateCollectionScript()`
- Uses GitHub CLI (`gh api`) for all API queries
- Supports GraphQL for discussions
- Time filtering handles both GNU and BSD `date` commands (Linux/macOS compatibility)

### GitHub App Integration

The `setup-app` command ([src/cli/commands/setup-app.ts](src/cli/commands/setup-app.ts)) configures GitHub App authentication:
- Displays interactive setup guide
- Collects App ID and private key
- Stores secrets at org level (all repos) or repo level

Token generation happens in each agent workflow's setup job:
- If GH_APP_ID and GH_APP_PRIVATE_KEY are configured, generates an app token
- Falls back to GITHUB_TOKEN if no app configured
- Enables branded identity (commits/comments appear as the app)
- Allows PRs created by the agent to trigger CI workflows

### Agent Markdown Format

Agent files in `.github/agents/*.md` must have:
- YAML frontmatter with `name` (required) and `on` triggers (required)
- Optional fields:
  - `permissions`: GitHub permissions (contents, issues, pull_requests, discussions)
  - `outputs`: Allowed agent actions with constraints
  - `context`: Data collection configuration
  - `provider`: AI provider to use ("claude-code" or "opencode")
  - `allowed-users`, `allowed-actors`, `allowed-teams`: Authorization lists
  - `allowed-paths`: Glob patterns for file operations
  - `trigger_labels`: Labels required to trigger agent
  - `rate_limit_minutes`: Minimum interval between runs (default: 5)
  - `audit`: Failure reporting configuration
- Markdown body: Natural language instructions for Claude

### Validation Logic

The parser performs multi-level validation:
1. Frontmatter parsing (gray-matter)
2. Schema validation (Zod against [src/parser/schemas.ts](src/parser/schemas.ts))
3. Business logic validation ([src/parser/index.ts](src/parser/index.ts:109-159)):
   - `update-file` requires `allowed-paths`
   - `create-pr` and `update-file` require `contents: write`
   - At least one trigger must be specified

## Testing Strategy

The [test-all.sh](test-all.sh) script provides comprehensive integration testing:
1. **Build**: Ensures TypeScript compiles with Bun
2. **CLI**: Tests help and version commands
3. **Validation**: Validates all example agents
4. **Compilation**: Tests dry-run and actual compilation with temp directory
5. **Repository**: Verifies list command works in test repo

Unit tests use Bun test (Jest-compatible) and are colocated with source files:
- [src/parser/index.test.ts](src/parser/index.test.ts)
- [src/generator/index.test.ts](src/generator/index.test.ts)
- [src/generator/context-collector.test.ts](src/generator/context-collector.test.ts)
- [src/generator/outputs/index.test.ts](src/generator/outputs/index.test.ts)
- [src/generator/skills.test.ts](src/generator/skills.test.ts)
- [src/cli/utils/*.test.ts](src/cli/utils/)

## Project Structure

```
repo-agents/
├── src/
│   ├── index.ts              # CLI entry point, command registration
│   ├── types/index.ts        # All TypeScript type definitions
│   ├── parser/
│   │   ├── index.ts          # AgentParser class
│   │   ├── index.test.ts     # Parser tests
│   │   └── schemas.ts        # Zod schemas for frontmatter
│   ├── generator/
│   │   ├── unified.ts        # UnifiedWorkflowGenerator class (NEW)
│   │   ├── unified.test.ts   # Unified workflow tests
│   │   ├── index.ts          # WorkflowGenerator class (deprecated)
│   │   ├── dispatcher.ts     # DispatcherGenerator class (deprecated)
│   │   ├── context-collector.ts # Context collection script generation
│   │   ├── skills.ts         # Skills documentation generation
│   │   └── outputs/          # Output handler implementations
│   │       ├── base.ts       # OutputHandler interface
│   │       ├── index.ts      # Handler registry
│   │       └── *.ts          # Individual handlers
│   ├── runtime/
│   │   ├── src/stages/
│   │   │   ├── unified/      # Unified workflow stages (NEW)
│   │   │   │   ├── route.ts  # Agent discovery and event routing
│   │   │   │   └── validate.ts # Per-agent validation
│   │   │   ├── dispatcher/   # Dispatcher stages (deprecated)
│   │   │   └── *.ts          # Agent execution stages
│   │   └── src/utils/
│   │       └── validation.ts # Reusable validation utilities (NEW)
│   └── cli/
│       ├── commands/         # CLI command implementations
│       │   ├── init.ts       # repo-agents init
│       │   ├── compile.ts    # repo-agents compile
│       │   ├── validate.ts   # repo-agents validate
│       │   ├── list.ts       # repo-agents list
│       │   ├── auth.ts       # repo-agents setup-token
│       │   └── setup-app.ts  # repo-agents setup-app
│       └── utils/
│           ├── logger.ts     # Logging utilities
│           ├── files.ts      # File operations
│           ├── git.ts        # Git utilities
│           └── workflow-validator.ts
├── examples/                 # Example agent definitions
├── tests/fixtures/           # Test fixtures
├── docs/                     # Astro documentation site
│   └── src/content/docs/     # Documentation content
└── .github/agents/           # This repo's own AI agents
```

## Common Workflows

### Adding a New CLI Command
1. Create command file in [src/cli/commands/](src/cli/commands/)
2. Export an async function that takes options parameter
3. Import and register in [src/index.ts](src/index.ts)
4. Use `logger` from [src/cli/utils/logger.ts](src/cli/utils/logger.ts) for output
5. Use `ora` spinner for long-running operations

### Adding a New Output Type
1. Add to `Output` type in [src/types/index.ts](src/types/index.ts:67-76)
2. Add to output enum in [src/parser/schemas.ts](src/parser/schemas.ts:72-82)
3. Create handler in [src/generator/outputs/](src/generator/outputs/)
4. Register handler in [src/generator/outputs/index.ts](src/generator/outputs/index.ts)
5. Add skill generator in [src/generator/skills.ts](src/generator/skills.ts)
6. Update validation in [src/parser/index.ts](src/parser/index.ts) if it requires special permissions
7. Document in README and docs

### Adding a New Context Type
1. Add interface in [src/types/index.ts](src/types/index.ts)
2. Add schema in [src/parser/schemas.ts](src/parser/schemas.ts)
3. Add collection logic in [src/generator/context-collector.ts](src/generator/context-collector.ts)
4. Document in docs

### Modifying Workflow Generation
- **Unified workflow generation** in [packages/generator/src/unified.ts](packages/generator/src/unified.ts)
  - `generate()`: Main entry point, builds single workflow with 6 jobs
  - `aggregateTriggers()`: Combines triggers from all agents
  - `aggregatePermissions()`: Calculates maximum permissions needed
  - `generateGlobalPreflightJob()`: Claude auth validation
  - `generateRouteEventJob()`: Agent discovery and event matching
  - `generateValidationJob()`: Per-agent validation (matrix)
  - `generateExecutionJob()`: Agent execution (matrix)
  - `generateOutputsJob()`: Output execution (matrix)
  - `generateAuditJob()`: Audit reporting (matrix)
  - `formatYaml()`: YAML formatting with proper spacing

- **Runtime stages** in [packages/runtime/src/stages/](packages/runtime/src/stages/)
  - `unified/route.ts`: Discovers all agents and matches events
  - `unified/validate.ts`: Per-agent validation with all checks
  - `agent.ts`: Runs Claude with inline context collection
  - `context.ts`: Collects repository data (issues, PRs, etc.)
  - `outputs.ts`: Executes agent outputs via gh CLI
  - `audit.ts`: Generates audit reports and failure issues

- **Validation utilities** in [packages/runtime/src/utils/validation.ts](packages/runtime/src/utils/validation.ts)
  - `checkUserAuthorization()`: Validates user permissions
  - `checkTriggerLabels()`: Validates required labels
  - `checkRateLimit()`: Enforces rate limiting
  - `checkMaxOpenPRs()`: Checks PR limits
  - `checkBlockingIssues()`: Checks for blocking dependencies

- **Deprecated files** (kept for reference):
  - `packages/generator/src/dispatcher.ts`: Old dispatcher generator
  - `packages/generator/src/index.ts`: Old per-agent workflow generator
  - `packages/runtime/src/stages/dispatcher/`: Old dispatcher stages

## Dependencies

Key dependencies and their purposes:
- **commander**: CLI framework
- **gray-matter**: Frontmatter parsing from markdown
- **js-yaml**: YAML generation for workflows
- **zod**: Schema validation for agent definitions
- **chalk**: Terminal colors for CLI output
- **ora**: Loading spinners for async operations
- **ajv**, **ajv-formats**: JSON schema validation (for outputs)

Dev dependencies:
- **typescript**: Type system
- **@types/***: TypeScript type definitions
- **@biomejs/biome**: Unified linting and formatting
- **lefthook**: Git hooks manager
- **astro**, **@astrojs/starlight**: Documentation site

## Environment Variables

When running generated workflows:
- `ANTHROPIC_API_KEY`: Claude API key (one required)
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude OAuth token (one required)
- `GH_APP_ID`: GitHub App ID (optional, for branded identity)
- `GH_APP_PRIVATE_KEY`: GitHub App private key (optional)
- `GITHUB_TOKEN`: Default GitHub token (auto-provided by Actions)
