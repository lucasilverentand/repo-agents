# Contributing to repo-agents

Thank you for your interest in contributing to repo-agents! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Bun 1.3.0 or higher
- GitHub CLI (`gh`)
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/repo-agents
   cd repo-agents
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

4. Build the project:
   ```bash
   bun run build
   ```

5. Run tests:
   ```bash
   bun test
   ```

## Development Workflow

### Project Structure

```
repo-agents/
├── packages/
│   ├── cli/              # CLI package
│   │   └── src/
│   │       ├── commands/ # CLI command implementations
│   │       └── utils/    # CLI utilities
│   ├── parser/           # Markdown and frontmatter parsing
│   ├── generator/        # Workflow YAML generation
│   ├── cli-utils/        # Shared utilities
│   └── types/            # TypeScript type definitions
├── tests/                # Test files
│   └── fixtures/         # Test fixtures
└── package.json
```

### Available Scripts

- `bun run cli` - Run CLI directly from TypeScript source
- `bun test` - Run test suite
- `bun run test:watch` - Run tests in watch mode
- `bun run test:coverage` - Generate coverage report
- `bun run lint` - Lint and format code with Biome
- `bun run lint:fix` - Auto-fix linting and formatting issues
- `bun run typecheck` - TypeScript type checking

### Making Changes

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Write/update tests

4. Ensure tests pass:
   ```bash
   bun test
   ```

5. Ensure linting passes:
   ```bash
   bun run lint
   ```

6. Commit your changes:
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

7. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

8. Open a pull request

## Commit Message Guidelines

Use conventional commit format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Build/tooling changes

Examples:
```
feat: add watch command with auto-compilation
fix: handle missing frontmatter gracefully
docs: update README with examples
test: add tests for parser validation
```

## Code Style

- Follow existing code style
- Use TypeScript strict mode
- Write meaningful variable names
- Add comments for complex logic
- Keep functions small and focused

## Testing

### Writing Tests

Tests are written using Jest. Place test files next to the code they test:

```
src/parser/index.ts
src/parser/index.test.ts
```

Example test:

```typescript
import { agentParser } from './index';

describe('AgentParser', () => {
  it('should parse valid agent definition', async () => {
    const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Test instructions`;

    const { agent, errors } = agentParser.parseContent(content, 'test.md');

    expect(agent).toBeDefined();
    expect(errors).toHaveLength(0);
    expect(agent?.name).toBe('Test Agent');
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Generate coverage report
bun run test:coverage
```

## Adding New Commands

To add a new CLI command:

1. Create command file: `src/cli/commands/your-command.ts`

2. Implement command function:
   ```typescript
   import { logger } from '../utils/logger';

   interface YourCommandOptions {
     option1?: boolean;
   }

   export async function yourCommand(options: YourCommandOptions): Promise<void> {
     logger.info('Running your command...');
     // Implementation
   }
   ```

3. Register command in `src/index.ts`:
   ```typescript
   import { yourCommand } from './cli/commands/your-command';

   program
     .command('your-command')
     .description('Description of your command')
     .option('--option1', 'Description')
     .action(yourCommand);
   ```

4. Add tests: `src/cli/commands/your-command.test.ts`

5. Update documentation

## Adding New Outputs

To add a new output type:

1. Add to type definition in `src/types/index.ts`:
   ```typescript
   export type Output =
     | 'add-comment'
     | 'your-new-output';
   ```

2. Add to schema in `src/parser/schemas.ts`:
   ```typescript
   const outputSchema = z.array(
     z.enum([
       'add-comment',
       'your-new-output',
     ])
   ).optional();
   ```

3. Implement handler in `src/runtime/claude-runner.ts`:
   ```typescript
   case 'your-new-output':
     await this.handleYourNewOutput(owner, name, output.data);
     break;
   ```

4. Update documentation

## Documentation

When making changes:

- Update README.md if adding/changing features
- Add/update JSDoc comments in code
- Update examples if behavior changes
- Add migration notes for breaking changes

## Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add a clear description of changes
4. Link related issues
5. Wait for review

### PR Checklist

- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] No linting errors

## Reporting Issues

When reporting bugs:

1. Check existing issues first
2. Use the issue template
3. Include:
   - repo-agents version
   - Node.js version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs

## Feature Requests

When requesting features:

1. Check existing feature requests
2. Describe the use case
3. Explain why it's valuable
4. Provide examples if possible

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on the code, not the person
- Assume good intentions

## Questions?

- Open a GitHub discussion
- Check existing documentation
- Review closed issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to repo-agents!
