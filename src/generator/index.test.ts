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
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        permissions: { issues: 'write', contents: 'read' },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.permissions?.issues).toBe('write');
      expect(workflow.permissions.contents).toBe('read');
    });

    it('should not include permissions when not specified', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.permissions).toBeUndefined();
    });

    it('should configure checkout and bun setup steps in claude-agent job', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;

      expect(steps[0].uses).toBe('actions/checkout@v4');
      // steps[1] is the token generation step
      expect(steps[1].id).toBe('app-token');
      expect(steps[2].uses).toBe('oven-sh/setup-bun@v2');
      expect(steps[2].with['bun-version']).toBe('latest');
    });

    it('should include agent instructions in the run script', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: '# Test Instructions\n\nDo something.',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      // Find the "Add agent instructions" step
      const steps = workflow.jobs['claude-agent'].steps;
      const instructionsStep = steps.find(
        (step: WorkflowStep) => step.name === 'Add agent instructions'
      );

      expect(instructionsStep).toBeDefined();
      expect(instructionsStep?.run).toContain('Test Instructions');
      expect(instructionsStep?.run).toContain('Do something');
    });

    it('should include Claude Code CLI installation', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;
      const runStep = steps.find((step: WorkflowStep) => step.name === 'Run Claude Agent');

      expect(runStep).toBeDefined();
      expect(runStep?.run).toContain('bunx --bun @anthropic-ai/claude-code');
      expect(runStep?.run).toContain('-p');
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
      const workflow = yaml.load(result) as ParsedWorkflow;

      expect(workflow.on.issues).toBeDefined();
      expect(workflow.on.pull_request).toBeDefined();
      expect(workflow.on.schedule).toBeDefined();
      expect(workflow.on.schedule?.[0].cron).toBe('0 9 * * *');
    });

    it('should include GitHub secrets in environment', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;
      const runStep = steps.find((step: WorkflowStep) => step.name === 'Run Claude Agent');

      expect(runStep).toBeDefined();
      expect(runStep?.env?.ANTHROPIC_API_KEY).toContain('secrets.ANTHROPIC_API_KEY');
      // GITHUB_TOKEN now comes from the app-token step (which falls back to secrets.GITHUB_TOKEN)
      expect(runStep?.env?.GITHUB_TOKEN).toContain('steps.app-token.outputs.token');
    });

    it('should include issue context variables in run script', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;
      // Find the "Add issue context" step
      const issueStep = steps.find((step: WorkflowStep) => step.name === 'Add issue context');

      expect(issueStep).toBeDefined();
      expect(issueStep?.run).toContain('github.event.issue.number');
      expect(issueStep?.run).toContain('github.event.issue.title');
    });

    it('should include PR context variables in run script', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { pull_request: { types: ['opened'] } },
        markdown: 'Test',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;
      // Find the "Add PR context" step
      const prStep = steps.find((step: WorkflowStep) => step.name === 'Add PR context');

      expect(prStep).toBeDefined();
      expect(prStep?.run).toContain('github.event.pull_request.number');
      expect(prStep?.run).toContain('github.event.pull_request.title');
    });

    it('should escape special characters in markdown', () => {
      const agent: AgentDefinition = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        markdown: 'Use `code` and $variable',
      };

      const result = generator.generate(agent);
      const workflow = yaml.load(result) as ParsedWorkflow;
      const steps = workflow.jobs['claude-agent'].steps;
      const instructionsStep = steps.find(
        (step: WorkflowStep) => step.name === 'Add agent instructions'
      );

      expect(instructionsStep).toBeDefined();
      expect(instructionsStep?.run).toContain('\\`code\\`');
      expect(instructionsStep?.run).toContain('\\$variable');
    });

    describe('pre-flight job', () => {
      it('should have pre-flight job that runs before claude-agent', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;

        expect(workflow.jobs['pre-flight']).toBeDefined();
        expect(workflow.jobs['claude-agent'].needs).toBe('pre-flight');
        expect(workflow.jobs['claude-agent'].if).toContain('should-run');
      });

      it('should include secret validation in pre-flight job', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const secretsStep = steps.find((step: WorkflowStep) => step.name === 'Check secrets');

        expect(secretsStep).toBeDefined();
        expect(secretsStep?.run).toContain('ANTHROPIC_API_KEY');
        expect(secretsStep?.run).toContain('CLAUDE_CODE_OAUTH_TOKEN');
        expect(secretsStep?.run).toContain('No Claude authentication found');
      });

      it('should include user authorization check in pre-flight job', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const userStep = steps.find(
          (step: WorkflowStep) => step.name === 'Check user authorization'
        );

        expect(userStep).toBeDefined();
        expect(userStep?.run).toContain('github.actor');
        expect(userStep?.run).toContain('collaborators');
      });

      it('should include rate limiting check in pre-flight job', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const rateLimitStep = steps.find((step: WorkflowStep) => step.name === 'Check rate limit');

        expect(rateLimitStep).toBeDefined();
        expect(rateLimitStep?.run).toContain('Rate limit check passed');
        expect(rateLimitStep?.run).toContain('RATE_LIMIT_MINUTES');
      });

      it('should use custom rate limit when specified', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          rate_limit_minutes: 10,
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const rateLimitStep = steps.find((step: WorkflowStep) => step.name === 'Check rate limit');

        expect(rateLimitStep).toBeDefined();
        expect(rateLimitStep?.run).toContain('RATE_LIMIT_MINUTES=10');
      });

      it('should include allowed users when specified', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          allowed_users: ['user1', 'user2'],
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const userStep = steps.find(
          (step: WorkflowStep) => step.name === 'Check user authorization'
        );

        expect(userStep).toBeDefined();
        expect(userStep?.run).toContain('user1 user2');
      });

      it('should include trigger labels when specified', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          trigger_labels: ['claude', 'ai-help'],
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['pre-flight'].steps;
        const labelStep = steps.find((step: WorkflowStep) => step.name === 'Check required labels');

        expect(labelStep).toBeDefined();
        expect(labelStep?.run).toContain('claude ai-help');
        expect(labelStep?.run).toContain('Required label not found');
      });

      it('should output should-run from pre-flight job', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;

        expect(workflow.jobs['pre-flight'].outputs?.['should-run']).toContain(
          'steps.set-output.outputs.should-run'
        );
      });
    });

    describe('outputs and skills section', () => {
      it('should not include skills file when no outputs configured', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;
        const skillsStep = steps.find(
          (step: WorkflowStep) => step.name === 'Create Claude skills file'
        );

        expect(skillsStep).toBeUndefined();
      });

      it('should include skills file when outputs are configured', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'add-comment': true,
          },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;
        const skillsStep = steps.find(
          (step: WorkflowStep) => step.name === 'Create Claude skills file'
        );

        expect(skillsStep).toBeDefined();
        expect(skillsStep?.run).toContain('CLAUDE.md');
        expect(skillsStep?.run).toContain('add-comment');
      });

      it('should include outputs directory creation step when outputs configured', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'add-comment': { max: 1 },
          },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;
        const outputsStep = steps.find(
          (step: WorkflowStep) => step.name === 'Create outputs directory'
        );

        expect(outputsStep).toBeDefined();
        expect(outputsStep?.run).toContain('/tmp/outputs');
      });

      it('should generate execute-outputs job when outputs configured', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'create-pr': { sign: true },
          },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;

        expect(workflow.jobs['execute-outputs']).toBeDefined();
        expect(workflow.jobs['report-results']).toBeDefined();
      });

      it('should include allowedTools in claude run command for outputs', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'update-file': { sign: true },
          },
          allowed_paths: ['src/**/*.ts', '*.md'],
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;
        const runStep = steps.find((step: WorkflowStep) => step.name === 'Run Claude Agent');

        expect(runStep).toBeDefined();
        expect(runStep?.run).toContain('allowedTools');
        expect(runStep?.run).toContain('/tmp/outputs');
      });

      it('should use bypass permissions mode when outputs configured', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'add-comment': { max: 1 },
            'add-label': true,
            'create-issue': true,
          },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;
        const runStep = steps.find((step: WorkflowStep) => step.name === 'Run Claude Agent');

        expect(runStep).toBeDefined();
        expect(runStep?.run).toContain('bypassPermissions');
      });

      it('should place skills file creation before agent instructions', () => {
        const agent: AgentDefinition = {
          name: 'Test',
          on: { issues: { types: ['opened'] } },
          outputs: {
            'add-comment': true,
          },
          markdown: 'Test',
        };

        const result = generator.generate(agent);
        const workflow = yaml.load(result) as ParsedWorkflow;
        const steps = workflow.jobs['claude-agent'].steps;

        const skillsStepIndex = steps.findIndex(
          (step: WorkflowStep) => step.name === 'Create Claude skills file'
        );
        const instructionsStepIndex = steps.findIndex(
          (step: WorkflowStep) => step.name === 'Add agent instructions'
        );

        expect(skillsStepIndex).toBeGreaterThan(-1);
        expect(instructionsStepIndex).toBeGreaterThan(-1);
        expect(skillsStepIndex).toBeLessThan(instructionsStepIndex);
      });
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
