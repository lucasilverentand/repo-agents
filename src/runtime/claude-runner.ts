import Anthropic from '@anthropic-ai/sdk';
import { Octokit } from '@octokit/rest';
import { OutputConfig } from '../types';

interface GitHubContext {
  event_name: string;
  event: any;
  repository: {
    owner: string;
    name: string;
  };
  issue?: {
    number: number;
    title: string;
    body: string;
    user: {
      login: string;
    };
  };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    user: {
      login: string;
    };
  };
}

interface ClaudeRunnerConfig {
  apiKey: string;
  githubToken: string;
  context: GitHubContext;
  instructions: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  outputs?: Record<string, OutputConfig | boolean>;
  allowedPaths?: string[];
}

export class ClaudeRunner {
  private anthropic: Anthropic;
  private octokit: Octokit;
  private config: ClaudeRunnerConfig;

  constructor(config: ClaudeRunnerConfig) {
    this.config = config;
    this.anthropic = new Anthropic({ apiKey: config.apiKey });
    this.octokit = new Octokit({ auth: config.githubToken });
  }

  async run(): Promise<void> {
    console.log('=== Claude Agent Starting ===');
    console.log('Event:', this.config.context.event_name);
    console.log('Repository:', `${this.config.context.repository.owner}/${this.config.context.repository.name}`);
    console.log('');

    const contextString = this.buildContextString();

    console.log('Calling Claude API...');
    const message = await this.anthropic.messages.create({
      model: this.config.model || 'claude-3-5-sonnet-20241022',
      max_tokens: this.config.maxTokens || 4096,
      temperature: this.config.temperature || 0.7,
      messages: [
        {
          role: 'user',
          content: `${contextString}\n\n${this.config.instructions}`,
        },
      ],
    });

    console.log('Claude response received');
    console.log('');

    const textContent = message.content
      .filter((block) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n');

    console.log('=== Claude Response ===');
    console.log(textContent);
    console.log('');

    await this.processOutputs(textContent);
  }

  private buildContextString(): string {
    const parts: string[] = ['# GitHub Context'];

    parts.push(`Event: ${this.config.context.event_name}`);
    parts.push(`Repository: ${this.config.context.repository.owner}/${this.config.context.repository.name}`);

    if (this.config.context.issue) {
      parts.push('\n## Issue Information');
      parts.push(`Number: #${this.config.context.issue.number}`);
      parts.push(`Title: ${this.config.context.issue.title}`);
      parts.push(`Author: @${this.config.context.issue.user.login}`);
      parts.push(`\nBody:\n${this.config.context.issue.body}`);
    }

    if (this.config.context.pull_request) {
      parts.push('\n## Pull Request Information');
      parts.push(`Number: #${this.config.context.pull_request.number}`);
      parts.push(`Title: ${this.config.context.pull_request.title}`);
      parts.push(`Author: @${this.config.context.pull_request.user.login}`);
      parts.push(`\nBody:\n${this.config.context.pull_request.body}`);
    }

    return parts.join('\n');
  }

  private async processOutputs(claudeResponse: string): Promise<void> {
    console.log('=== Processing Outputs ===');

    const outputs = this.parseOutputs(claudeResponse);

    if (outputs.length === 0) {
      console.log('No structured outputs found in Claude response');
      return;
    }

    for (const output of outputs) {
      await this.executeOutput(output);
    }
  }

  private parseOutputs(response: string): Array<{ type: string; data: any }> {
    const outputs: Array<{ type: string; data: any }> = [];

    const addCommentRegex = /ADD_COMMENT:\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
    const addLabelRegex = /ADD_LABEL:\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
    const createIssueRegex = /CREATE_ISSUE:\s*```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;

    let match;

    while ((match = addCommentRegex.exec(response)) !== null) {
      try {
        outputs.push({ type: 'add-comment', data: JSON.parse(match[1]) });
      } catch (error) {
        console.error('Failed to parse ADD_COMMENT:', error);
      }
    }

    while ((match = addLabelRegex.exec(response)) !== null) {
      try {
        outputs.push({ type: 'add-label', data: JSON.parse(match[1]) });
      } catch (error) {
        console.error('Failed to parse ADD_LABEL:', error);
      }
    }

    while ((match = createIssueRegex.exec(response)) !== null) {
      try {
        outputs.push({ type: 'create-issue', data: JSON.parse(match[1]) });
      } catch (error) {
        console.error('Failed to parse CREATE_ISSUE:', error);
      }
    }

    return outputs;
  }

  private async executeOutput(output: { type: string; data: any }): Promise<void> {
    if (!this.config.outputs || !(output.type in this.config.outputs)) {
      console.warn(`Output type '${output.type}' is not in allowed outputs, skipping`);
      return;
    }

    const outputConfig = this.config.outputs[output.type];
    if (outputConfig === false) {
      console.warn(`Output type '${output.type}' is disabled, skipping`);
      return;
    }

    const { owner, name } = this.config.context.repository;

    try {
      switch (output.type) {
        case 'add-comment':
          await this.addComment(owner, name, output.data);
          break;
        case 'add-label':
          await this.addLabel(owner, name, output.data);
          break;
        case 'create-issue':
          await this.createIssue(owner, name, output.data);
          break;
        default:
          console.warn(`Unknown output type: ${output.type}`);
      }
    } catch (error) {
      console.error(`Failed to execute ${output.type}:`, error);
    }
  }

  private async addComment(owner: string, repo: string, data: any): Promise<void> {
    const issueNumber = this.config.context.issue?.number || this.config.context.pull_request?.number;

    if (!issueNumber) {
      console.error('No issue or PR number found in context');
      return;
    }

    console.log(`Adding comment to #${issueNumber}...`);

    await this.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: data.body || data.comment || data.text,
    });

    console.log('✓ Comment added');
  }

  private async addLabel(owner: string, repo: string, data: any): Promise<void> {
    const issueNumber = this.config.context.issue?.number || this.config.context.pull_request?.number;

    if (!issueNumber) {
      console.error('No issue or PR number found in context');
      return;
    }

    const labels = Array.isArray(data.labels) ? data.labels : [data.label || data.labels];

    console.log(`Adding labels to #${issueNumber}: ${labels.join(', ')}`);

    await this.octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });

    console.log('✓ Labels added');
  }

  private async createIssue(owner: string, repo: string, data: any): Promise<void> {
    console.log(`Creating issue: ${data.title}`);

    const result = await this.octokit.issues.create({
      owner,
      repo,
      title: data.title,
      body: data.body,
      labels: data.labels || [],
    });

    console.log(`✓ Issue created: #${result.data.number}`);
  }
}
