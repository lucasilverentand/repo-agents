# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0](https://github.com/lucasilverentand/repo-agents/compare/v0.4.1...v1.0.0) (2026-01-14)


### ⚠ BREAKING CHANGES

* Users need to rename their .github/claude-agents directory to .github/agents

### Features

* add centralized dispatcher workflow for trigger aggregation ([0ae9c55](https://github.com/lucasilverentand/repo-agents/commit/0ae9c551944bad3f7a3e8702548aac88b7eb3efb))
* add interactive Agent Gallery component to documentation ([#103](https://github.com/lucasilverentand/repo-agents/issues/103)) ([c60049c](https://github.com/lucasilverentand/repo-agents/commit/c60049cf11ec8eef7034bb69420d9e9ac68f243e))
* add npm publishing to release workflow ([0be99ef](https://github.com/lucasilverentand/repo-agents/commit/0be99ef6186c8fdb7ff992a3894dd5f17016c51e))
* add opencode provider for agent runner ([#120](https://github.com/lucasilverentand/repo-agents/issues/120)) ([ad5a16f](https://github.com/lucasilverentand/repo-agents/commit/ad5a16fea00623c0233b6d0ed012e32135c87990))
* add unified setup wizard and agent library installer ([#109](https://github.com/lucasilverentand/repo-agents/issues/109)) ([42fd083](https://github.com/lucasilverentand/repo-agents/commit/42fd083a0fcaf4edad5bd397dfa9d64d48f7c3a7))


### Bug Fixes

* allow GitHub App bot to trigger Issue Triage agent ([#106](https://github.com/lucasilverentand/repo-agents/issues/106)) ([45f97cb](https://github.com/lucasilverentand/repo-agents/commit/45f97cb98199dcf364f9c5d8ff8752f80f05f73b))
* correct README badge URLs to match workflow names ([a357657](https://github.com/lucasilverentand/repo-agents/commit/a3576572ba4a12ba4ff1fdbec86aa3ef41f6712a))
* handle rate limiting gracefully in audit-report job ([473e634](https://github.com/lucasilverentand/repo-agents/commit/473e6343bf15a543c4eaf9cfa5a223cec0d730d4))
* ignore trigger validation errors from incomplete SchemaStore schema ([bd96054](https://github.com/lucasilverentand/repo-agents/commit/bd960545271774c1b69b75ae8d51b426ec3a313e))
* remove add-comment from scheduled failure-alerts agent ([1c82e94](https://github.com/lucasilverentand/repo-agents/commit/1c82e94e85531aa747551e072e464f80d4f89e71)), closes [#111](https://github.com/lucasilverentand/repo-agents/issues/111)
* validate cached schema to prevent using stale/corrupted cache ([47441a6](https://github.com/lucasilverentand/repo-agents/commit/47441a652b8fb385a41defb242721fb48a70caaa))

## [0.4.1](https://github.com/lucasilverentand/gh-claude/compare/v0.4.0...v0.4.1) (2026-01-05)


### Bug Fixes

* render footer newlines correctly in comments ([09e2cad](https://github.com/lucasilverentand/gh-claude/commit/09e2cad25f428fdb6f3799a182986dfbeb1d81e8))
* use blockquote for footer instead of horizontal rule ([5fa54ac](https://github.com/lucasilverentand/gh-claude/commit/5fa54ac7a62cdc10e46065ae677e1d95be255d44))
* use file path input for private key in setup-app ([80c49e9](https://github.com/lucasilverentand/gh-claude/commit/80c49e920dbe05e58d71bdd2853a894bf4069c47))

## [0.4.0](https://github.com/lucasilverentand/gh-claude/compare/v0.3.0...v0.4.0) (2025-12-29)


### Features

* add footer with workflow and job link to agent-generated comments and discussions ([a48c8f0](https://github.com/lucasilverentand/gh-claude/commit/a48c8f0b6aab8332e91b7f35e8f7db581cbf4e15))


### Bug Fixes

* handle boolean .labels in jq filter to prevent iteration error ([#75](https://github.com/lucasilverentand/gh-claude/issues/75)) ([bab07b2](https://github.com/lucasilverentand/gh-claude/commit/bab07b2f0dec1cffb5eb5a1ec7891c65760d8023)), closes [#61](https://github.com/lucasilverentand/gh-claude/issues/61)
* resolve failing unit tests ([fc6ebc8](https://github.com/lucasilverentand/gh-claude/commit/fc6ebc8fbd7484b015bb74030ebeaac4129936f4))
* use concatenated template for issue/PR number detection ([d553ee7](https://github.com/lucasilverentand/gh-claude/commit/d553ee7f98d002710f0d4e33fbb0e464b8f377ab))
* use concatenated template for issue/PR number detection ([0b5d4ca](https://github.com/lucasilverentand/gh-claude/commit/0b5d4cae402aaf2e1f07685fe67b4e2890c2b8ea))

## [0.3.0](https://github.com/lucasilverentand/gh-claude/compare/v0.2.0...v0.3.0) (2025-12-25)


### Features

* add codebase improver agent for automated PR creation ([ccd0999](https://github.com/lucasilverentand/gh-claude/commit/ccd09996518fb680561bc4ebcccd949aae05ef5c))
* add setup-app command for GitHub App authentication ([4601d58](https://github.com/lucasilverentand/gh-claude/commit/4601d58a1571de92db4af3c41580c1a897a34f2b))


### Bug Fixes

* handle existing branches in create-pr executor ([a40ff4c](https://github.com/lucasilverentand/gh-claude/commit/a40ff4c2ec5f0fe333f8dbdd30d41698fd69892b))
* handle multi-line content in create-pr output executor ([6751127](https://github.com/lucasilverentand/gh-claude/commit/67511279b1bfc8224f884a3272942d1dfc56df31))
* prettier formatting and rename CI workflow ([3c6e75e](https://github.com/lucasilverentand/gh-claude/commit/3c6e75efc308fd4caede8cea9a10eca0b60a608c))
* resolve all ESLint warnings and migrate to flat config ([3ffb3fd](https://github.com/lucasilverentand/gh-claude/commit/3ffb3fdf95a26ebca6d6877accd354c7fb190dc4))
* resolve TypeScript compilation errors ([#53](https://github.com/lucasilverentand/gh-claude/issues/53)) ([4885f54](https://github.com/lucasilverentand/gh-claude/commit/4885f541a281c9ffaee4469180bb666ea40aa366))
* run Claude in repo directory instead of /tmp/claude ([e9a7c95](https://github.com/lucasilverentand/gh-claude/commit/e9a7c95aa2a3672f1ca4dfa22dce9255f88a3a1a))
* strengthen agent instructions to force output file creation ([3413d4c](https://github.com/lucasilverentand/gh-claude/commit/3413d4c30f414b3126078bf459f9e3fe2dcebb4d))
* support both org and repo level secrets in setup-app ([f4019a6](https://github.com/lucasilverentand/gh-claude/commit/f4019a6b0e74c391679bb3955ed35846189560a9))
* support multiple create-pr output files ([e50df52](https://github.com/lucasilverentand/gh-claude/commit/e50df5257d47349ecf3ca3a00e1ead7a3e8e3d69))
* update codebase-improver to use skill system for PR creation ([04f7401](https://github.com/lucasilverentand/gh-claude/commit/04f7401ce9be914012f8be952bc46af8849b463a))
* use snake_case for pull_requests permission in agent ([1a00fd7](https://github.com/lucasilverentand/gh-claude/commit/1a00fd7ecd2c4111074e31dd38fb0311759d03a7))
* use URL query params instead of -f flags for GitHub API calls ([229da59](https://github.com/lucasilverentand/gh-claude/commit/229da59a75f9631b3b5f4bd8772126724fa94474))

## [Unreleased]

## [0.2.0](https://github.com/lucasilverentand/gh-claude/compare/v0.1.0...v0.2.0) (2024-12-14)

### Features

* **audit:** add two-tier audit system with safe-mode diagnostic agent ([493bfac](https://github.com/lucasilverentand/gh-claude/commit/493bfac))
  * Audit configuration in agent frontmatter (`create_issues`, `labels`, `assignees`)
  * Capture Claude execution metrics (cost, turns, duration, session ID)
  * Track permission issues and validation failures during pre-flight
  * Two-tier behavior: quiet mode on success, alert mode on failure
  * Run safe-mode diagnostic agent (read-only tools) to analyze failures
  * Auto-create GitHub issues with diagnosis and remediation steps
  * Deduplicate issues by adding comments to existing open issues

## [0.1.0] - 2024-12-03

### Added

#### Core Features
- Initial release of gh-claude
- CLI extension for GitHub CLI
- Markdown-to-workflow compilation
- Natural language agent definitions with YAML frontmatter

#### Commands
- `gh claude init` - Initialize gh-claude in repository
- `gh claude compile` - Compile agents to workflows
- `gh claude validate` - Validate agent definitions
- `gh claude list` - List all agents

#### Parser & Validation
- Markdown parser with gray-matter
- Zod schema validation for frontmatter
- Comprehensive error reporting
- Warning and error severity levels

#### Workflow Generation
- GitHub Actions workflow YAML generation
- Support for multiple trigger types (issues, pull requests, discussions, schedule, workflow_dispatch)
- Permission management
- Safe output configuration
- Claude model configuration

#### Runtime
- GitHub Actions runtime environment
- Claude API integration
- GitHub API integration via Octokit
- Safe output handlers for:
  - add-comment
  - add-label
  - create-issue

#### Developer Experience
- Colorized terminal output
- Progress indicators with spinners
- Detailed validation feedback
- Dry-run mode for testing

#### Documentation
- Comprehensive README
- Contributing guidelines
- Example agent templates:
  - Issue triage
  - PR review
  - Daily summary
  - Stale issue management
- Examples documentation

#### Security
- Explicit permission requirements
- Safe output validation
- Path restrictions for file modifications
- API key management through GitHub secrets

### Technical Details

#### Dependencies
- TypeScript 5.4+
- Node.js 20+
- Commander.js for CLI
- Anthropic SDK for Claude API
- Octokit for GitHub API
- Zod for schema validation
- gray-matter for frontmatter parsing
- js-yaml for YAML generation
- chalk and ora for terminal UI
- Jest for testing

#### Project Structure
- Modular architecture with separate CLI, parser, generator, and runtime modules
- Strict TypeScript configuration
- ESLint and Prettier for code quality
- Comprehensive test setup with Jest

## [0.0.0] - 2025-12-03

### Planning
- Initial project planning and design
- Architecture decisions documented
- Implementation roadmap created

---

## Versioning Strategy

- **Major (1.0.0)**: Breaking changes, major feature additions
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, minor improvements

## Release Notes Format

Each release includes:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

[Unreleased]: https://github.com/lucasilverentand/gh-claude/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lucasilverentand/gh-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lucasilverentand/gh-claude/releases/tag/v0.1.0
