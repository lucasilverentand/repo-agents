import { AgentParser } from './index';
import { join } from 'path';

describe('AgentParser', () => {
  let parser: AgentParser;

  beforeEach(() => {
    parser = new AgentParser();
  });

  describe('parseContent', () => {
    it('should parse valid simple agent', () => {
      const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

# Test Instructions
Do something.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Test Agent');
      expect(agent?.on.issues).toEqual({ types: ['opened'] });
      expect(errors).toHaveLength(0);
    });

    it('should parse agent with all fields', () => {
      const content = `---
name: Complex Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
  pull_requests: read
claude:
  model: claude-3-5-sonnet-20241022
  max_tokens: 8192
  temperature: 0.5
outputs:
  add-comment: { max: 2 }
  add-label: true
allowed-actors:
  - user1
allowed-paths:
  - path/to/file.txt
trigger_labels:
  - automation
rate_limit_minutes: 10
---

# Complex Instructions
Do complex things.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Complex Agent');
      expect(agent?.permissions?.issues).toBe('write');
      expect(agent?.claude?.model).toBe('claude-3-5-sonnet-20241022');
      expect(agent?.outputs).toBeDefined();
      expect(agent?.allowed_actors).toEqual(['user1']);
      expect(agent?.allowed_paths).toEqual(['path/to/file.txt']);
      expect(agent?.trigger_labels).toEqual(['automation']);
      expect(agent?.rate_limit_minutes).toBe(10);
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing frontmatter', () => {
      const content = `# Just Markdown
No frontmatter here.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should return error for malformed YAML frontmatter', () => {
      const content = `---
name: Test
  invalid: yaml: structure:
---

Content`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'frontmatter')).toBe(true);
    });

    it('should return error for missing name field', () => {
      const content = `---
on:
  issues:
    types: [opened]
---

Content`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.some((e) => e.field.includes('name'))).toBe(true);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should return error for missing trigger', () => {
      const content = `---
name: Test Agent
---

Content`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.some((e) => e.field.includes('on'))).toBe(true);
    });

    it('should return error for empty name', () => {
      const content = `---
name: ""
on:
  issues:
    types: [opened]
---

Content`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.some((e) => e.field.includes('name'))).toBe(true);
    });

    it('should parse agent with inputs configuration', () => {
      const content = `---
name: Batch Agent
on:
  schedule:
    - cron: "0 0 * * *"
inputs:
  issues:
    states: [open]
    labels: [bug]
    limit: 50
  since: "24h"
  min_items: 1
---

Process collected data.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.inputs?.issues?.states).toEqual(['open']);
      expect(agent?.inputs?.issues?.labels).toEqual(['bug']);
      expect(agent?.inputs?.since).toBe('24h');
      expect(agent?.inputs?.min_items).toBe(1);
      expect(errors).toHaveLength(0);
    });

    it('should parse agent with audit configuration', () => {
      const content = `---
name: Audited Agent
on:
  issues:
    types: [opened]
audit:
  create_issues: true
  labels: [automation, audit]
  assignees: [admin]
---

Do work.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.audit?.create_issues).toBe(true);
      expect(agent?.audit?.labels).toEqual(['automation', 'audit']);
      expect(agent?.audit?.assignees).toEqual(['admin']);
      expect(errors).toHaveLength(0);
    });

    it('should handle empty markdown content', () => {
      const content = `---
name: Empty Content Agent
on:
  issues:
    types: [opened]
---
`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.markdown).toBe('');
      // Empty markdown generates a warning
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('warning');
    });
  });

  describe('validateAgent', () => {
    it('should return no errors for valid agent', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);
      expect(errors).toHaveLength(0);
    });

    it('should return error when update-file output is used without allowed-paths', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'update-file': true,
        },
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'outputs')).toBe(true);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should return no error when update-file output has allowed-paths', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'update-file': true,
        },
        allowed_paths: ['src/**/*.ts'],
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      const updateFileErrors = errors.filter((e) => e.field === 'outputs');
      expect(updateFileErrors).toHaveLength(0);
    });

    it('should return error when create-pr output is used without contents write permission', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'create-pr': true,
        },
        permissions: {
          contents: 'read' as const,
        },
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'permissions')).toBe(true);
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });

    it('should return no error when create-pr has contents write permission', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'create-pr': true,
        },
        permissions: {
          contents: 'write' as const,
        },
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      const permissionErrors = errors.filter((e) => e.field === 'permissions');
      expect(permissionErrors).toHaveLength(0);
    });

    it('should return error when update-file is used without contents write permission', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'update-file': true,
        },
        permissions: {
          contents: 'read' as const,
        },
        allowed_paths: ['src/**'],
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'permissions')).toBe(true);
    });

    it('should return error when no triggers are specified', () => {
      const agent = {
        name: 'Test',
        on: {},
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'on')).toBe(true);
      expect(errors.some((e) => e.message.includes('At least one trigger'))).toBe(true);
    });

    it('should allow multiple outputs with proper configuration', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'add-comment': { max: 2 },
          'add-label': true,
          'create-issue': { max: 1 },
        },
        permissions: {
          issues: 'write' as const,
        },
        markdown: 'Instructions',
      };

      const errors = parser.validateAgent(agent);

      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });
  });

  describe('parseFile', () => {
    it('should parse existing test fixture file', async () => {
      const testFile = join(__dirname, '../../tests/fixtures/agents/valid-simple.md');
      const { agent, errors } = await parser.parseFile(testFile);

      expect(agent).toBeDefined();
      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('should return error for non-existent file', async () => {
      const { agent, errors } = await parser.parseFile('/nonexistent/file.md');

      expect(agent).toBeUndefined();
      expect(errors.some((e) => e.severity === 'error')).toBe(true);
    });
  });
});
