import { writeFile } from 'fs/promises';
import yaml from 'js-yaml';
import { AgentDefinition } from '../types';
import { agentNameToWorkflowName } from '../cli/utils/files';

export class WorkflowGenerator {
  generate(agent: AgentDefinition): string {
    const workflow: any = {
      name: agent.name,
      on: this.generateTriggers(agent),
    };

    if (agent.permissions) {
      workflow.permissions = agent.permissions;
    }

    workflow.jobs = {
      'claude-agent': {
        'runs-on': 'ubuntu-latest',
        steps: [
          {
            name: 'Checkout repository',
            uses: 'actions/checkout@v4',
          },
          {
            name: 'Setup Node.js',
            uses: 'actions/setup-node@v4',
            with: {
              'node-version': '20',
            },
          },
          {
            name: 'Run Claude Agent',
            run: this.generateClaudeStep(agent),
            env: this.generateEnvironment(agent),
          },
        ],
      },
    };

    return yaml.dump(workflow, {
      lineWidth: -1,
      noRefs: true,
    });
  }

  private generateTriggers(agent: AgentDefinition): any {
    const triggers: any = {};

    if (agent.on.issues) {
      triggers.issues = agent.on.issues;
    }

    if (agent.on.pull_request) {
      triggers.pull_request = agent.on.pull_request;
    }

    if (agent.on.discussion) {
      triggers.discussion = agent.on.discussion;
    }

    if (agent.on.schedule) {
      triggers.schedule = agent.on.schedule;
    }

    if (agent.on.workflow_dispatch) {
      triggers.workflow_dispatch = agent.on.workflow_dispatch;
    }

    if (agent.on.repository_dispatch) {
      triggers.repository_dispatch = agent.on.repository_dispatch;
    }

    return triggers;
  }

  private generateClaudeStep(_agent: AgentDefinition): string {
    return `npx --yes gh-claude-runtime`;
  }

  private generateEnvironment(agent: AgentDefinition): Record<string, string> {
    const env: Record<string, string> = {
      ANTHROPIC_API_KEY: '${{ secrets.ANTHROPIC_API_KEY }}',
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      GITHUB_CONTEXT: '${{ toJson(github) }}',
      AGENT_INSTRUCTIONS: agent.markdown,
      CLAUDE_MODEL: agent.claude?.model || 'claude-3-5-sonnet-20241022',
      CLAUDE_MAX_TOKENS: String(agent.claude?.maxTokens || 4096),
      CLAUDE_TEMPERATURE: String(agent.claude?.temperature || 0.7),
      OUTPUTS: agent.outputs ? JSON.stringify(agent.outputs) : '',
      ALLOWED_PATHS: agent.allowedPaths?.join(',') || '',
    };

    return env;
  }

  async writeWorkflow(agent: AgentDefinition, outputDir: string): Promise<string> {
    const workflowName = agentNameToWorkflowName(agent.name);
    const fileName = `${workflowName}.yml`;
    const filePath = `${outputDir}/${fileName}`;

    const content = this.generate(agent);
    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }
}

export const workflowGenerator = new WorkflowGenerator();
