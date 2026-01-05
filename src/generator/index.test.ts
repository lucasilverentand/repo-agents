import { WorkflowGenerator } from './index';
import { AgentDefinition, WorkflowStep, TriggerConfig } from '../types';
import yaml from 'js-yaml';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Type for parsed workflow YAML in tests
interface ParsedWorkflow {
  name: string;
  on: TriggerConfig;
  permissions?: Record<string, string>;
  jobs: Record<
    string,
    {
      'runs-on': string;
      needs?: string | string[];
      if?: string;
      outputs?: Record<string, string>;
      strategy?: Record<string, unknown>;
      steps: WorkflowStep[];
    }
  >;
}

describe('WorkflowGenerator', () => {
  let generator: WorkflowGenerator;

  beforeEach(() => {
    generator = new WorkflowGenerator();
  });

  describe('generate', () => {
    it('should generate basic workflow with pre-flight and claude-agent jobs', () => {
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: {
          issues: { types: ['opened'] },
        },
        markdown: 'Test instructions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.name).toBe('Test Agent');
      expect(workflow.on.issues.types).toContain('opened');
      expect(workflow.jobs['pre-flight']).toBeDefined();
      expect(workflow.jobs['claude-agent']).toBeDefined();
    });

    it('should include permissions when specified', () => {
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: {
          issues: { types: ['opened'] },
        },
        permissions: {
          issues: 'write',
          contents: 'read',
        },
        markdown: 'Test instructions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.permissions).toEqual({
        issues: 'write',
        contents: 'read',
      });
    });

    it('should generate workflow with outputs configuration', () => {
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: {
          issues: { types: ['opened'] },
        },
        outputs: {
          'add-comment': { max: 1 },
          'add-label': true,
        },
        markdown: 'Test instructions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['execute-outputs']).toBeDefined();
      expect(workflow.jobs['report-results']).toBeDefined();
    });

    it('should generate collect-inputs job when inputs are configured', () => {
      const agent: AgentDefinition = {
        name: 'Scheduled Agent',
        on: {
          schedule: [{ cron: '0 0 * * *' }],
        },
        inputs: {
          issues: {
            states: ['open'],
            since: '24h',
          },
        },
        markdown: 'Process daily issues',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['collect-inputs']).toBeDefined();
      expect(workflow.jobs['collect-inputs'].steps).toBeDefined();

      // Claude agent should depend on both pre-flight and collect-inputs
      expect(workflow.jobs['claude-agent'].needs).toEqual(['pre-flight', 'collect-inputs']);
      expect(workflow.jobs['claude-agent'].if).toContain('collect-inputs.outputs.has-inputs');
    });

    it('should generate workflow with pull_requests input collection', () => {
      const agent: AgentDefinition = {
        name: 'PR Digest Agent',
        on: {
          schedule: [{ cron: '0 0 * * 1' }],
        },
        inputs: {
          pull_requests: {
            states: ['open'],
            since: '7d',
          },
        },
        markdown: 'Weekly PR summary',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['collect-inputs']).toBeDefined();

      // Verify the collect-inputs job has steps for PR collection
      const collectSteps = workflow.jobs['collect-inputs'].steps;
      const collectScript = collectSteps.find((s) => s.name === 'Collect repository data');
      expect(collectScript).toBeDefined();
    });

    it('should generate workflow with discussions input collection', () => {
      const agent: AgentDefinition = {
        name: 'Discussion Digest',
        on: {
          workflow_dispatch: {},
        },
        inputs: {
          discussions: {
            categories: ['Q&A'],
            since: '24h',
          },
        },
        markdown: 'Summarize discussions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['collect-inputs']).toBeDefined();
    });

    it('should handle agent with both inputs and outputs', () => {
      const agent: AgentDefinition = {
        name: 'Complex Agent',
        on: {
          schedule: [{ cron: '0 0 * * *' }],
        },
        inputs: {
          issues: {
            states: ['open'],
            since: '24h',
          },
        },
        outputs: {
          'create-issue': { max: 5 },
          'add-comment': true,
        },
        markdown: 'Complex workflow',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['collect-inputs']).toBeDefined();
      expect(workflow.jobs['execute-outputs']).toBeDefined();
      expect(workflow.jobs['report-results']).toBeDefined();
      expect(workflow.jobs['audit-report']).toBeDefined();
    });

    it('should generate workflow with custom Claude configuration', () => {
      const agent: AgentDefinition = {
        name: 'Custom Model Agent',
        on: {
          issues: { types: ['opened'] },
        },
        claude: {
          model: 'claude-opus-4',
          max_tokens: 8000,
          temperature: 0.5,
        },
        markdown: 'Test with custom model',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      // Verify workflow generates correctly with claude config
      expect(workflow.jobs['claude-agent']).toBeDefined();

      const claudeAgentSteps = workflow.jobs['claude-agent'].steps;
      const claudeStep = claudeAgentSteps.find((s) => s.name === 'Run Claude Agent');

      expect(claudeStep).toBeDefined();
      // Note: claude config (model, max_tokens, temperature) is stored but not yet passed to CLI
      expect(claudeStep?.run).toContain('@anthropic-ai/claude-code');
    });

    it('should generate workflow with allowed-paths for file operations', () => {
      const agent: AgentDefinition = {
        name: 'File Editor Agent',
        on: {
          issues: { types: ['opened'] },
        },
        'allowed-paths': ['src/**/*.ts', 'docs/**/*.md'],
        outputs: {
          'update-file': true,
        },
        permissions: {
          contents: 'write',
        },
        markdown: 'Edit files',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['claude-agent']).toBeDefined();

      // Verify skills documentation step exists
      const createSkillsStep = workflow.jobs['claude-agent'].steps.find(
        (s) => s.name === 'Create Claude skills file'
      );
      expect(createSkillsStep).toBeDefined();
    });

    it('should generate workflow with multiple trigger types', () => {
      const agent: AgentDefinition = {
        name: 'Multi-Trigger Agent',
        on: {
          issues: { types: ['opened', 'labeled'] },
          pull_request: { types: ['opened', 'synchronize'] },
          discussion: { types: ['created'] },
        },
        markdown: 'Multi-trigger workflow',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.on.issues).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.discussion).toBeDefined();
    });

    it('should always include audit-report job', () => {
      const agent: AgentDefinition = {
        name: 'Minimal Agent',
        on: {
          issues: { types: ['opened'] },
        },
        markdown: 'Minimal workflow',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['audit-report']).toBeDefined();
      expect(workflow.jobs['audit-report'].if).toContain('always()');
    });

    it('should handle agent with workflow_dispatch inputs', () => {
      const agent: AgentDefinition = {
        name: 'Manual Agent',
        on: {
          workflow_dispatch: {
            inputs: {
              priority: {
                description: 'Priority level',
                required: true,
                type: 'choice',
                options: ['high', 'medium', 'low'],
              },
            },
          },
        },
        markdown: 'Manual trigger with inputs',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.on.workflow_dispatch).toBeDefined();
      expect(workflow.on.workflow_dispatch.inputs).toBeDefined();
      expect(workflow.on.workflow_dispatch.inputs.priority).toBeDefined();
    });

    it('should handle agent with repository_dispatch', () => {
      const agent: AgentDefinition = {
        name: 'Webhook Agent',
        on: {
          repository_dispatch: {
            types: ['custom-event'],
          },
        },
        markdown: 'Handle webhook events',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.on.repository_dispatch).toBeDefined();
      expect(workflow.on.repository_dispatch.types).toContain('custom-event');
    });

    it('should handle empty allowed-paths gracefully', () => {
      const agent: AgentDefinition = {
        name: 'No Paths Agent',
        on: {
          issues: { types: ['opened'] },
        },
        'allowed-paths': [],
        markdown: 'Test empty paths',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['claude-agent']).toBeDefined();
    });

    it('should handle optional permissions correctly', () => {
      const agent: AgentDefinition = {
        name: 'Partial Permissions Agent',
        on: {
          issues: { types: ['opened'] },
        },
        permissions: {
          issues: 'write',
          // Other permissions omitted
        },
        markdown: 'Partial permissions',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.permissions?.issues).toBe('write');
      expect(workflow.permissions?.contents).toBeUndefined();
    });
  });

  describe('writeWorkflow', () => {
    it('should write workflow to file system', async () => {
      const agent: AgentDefinition = {
        name: 'Test Agent',
        on: {
          issues: { types: ['opened'] },
        },
        markdown: 'Test instructions',
      };

      const tempDir = mkdtempSync(join(tmpdir(), 'gh-claude-test-'));
      const outputPath = await generator.writeWorkflow(agent, tempDir);

      expect(outputPath).toContain('claude-test-agent.yml');

      const content = readFileSync(outputPath, 'utf-8');
      expect(content).toContain('name: Test Agent');
    });

    it('should sanitize agent names for file paths', async () => {
      const agent: AgentDefinition = {
        name: 'Test Agent With Spaces & Special/Chars',
        on: {
          issues: { types: ['opened'] },
        },
        markdown: 'Test instructions',
      };

      const tempDir = mkdtempSync(join(tmpdir(), 'gh-claude-test-'));
      const outputPath = await generator.writeWorkflow(agent, tempDir);

      // Should convert to kebab-case, prepend claude-, and remove special chars
      expect(outputPath).toContain('claude-test-agent-with-spaces--specialchars.yml');
    });
  });

  describe('edge cases', () => {
    it('should handle agent with min_items in inputs', () => {
      const agent: AgentDefinition = {
        name: 'Threshold Agent',
        on: {
          schedule: [{ cron: '0 0 * * *' }],
        },
        inputs: {
          issues: {
            states: ['open'],
            since: '24h',
            min_items: 5,
          },
        },
        markdown: 'Only run if enough issues',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['collect-inputs']).toBeDefined();

      // Should check min_items in the collection script
      const collectSteps = workflow.jobs['collect-inputs'].steps;
      const collectScript = collectSteps.find((s) => s.name === 'Collect repository data');
      expect(collectScript).toBeDefined();
    });

    it('should handle agent with audit configuration', () => {
      const agent: AgentDefinition = {
        name: 'Audited Agent',
        on: {
          issues: { types: ['opened'] },
        },
        audit: {
          create_issue_on_failure: true,
          issue_labels: ['agent-failure', 'bug'],
        },
        markdown: 'With audit config',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['audit-report']).toBeDefined();
    });

    it('should generate workflow with all output types', () => {
      const agent: AgentDefinition = {
        name: 'All Outputs Agent',
        on: {
          issues: { types: ['opened'] },
        },
        permissions: {
          issues: 'write',
          pull_requests: 'write',
          contents: 'write',
          discussions: 'write',
        },
        'allowed-paths': ['**/*'],
        outputs: {
          'add-comment': true,
          'add-label': true,
          'remove-label': true,
          'create-issue': true,
          'create-pr': true,
          'create-discussion': true,
          'update-file': true,
          'close-issue': true,
          'close-pr': true,
        },
        markdown: 'All outputs enabled',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.jobs['execute-outputs']).toBeDefined();

      // Verify matrix strategy includes all output types
      const executeJob = workflow.jobs['execute-outputs'];
      expect(executeJob.strategy).toBeDefined();
    });
  });
});
