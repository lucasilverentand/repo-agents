import { readFile } from 'fs/promises';
import matter from 'gray-matter';
import { agentFrontmatterSchema, AgentFrontmatter } from './schemas';
import { AgentDefinition, ValidationError } from '../types';
import { ZodError } from 'zod';

export class AgentParser {
  async parseFile(filePath: string): Promise<{
    agent?: AgentDefinition;
    errors: ValidationError[];
  }> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      return {
        errors: [
          {
            field: 'file',
            message: `Failed to read file: ${(error as Error).message}`,
            severity: 'error',
          },
        ],
      };
    }
  }

  parseContent(content: string): {
    agent?: AgentDefinition;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    let parsed;
    try {
      parsed = matter(content);
    } catch (error) {
      return {
        errors: [
          {
            field: 'frontmatter',
            message: `Failed to parse frontmatter: ${(error as Error).message}`,
            severity: 'error',
          },
        ],
      };
    }

    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      return {
        errors: [
          {
            field: 'frontmatter',
            message: 'Frontmatter is required',
            severity: 'error',
          },
        ],
      };
    }

    let frontmatter: AgentFrontmatter;
    try {
      frontmatter = agentFrontmatterSchema.parse(parsed.data);
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          errors: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
            severity: 'error' as const,
          })),
        };
      }
      throw error;
    }

    if (!parsed.content || parsed.content.trim().length === 0) {
      errors.push({
        field: 'markdown',
        message: 'Agent instructions (markdown body) are required',
        severity: 'warning',
      });
    }

    const agent: AgentDefinition = {
      name: frontmatter.name,
      on: frontmatter.on,
      permissions: frontmatter.permissions,
      provider: frontmatter.provider,
      claude: frontmatter.claude,
      outputs: frontmatter.outputs,
      tools: frontmatter.tools,
      allowed_actors: frontmatter['allowed-actors'],
      allowed_users: frontmatter['allowed-users'],
      allowed_teams: frontmatter['allowed-teams'],
      allowed_paths: frontmatter['allowed-paths'],
      trigger_labels: frontmatter.trigger_labels,
      rate_limit_minutes: frontmatter.rate_limit_minutes,
      inputs: frontmatter.inputs,
      audit: frontmatter.audit,
      markdown: parsed.content.trim(),
    };

    return { agent, errors };
  }

  validateAgent(agent: AgentDefinition): ValidationError[] {
    const errors: ValidationError[] = [];
    const outputTypes = agent.outputs ? Object.keys(agent.outputs) : [];

    if (
      outputTypes.includes('update-file') &&
      (!agent.allowed_paths || agent.allowed_paths.length === 0)
    ) {
      errors.push({
        field: 'outputs',
        message: 'update-file requires allowed-paths to be specified',
        severity: 'error',
      });
    }

    const outputsRequiringContentsWrite = ['create-pr', 'update-file'];
    for (const outputType of outputsRequiringContentsWrite) {
      if (outputTypes.includes(outputType) && agent.permissions?.contents !== 'write') {
        errors.push({
          field: 'permissions',
          message: `${outputType} requires contents: write permission`,
          severity: 'error',
        });
      }
    }

    const hasTrigger =
      agent.on.issues ||
      agent.on.pull_request ||
      agent.on.discussion ||
      agent.on.repository_dispatch ||
      agent.on.schedule ||
      agent.on.workflow_dispatch;

    if (!hasTrigger) {
      errors.push({
        field: 'on',
        message: 'At least one trigger must be specified',
        severity: 'error',
      });
    }

    return errors;
  }
}

export const agentParser = new AgentParser();
