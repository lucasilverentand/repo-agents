# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**gh-claude** is a GitHub CLI extension that transforms natural language markdown files into GitHub Actions workflows powered by Claude AI. Users write agent definitions in `.github/claude-agents/*.md` files (markdown with YAML frontmatter), and the tool compiles these into executable GitHub Actions workflows that use the Claude Code CLI.

## Core Architecture

### Three-Stage Pipeline

1. **Parser** ([src/parser/](src/parser/)) - Parses markdown files with YAML frontmatter
   - Uses `gray-matter` to extract frontmatter and markdown body
   - Validates frontmatter against Zod schemas ([src/parser/schemas.ts](src/parser/schemas.ts))
   - Returns `AgentDefinition` objects with validation errors

2. **Generator** ([src/generator/](src/generator/)) - Converts agent definitions to GitHub Actions YAML
   - Creates two-job workflow structure: `validate` → `claude-agent`
   - Validate job: Checks secrets, user authorization, labels, rate limits
   - Claude agent job: Installs Claude Code CLI and runs it with agent instructions
   - **Key detail**: Generated workflows execute `claude` CLI directly with agent markdown as prompt

3. **CLI** ([src/cli/](src/cli/)) - Commander.js-based command interface
   - `init`: Scaffolds `.github/claude-agents/` directory and examples
   - `compile`: Parses agent markdown and generates workflow YAML
   - `validate`: Validates agent definitions without generating workflows
   - `list`: Lists all agents in repository
   - `setup-token`: Configures Claude API authentication

### Type System

All core types are defined in [src/types/index.ts](src/types/index.ts):
- `AgentDefinition`: Complete agent specification (frontmatter + markdown)
- `TriggerConfig`: GitHub event triggers (issues, PRs, discussions, schedule, etc.)
- `PermissionsConfig`: GitHub permissions (contents, issues, pull_requests, discussions)
- `OutputConfig`: Allowed agent actions (add-comment, add-label, create-pr, etc.)

## Development Commands

### Build and Test
```bash
npm run build              # Compile TypeScript to dist/
npm test                   # Run Jest tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
./test-all.sh             # Comprehensive integration test suite
```

### Code Quality
```bash
npm run lint              # ESLint validation
npm run format            # Prettier formatting
```

### Local Development
```bash
npm run dev               # TypeScript watch mode
node dist/index.js        # Run CLI locally after build
gh extension install .    # Install as gh extension locally
```

## Key Implementation Details

### Generated Workflow Structure

Compiled workflows always have this two-job structure:

1. **validate job**: Runs bash script that checks:
   - Required secrets (ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN)
   - User authorization (admin, write, org member, or explicit allow list)
   - Trigger labels (if configured)
   - Rate limiting (5-minute default between runs)
   - Outputs: `should-run=true/false`

2. **claude-agent job**: Runs if validation passes:
   - Checks out repository
   - Sets up Node.js 20
   - Installs Claude Code CLI: `npm install -g @anthropic-ai/claude-code`
   - Runs: `claude -p "<context>\n---\n<agent-markdown>" --allowedTools "Bash(git*),Bash(gh*),Read,Glob,Grep"`

### Agent Markdown Format

Agent files in `.github/claude-agents/*.md` must have:
- YAML frontmatter with `name` (required) and `on` triggers (required)
- Optional: `permissions`, `outputs`, `claude`, `allowed-users`, `allowed-paths`, `triggerLabels`, `rateLimitMinutes`
- Markdown body: Natural language instructions for Claude

### Validation Logic

The parser performs multi-level validation:
1. Frontmatter parsing (gray-matter)
2. Schema validation (Zod against [src/parser/schemas.ts](src/parser/schemas.ts))
3. Business logic validation ([src/parser/index.ts](src/parser/index.ts:107-157)):
   - `update-file` requires `allowed-paths`
   - `create-pr` and `update-file` require `contents: write`
   - At least one trigger must be specified

## Testing Strategy

The [test-all.sh](test-all.sh) script provides comprehensive integration testing:
1. **Build**: Ensures TypeScript compiles
2. **CLI**: Tests help and version commands
3. **Validation**: Validates all example agents
4. **Compilation**: Tests dry-run and actual compilation with temp directory
5. **Repository**: Verifies list command works in test repo

Unit tests use Jest and are colocated with source files (e.g., [src/parser/index.test.ts](src/parser/index.test.ts)).

## Common Workflows

### Adding a New CLI Command
1. Create command file in [src/cli/commands/](src/cli/commands/)
2. Import and register in [src/index.ts](src/index.ts)
3. Use `logger` from [src/cli/utils/logger.ts](src/cli/utils/logger.ts) for output
4. Use `ora` spinner for long-running operations

### Adding a New Output Type
1. Add to `Output` type in [src/types/index.ts](src/types/index.ts:59-67)
2. Update validation in [src/parser/index.ts](src/parser/index.ts:107-157) if it requires special permissions
3. Document in README

### Modifying Workflow Generation
- All workflow generation logic is in [src/generator/index.ts](src/generator/index.ts)
- The `generate()` method builds the workflow object
- The `generateClaudeStep()` method creates the CLI invocation
- Always maintain the two-job structure (validate → claude-agent)

## Dependencies

Key dependencies and their purposes:
- **commander**: CLI framework
- **gray-matter**: Frontmatter parsing
- **js-yaml**: YAML generation for workflows
- **zod**: Schema validation
- **chalk**: Terminal colors
- **ora**: Loading spinners
