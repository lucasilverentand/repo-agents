# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ⚠ BREAKING CHANGES

* **dispatcher**: The agent dispatcher workflow has been completely refactored. Users must regenerate workflows after updating to this version.

### Features

* **dispatcher**: move complex logic from YAML to TypeScript CLI commands
  - Reduces generated dispatcher from ~500 lines to ~110 lines (78% reduction)
  - All dispatcher logic now in testable TypeScript instead of embedded bash scripts
  - Adds 4 new CLI commands: `dispatcher:global-preflight`, `dispatcher:prepare-context`, `dispatcher:route`, `dispatcher:dispatch`
  - Enables dynamic agent discovery (no workflow regeneration needed when adding new agents)
  - Improves debugging with structured logging and error messages
  - Creates validation audit artifacts for tracking authorization and rate limiting decisions

### Migration Guide

**Required Actions:**
1. Update repo-agents to the latest version: `bun update repo-agents`
2. Regenerate all workflows: `repo-agents compile`
3. Commit the updated dispatcher workflow: `git commit -am "chore: regenerate dispatcher with simplified architecture"`

**What Changed:**
- The generated `.github/workflows/agent-dispatcher.yml` is now dramatically simpler
- Complex bash scripts (JWT generation, event parsing, routing logic) moved to CLI
- Dispatcher now dynamically discovers agents from `.github/agents/` directory
- Validation logic (authorization, rate limits, trigger labels) unified in TypeScript
- All functionality preserved - only implementation changed

**Rollback Plan:**
If you encounter issues, you can pin to the previous version:
```bash
bunx repo-agent@1.2.0 compile
```

## [1.2.0](https://github.com/lucasilverentand/repo-agents/compare/v1.1.1...v1.2.0) (2026-01-17)


### Features

* add add-reaction output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([3a41d80](https://github.com/lucasilverentand/repo-agents/commit/3a41d8031b88dc0a6cbac0e01eabfea4fb907f2b))
* add approve-pr output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b5b3a4b](https://github.com/lucasilverentand/repo-agents/commit/b5b3a4b2911ff3588235162854f97062fb3ea79f))
* add assign-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b7169b0](https://github.com/lucasilverentand/repo-agents/commit/b7169b077e5f064506d848049792b3b75ef3813d))
* add code_scanning_alerts context collector ([#124](https://github.com/lucasilverentand/repo-agents/issues/124)) ([d7bf047](https://github.com/lucasilverentand/repo-agents/commit/d7bf047438d99e1db1d45e13f746477b4cde438e))
* add convert-to-discussion output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([4195706](https://github.com/lucasilverentand/repo-agents/commit/4195706b52537acb17755348355e4e96e00e6b3c))
* add create-branch output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([f761617](https://github.com/lucasilverentand/repo-agents/commit/f761617ab6e2785d6bf7dc85b6245ab22e9e1792))
* add create-release output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([f8aafba](https://github.com/lucasilverentand/repo-agents/commit/f8aafbad504d57328dc2d9a0573da73503859348))
* add delete-branch output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([23fb286](https://github.com/lucasilverentand/repo-agents/commit/23fb28624bfd5b8b8e13a5d911f388a739132640))
* add dependabot_prs context collector ([#123](https://github.com/lucasilverentand/repo-agents/issues/123)) ([b56931a](https://github.com/lucasilverentand/repo-agents/commit/b56931a57ff4d0f0325f208a7e283b308473b573))
* add deployments context collector ([#125](https://github.com/lucasilverentand/repo-agents/issues/125)) ([c31d79d](https://github.com/lucasilverentand/repo-agents/commit/c31d79d3729b49ba4b628c175692b432113059f6))
* add edit-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([108abe3](https://github.com/lucasilverentand/repo-agents/commit/108abe38a19b3d432847b2b28c10f6c65ec09bd5))
* add lock-conversation output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b388c87](https://github.com/lucasilverentand/repo-agents/commit/b388c87899acfa0c5756f41011315d3b1804ae36))
* add merge-pr output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([8681054](https://github.com/lucasilverentand/repo-agents/commit/86810547e597d56964cb118a40884c01f87a54e9))
* add pin-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([96525c1](https://github.com/lucasilverentand/repo-agents/commit/96525c1b6aabeed2d5e3a5f113ecc7007db9f91c))
* add reopen-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([d989734](https://github.com/lucasilverentand/repo-agents/commit/d98973495b91a235ab23e7dda25cf837f0ecca60))
* add request-review output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([3d63dee](https://github.com/lucasilverentand/repo-agents/commit/3d63dee50271b61f88256af41b49b78f3c38de5f))
* add security_alerts context collector ([#122](https://github.com/lucasilverentand/repo-agents/issues/122)) ([d3cf402](https://github.com/lucasilverentand/repo-agents/commit/d3cf4020675e096bc6d772ac88cc711d861a38d6))
* add set-milestone output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([db794cc](https://github.com/lucasilverentand/repo-agents/commit/db794ccaf08a4482ca11599b78d0525ccc8326ad))
* add trigger-workflow output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([920733b](https://github.com/lucasilverentand/repo-agents/commit/920733bb4d64f327d5e941a94c56967d6dddecbc))
* add types and schemas for new output handlers ([7771d32](https://github.com/lucasilverentand/repo-agents/commit/7771d32c03e1198b337fbb4ee6dfc25edfa69de8))


### Bug Fixes

* **ci:** correct prettier check path for monorepo ([812f322](https://github.com/lucasilverentand/repo-agents/commit/812f322c0462a40501d01064eb9ae12a4fdc42f4))
* disable link validator to unblock docs deployment ([d5de961](https://github.com/lucasilverentand/repo-agents/commit/d5de9616674ff0042990f7a5d39a2cced79be6c3))

## [1.1.1](https://github.com/lucasilverentand/repo-agents/compare/v1.1.0...v1.1.1) (2026-01-14)


### Bug Fixes

* add missing chalk and js-yaml dependencies to CLI package ([34dd950](https://github.com/lucasilverentand/repo-agents/commit/34dd9503b5204b9a8f8c19e71f7953ca7e767941))

## [1.1.0](https://github.com/lucasilverentand/repo-agents/compare/v1.0.0...v1.1.0) (2026-01-14)


### Features

* use scoped package name @repo-agents/cli ([cb97fa0](https://github.com/lucasilverentand/repo-agents/commit/cb97fa0972ce2299b0703bb3e21c1bbe27ff5c0e))


### Bug Fixes

* add missing gray-matter dependency to CLI package ([4245cff](https://github.com/lucasilverentand/repo-agents/commit/4245cff978b19efeba62ea81dd0a91b125b0e9de))
* read version from root package.json for correct bundled output ([f01021e](https://github.com/lucasilverentand/repo-agents/commit/f01021efc6570927b8ae8a2bd56343a4bd8906b2))

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
