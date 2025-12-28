---
title: Configuration
description: Configure gh-claude for your repository
---

Repository configuration is managed through `.github/claude.yml`.

## Configuration File

The `.github/claude.yml` file contains default settings for all agents:

```yaml
# Default Claude model configuration
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 4096
  temperature: 0.7

# Repository settings
repository:
  agents_dir: .github/claude-agents
  workflows_dir: .github/workflows

# Security settings
security:
  require_outputs: true
  require_permissions: true
```

## Claude Settings

### `model`

The default Claude model for agents:

```yaml
claude:
  model: claude-3-5-sonnet-20241022
```

Available models:
- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

### `max_tokens`

Maximum tokens for Claude responses:

```yaml
claude:
  max_tokens: 4096
```

### `temperature`

Creativity vs consistency (0.0 - 1.0):

```yaml
claude:
  temperature: 0.7
```

Lower values (0.1-0.3) for consistent, focused responses.
Higher values (0.7-1.0) for more creative responses.

## Repository Settings

### `agents_dir`

Location of agent markdown files:

```yaml
repository:
  agents_dir: .github/claude-agents
```

### `workflows_dir`

Output directory for compiled workflows:

```yaml
repository:
  workflows_dir: .github/workflows
```

## Security Settings

### `require_outputs`

Require explicit output definitions:

```yaml
security:
  require_outputs: true
```

When `true`, agents without `outputs:` in frontmatter will fail validation.

### `require_permissions`

Require explicit permissions:

```yaml
security:
  require_permissions: true
```

When `true`, agents without `permissions:` will fail validation.

## Environment Variables

### `ANTHROPIC_API_KEY`

Your Anthropic API key (required):

```bash
gh secret set ANTHROPIC_API_KEY
```

### `GITHUB_TOKEN`

Automatically provided by GitHub Actions.

## Per-Agent Overrides

Individual agents can override defaults:

```yaml
---
name: Special Agent
claude:
  model: claude-3-opus-20240229  # Override default model
  temperature: 0.3                # Override default temperature
---
```

## Example Configurations

### High Security

```yaml
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 2048
  temperature: 0.3

security:
  require_outputs: true
  require_permissions: true
```

### Development/Testing

```yaml
claude:
  model: claude-3-haiku-20240307  # Faster, cheaper for testing
  max_tokens: 2048
  temperature: 0.7

security:
  require_outputs: false
  require_permissions: false
```

## See Also

- [Authentication](/gh-claude/guide/authentication/) - API key setup
- [Quick Reference](/gh-claude/reference/quick-reference/) - All configuration options
- [Agent Definition](/gh-claude/guide/agent-definition/) - Per-agent configuration
- [Cost Estimation](/gh-claude/guide/cost-estimation/) - Model cost comparison
