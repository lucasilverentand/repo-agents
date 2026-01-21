# Legacy Agent Fixtures

This directory contains agent definition fixtures representing older versions of the repo-agents format. These fixtures are used for backward compatibility testing to ensure that agents written for previous versions continue to work with the current codebase.

## Versions

### v1.0 Fixtures

Early version of the agent format with minimal features:

- **v1.0-basic.md** - Basic agent with minimal configuration (name, trigger, permissions, simple output)
- **v1.0-no-optional-fields.md** - Agent with only required fields (name and trigger)
- **v1.0-schedule.md** - Schedule-triggered agent

**Features:**
- Basic triggers (issues, pull_request, schedule)
- Simple permissions
- Boolean output values
- No advanced features

### v1.4 Fixtures

Later version with expanded features:

- **v1.4-simple-outputs.md** - Multiple boolean outputs with `allowed-actors`
- **v1.4-output-config.md** - Output configuration objects with `max` limits
- **v1.4-multiple-triggers.md** - Multiple trigger types with various features
- **v1.4-pr-workflow.md** - PR workflow with file operations and signed commits

**Features:**
- Output configuration objects (`{ max: 5 }`, `{ sign: true }`)
- `allowed-actors` for authorization
- `allowed-paths` for file operations
- `rate_limit_minutes` for rate limiting
- `max_open_prs` for PR limits
- Multiple trigger types (issues, PRs, discussions, schedule)

## Purpose

These fixtures ensure that:

1. **Parser Compatibility** - Old agent formats still parse successfully
2. **Validation** - Legacy agents pass validation with current rules
3. **Workflow Generation** - Valid GitHub Actions workflows are generated from legacy agents
4. **Feature Preservation** - All features from older versions continue to work

## Testing

The backward compatibility tests are located in:
```
packages/generator/src/backward-compat.test.ts
```

Run with:
```bash
bun test packages/generator/src/backward-compat.test.ts
```

## Migration Notes

While these legacy formats continue to work, new agents should use the current format documented in the main README. Notable improvements in current versions:

- `allowed-users` and `allowed-teams` (more explicit than `allowed-actors`)
- `context` configuration for data collection
- `audit` configuration for failure reporting
- `provider` field for AI provider selection
- `progress_comment` for progress tracking
- Expanded output types (20+ operations)
- Pre-flight checks configuration

Legacy fields like `allowed-actors` are still supported but `allowed-users` is now preferred for clarity.
