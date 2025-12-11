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
---

# Instructions
Complex agent.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Complex Agent');
      expect(agent?.permissions?.issues).toBe('write');
      expect(agent?.claude?.model).toBe('claude-3-5-sonnet-20241022');
      expect(agent?.outputs).toHaveProperty('add-comment');
      expect(agent?.allowed_actors).toContain('user1');
      expect(errors).toHaveLength(0);
    });

    it('should handle multiple trigger types', () => {
      const content = `---
name: Multi Trigger
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened, synchronize]
  schedule:
    - cron: '0 9 * * *'
---

Multi trigger agent.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(agent?.on.issues).toBeDefined();
      expect(agent?.on.pull_request).toBeDefined();
      expect(agent?.on.schedule).toBeDefined();
      expect(errors).toHaveLength(0);
    });

    it('should fail without frontmatter', () => {
      const content = 'Just markdown with no frontmatter';

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].severity).toBe('error');
    });

    it('should fail with missing name', () => {
      const content = `---
on:
  issues:
    types: [opened]
---

Missing name.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field.includes('name'))).toBe(true);
    });

    it('should fail with missing trigger', () => {
      const content = `---
name: No Trigger
---

Missing trigger.`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should warn about empty markdown body', () => {
      const content = `---
name: Empty Body
on:
  issues:
    types: [opened]
---

`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeDefined();
      expect(errors.some((e) => e.severity === 'warning')).toBe(true);
    });

    it('should handle invalid YAML in frontmatter', () => {
      const content = `---
name: Test
on:
  invalid yaml: [unclosed
---

Body`;

      const { agent, errors } = parser.parseContent(content, 'test.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateAgent', () => {
    it('should validate correct agent', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors).toHaveLength(0);
    });

    it('should require allowed-paths for update-file', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: { 'update-file': true },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('outputs');
    });

    it('should require contents write for create-pr', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: { 'create-pr': true },
        permissions: { issues: 'write' as const },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('contents'))).toBe(true);
    });

    it('should require contents write for update-file', () => {
      const agent = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: { 'update-file': true },
        allowed_paths: ['file.txt'],
        permissions: { issues: 'write' as const },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('contents'))).toBe(true);
    });

    it('should require at least one trigger', () => {
      const agent = {
        name: 'Test',
        on: {},
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('on');
    });

    it('should accept workflow_dispatch as valid trigger', () => {
      const agent = {
        name: 'Test',
        on: { workflow_dispatch: {} },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors).toHaveLength(0);
    });

    it('should accept schedule as valid trigger', () => {
      const agent = {
        name: 'Test',
        on: { schedule: [{ cron: '0 9 * * *' }] },
        markdown: 'Test',
      };

      const errors = parser.validateAgent(agent);
      expect(errors).toHaveLength(0);
    });
  });

  describe('parseFile', () => {
    it('should parse valid file', async () => {
      const filePath = join(__dirname, '../../tests/fixtures/agents/valid-simple.md');
      const { agent, errors } = await parser.parseFile(filePath);

      expect(agent).toBeDefined();
      expect(agent?.name).toBe('Simple Agent');
      expect(errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('should handle non-existent file', async () => {
      const { agent, errors } = await parser.parseFile('non-existent.md');

      expect(agent).toBeUndefined();
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe('file');
    });
  });
});
