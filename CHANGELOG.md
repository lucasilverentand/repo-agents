# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-03

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

[Unreleased]: https://github.com/yourusername/gh-claude/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yourusername/gh-claude/releases/tag/v0.1.0
[0.0.0]: https://github.com/yourusername/gh-claude/tree/v0.0.0
