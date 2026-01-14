import type { AgentDefinition, AgentProvider, WorkflowStep } from '../types';

export interface ProviderContext {
  allowedTools: string;
  hasOutputs: boolean;
  environment: Record<string, string>;
}

export interface AgentProviderAdapter {
  id: AgentProvider;
  generateInstallSteps(): WorkflowStep[];
  generateRunStep(agent: AgentDefinition, context: ProviderContext): WorkflowStep;
}

export class ClaudeCodeProvider implements AgentProviderAdapter {
  readonly id: AgentProvider = 'claude-code';

  generateInstallSteps(): WorkflowStep[] {
    return [
      {
        name: 'Install Claude Code CLI',
        run: 'bunx --bun @anthropic-ai/claude-code --version',
      },
    ];
  }

  generateRunStep(_agent: AgentDefinition, context: ProviderContext): WorkflowStep {
    const claudeCommand = context.hasOutputs
      ? `bunx --bun @anthropic-ai/claude-code -p "$(cat /tmp/context.txt)" --allowedTools "${context.allowedTools}" --permission-mode bypassPermissions --output-format json > /tmp/claude-output.json`
      : `bunx --bun @anthropic-ai/claude-code -p "$(cat /tmp/context.txt)" --allowedTools "${context.allowedTools}" --output-format json > /tmp/claude-output.json`;

    return {
      name: 'Run Claude Agent',
      id: 'run-claude',
      env: context.environment,
      run: claudeCommand,
    };
  }
}

export class OpenCodeProvider implements AgentProviderAdapter {
  readonly id: AgentProvider = 'opencode';

  generateInstallSteps(): WorkflowStep[] {
    return [
      {
        name: 'Install OpenCode CLI',
        run: 'bunx --bun opencode --version',
      },
    ];
  }

  generateRunStep(_agent: AgentDefinition, context: ProviderContext): WorkflowStep {
    const permissionFlag = context.hasOutputs ? ' --permission-mode bypassPermissions' : '';

    const command =
      `bunx --bun opencode -p "$(cat /tmp/context.txt)" --allowedTools "${context.allowedTools}"` +
      `${permissionFlag} --output-format json > /tmp/claude-output.json`;

    return {
      name: 'Run Agent (OpenCode)',
      id: 'run-claude',
      env: context.environment,
      run: command,
    };
  }
}

export function getProviderAdapter(provider?: AgentProvider): AgentProviderAdapter {
  if (provider === 'opencode') return new OpenCodeProvider();
  return new ClaudeCodeProvider();
}
