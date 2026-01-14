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
   - Collects repository data inputs before execution (when configured)

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
- `InputConfig`: Data collection configuration for scheduled/batch agents
- `AuditConfig`: Failure reporting and issue creation settings
- Execution audit types for tracking metrics and errors

## Development Commands

### Build and Test
```bash
bun run build              # Compile TypeScript to dist/
bun test                   # Run Bun tests
bun run test:watch         # Run tests in watch mode
bun run test:coverage      # Generate coverage report
./test-all.sh              # Comprehensive integration test suite
```

### Code Quality
```bash
bun run lint               # ESLint validation
bun run format             # Prettier formatting
```

### Local Development
```bash
bun run dev                # TypeScript watch mode
bun dist/index.js          # Run CLI locally after build
gh extension install .     # Install as gh extension locally
```

### Documentation Site
```bash
bun run docs:dev           # Start Astro dev server for docs
bun run docs:build         # Build documentation site
bun run docs:preview       # Preview built docs
```

## Key Implementation Details

### Generated Workflow Structure

Compiled workflows have this multi-job structure:

1. **pre-flight job**: Runs validation checks
   - Generates GitHub App token (if configured)
   - Checks required secrets (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)
   - Validates user authorization (admin, write, org member, or allow list)
   - Checks trigger labels (if configured)
   - Enforces rate limiting (default: 5 minutes between runs)
   - Tracks validation status for audit reporting
   - Outputs: `should-run=true/false`

2. **collect-inputs job** (optional): Collects repository data
   - Only generated when `inputs` is configured
   - Queries GitHub API for issues, PRs, discussions, commits, etc.
   - Filters by time range and other criteria
   - Skips execution if `min_items` threshold not met
   - Outputs: `has-inputs`, `inputs-data`

3. **claude-agent job**: Runs Claude with agent instructions
   - Checks out repository
   - Sets up Bun runtime
   - Installs Claude Code CLI via bunx
   - Prepares context file with event data and collected inputs
   - Creates skills documentation file (`.claude/CLAUDE.md`) for outputs
   - Runs Claude with appropriate tool permissions
   - Extracts and logs execution metrics (cost, turns, duration)
   - Uploads outputs artifact

4. **execute-outputs job** (optional): Executes agent outputs
   - Only generated when `outputs` is configured
   - Uses matrix strategy to process each output type
   - Validates output files against schemas
   - Executes GitHub operations via gh CLI
   - Reports validation errors

5. **report-results job** (optional): Reports validation errors
   - Posts error comments to issues/PRs
   - Only generated when `outputs` is configured

6. **audit-report job**: Always runs for tracking
   - Collects all audit artifacts
   - Generates comprehensive audit report
   - Runs diagnostic agent on failures (safe mode, read-only)
   - Creates GitHub issues for failures (configurable)

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

### Input Collection System

The input system ([src/generator/input-collector.ts](src/generator/input-collector.ts)) enables agents to collect repository data:

**Key Features**:
- Collects issues, PRs, discussions, commits, releases, workflow runs, stars, forks
- Filters data by time range (`since` field: "last-run", "1h", "24h", "7d")
- Skips agent execution if `min_items` threshold not met
- Formats collected data as markdown sections for Claude

**Implementation Details**:
- Collection script generated by `InputCollector.generateCollectionScript()`
- Uses GitHub CLI (`gh api`) for all API queries
- Supports GraphQL for discussions
- Time filtering handles both GNU and BSD `date` commands (Linux/macOS compatibility)

### GitHub App Integration

The `setup-app` command ([src/cli/commands/setup-app.ts](src/cli/commands/setup-app.ts)) configures GitHub App authentication:
- Displays interactive setup guide
- Collects App ID and private key
- Stores secrets at org level (all repos) or repo level
- Generated workflows automatically use app token when available
- Enables branded identity (commits/comments appear as the app)
- Allows PRs created by the agent to trigger CI workflows

### Agent Markdown Format

Agent files in `.github/agents/*.md` must have:
- YAML frontmatter with `name` (required) and `on` triggers (required)
- Optional fields:
  - `permissions`: GitHub permissions (contents, issues, pull_requests, discussions)
  - `outputs`: Allowed agent actions with constraints
  - `inputs`: Data collection configuration
  - `claude`: Model configuration (model, max_tokens, temperature)
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
- [src/generator/input-collector.test.ts](src/generator/input-collector.test.ts)
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
│   │   ├── index.ts          # WorkflowGenerator class
│   │   ├── index.test.ts     # Generator tests
│   │   ├── input-collector.ts # Input collection script generation
│   │   ├── skills.ts         # Skills documentation generation
│   │   └── outputs/          # Output handler implementations
│   │       ├── base.ts       # OutputHandler interface
│   │       ├── index.ts      # Handler registry
│   │       └── *.ts          # Individual handlers
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
├── .github/agents/    # This repo's own AI agents
└── dist/                     # Compiled output
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

### Adding a New Input Type
1. Add interface in [src/types/index.ts](src/types/index.ts)
2. Add schema in [src/parser/schemas.ts](src/parser/schemas.ts)
3. Add collection logic in [src/generator/input-collector.ts](src/generator/input-collector.ts)
4. Document in docs

### Modifying Workflow Generation
- All workflow generation logic is in [src/generator/index.ts](src/generator/index.ts)
- `generate()`: Main entry point, builds workflow object
- `generateValidationSteps()`: Pre-flight validation
- `generateCollectInputsJob()`: Input collection job
- `generateClaudeAgentSteps()`: Claude execution steps
- `generateExecuteOutputsJob()`: Output execution with matrix strategy
- `generateAuditReportJob()`: Audit and failure reporting
- `generateTokenGenerationStep()`: GitHub App token generation

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
- **eslint**, **prettier**: Code quality
- **astro**, **@astrojs/starlight**: Documentation site

## Environment Variables

When running generated workflows:
- `ANTHROPIC_API_KEY`: Claude API key (one required)
- `CLAUDE_CODE_OAUTH_TOKEN`: Claude OAuth token (one required)
- `GH_APP_ID`: GitHub App ID (optional, for branded identity)
- `GH_APP_PRIVATE_KEY`: GitHub App private key (optional)
- `GITHUB_TOKEN`: Default GitHub token (auto-provided by Actions)
