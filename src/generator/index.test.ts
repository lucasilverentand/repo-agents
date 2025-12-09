import { WorkflowGenerator } from './index';
import { AgentDefinition } from '../types';
import yaml from 'js-yaml';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('WorkflowGenerator', () => {
  let generator: WorkflowGenerator;

  beforeEach(() => {
    generator = new WorkflowGenerator();
  });

  describe('generate', () => {
    it('should generate basic workflow', () => {
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: {
          issues: { types: ['opened'] },
        },
        markdown: 'Test instructions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;

      expect(workflow.name).toBe('Test Agent');
      expect(workflow.on.issues.types).toContain('opened');
      expect(workflow.jobs['claude-agent']).toBeDefined();
    });

    it('should include permissions when specified', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        permissions: { issues: 'write', contents: 'read' },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;

      expect(workflow.permissions.issues).toBe('write');
      expect(workflow.permissions.contents).toBe('read');
    });

    it('should not include permissions when not specified', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;

      expect(workflow.permissions).toBeUndefined();
    });

    it('should configure checkout and node setup steps', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const steps = workflow.jobs['claude-agent'].steps;

      expect(steps[0].uses).toBe('actions/checkout@v4');
      expect(steps[1].uses).toBe('actions/setup-node@v4');
      expect(steps[1].with['node-version']).toBe('20');
    });

    it('should include agent instructions in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: '# Test Instructions\n\nDo something.',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      expect(env.AGENT_INSTRUCTIONS).toContain('Test Instructions');
      expect(env.AGENT_INSTRUCTIONS).toContain('Do something');
    });

    it('should include Claude configuration in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        claude: {
          model: 'claude-3-opus-20240229',
          maxTokens: 8192,
          temperature: 0.3,
        },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      expect(env.CLAUDE_MODEL).toBe('claude-3-opus-20240229');
      expect(env.CLAUDE_MAX_TOKENS).toBe('8192');
      expect(env.CLAUDE_TEMPERATURE).toBe('0.3');
    });

    it('should use default Claude configuration', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      expect(env.CLAUDE_MODEL).toBe('claude-3-5-sonnet-20241022');
      expect(env.CLAUDE_MAX_TOKENS).toBe('4096');
      expect(env.CLAUDE_TEMPERATURE).toBe('0.7');
    });

    it('should include safe outputs in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: { 'add-comment': true, 'add-label': true },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      const outputs = JSON.parse(env.OUTPUTS);
      expect(outputs).toEqual({ 'add-comment': true, 'add-label': true });
    });

    it('should include allowed paths in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        allowedPaths: ['file1.txt', 'dir/file2.md'],
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      expect(env.ALLOWED_PATHS).toBe('file1.txt,dir/file2.md');
    });

    it('should handle multiple trigger types', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: {
          issues: { types: ['opened'] },
          pull_request: { types: ['opened', 'synchronize'] },
          schedule: [{ cron: '0 9 * * *' }],
        },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;

      expect(workflow.on.issues).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.schedule).toBeDefined();
      expect(workflow.on.schedule[0].cron).toBe('0 9 * * *');
    });

    it('should include GitHub secrets in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as any;
      const env = workflow.jobs['claude-agent'].steps[2].env;

      expect(env.ANTHROPIC_API_KEY).toContain('secrets.ANTHROPIC_API_KEY');
      expect(env.GITHUB_TOKEN).toContain('secrets.GITHUB_TOKEN');
      expect(env.GITHUB_CONTEXT).toContain('toJson(github)');
    });
  });

  describe('writeWorkflow', () => {
    it('should write workflow to file', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'gh-claude-test-'));
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const outputPath = await generator.writeWorkflow(agent, tempDir);

      expect(outputPath).toContain('claude-test-agent.yml');
      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('name: Test Agent');
    });

    it('should use kebab-case for filename', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'gh-claude-test-'));
      const agent: AgentDefinition = {
        name: 'My Complex Agent Name',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const outputPath = await generator.writeWorkflow(agent, tempDir);

      expect(outputPath).toContain('claude-my-complex-agent-name.yml');
    });
  });
});
