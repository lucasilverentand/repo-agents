import { ClaudeRunner } from './claude-runner';

describe('ClaudeRunner', () => {
  describe('constructor', () => {
    it('should create runner with required config', () => {
      const config = {
        apiKey: 'test-key',
        githubToken: 'test-token',
        context: {
          event_name: 'issues',
          event: {},
          repository: { owner: 'test', name: 'repo' },
        },
        instructions: 'Test instructions',
      };

      const runner = new ClaudeRunner(config);
      expect(runner).toBeDefined();
    });

    it('should accept optional configuration', () => {
      const config = {
        apiKey: 'test-key',
        githubToken: 'test-token',
        context: {
          event_name: 'issues',
          event: {},
          repository: { owner: 'test', name: 'repo' },
        },
        instructions: 'Test',
        model: 'claude-3-opus-20240229',
        maxTokens: 8192,
        temperature: 0.5,
        outputs: { 'add-comment': true },
        allowedPaths: ['/path/to/file'],
      };

      const runner = new ClaudeRunner(config);
      expect(runner).toBeDefined();
    });
  });

  describe('parseOutputs', () => {
    it('should parse ADD_COMMENT output', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: { event_name: 'issues', event: {}, repository: { owner: 'test', name: 'repo' } },
        instructions: 'test',
      });

      const response = `
ADD_COMMENT:
\`\`\`json
{
  "body": "Test comment"
}
\`\`\`
      `;

      const outputs = (runner as any).parseOutputs(response);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('add-comment');
      expect(outputs[0].data.body).toBe('Test comment');
    });

    it('should parse ADD_LABEL output', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: { event_name: 'issues', event: {}, repository: { owner: 'test', name: 'repo' } },
        instructions: 'test',
      });

      const response = `
ADD_LABEL:
\`\`\`json
{
  "labels": ["bug", "priority: high"]
}
\`\`\`
      `;

      const outputs = (runner as any).parseOutputs(response);
      expect(outputs).toHaveLength(1);
      expect(outputs[0].type).toBe('add-label');
      expect(outputs[0].data.labels).toContain('bug');
    });

    it('should parse multiple outputs', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: { event_name: 'issues', event: {}, repository: { owner: 'test', name: 'repo' } },
        instructions: 'test',
      });

      const response = `
ADD_LABEL:
\`\`\`json
{
  "labels": ["bug"]
}
\`\`\`

ADD_COMMENT:
\`\`\`json
{
  "body": "Thanks for reporting!"
}
\`\`\`
      `;

      const outputs = (runner as any).parseOutputs(response);
      expect(outputs).toHaveLength(2);
      expect(outputs[0].type).toBe('add-label');
      expect(outputs[1].type).toBe('add-comment');
    });

    it('should handle malformed JSON gracefully', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: { event_name: 'issues', event: {}, repository: { owner: 'test', name: 'repo' } },
        instructions: 'test',
      });

      const response = `
ADD_COMMENT:
\`\`\`json
{
  invalid json
}
\`\`\`
      `;

      const outputs = (runner as any).parseOutputs(response);
      expect(outputs).toHaveLength(0);
    });

    it('should return empty array for no outputs', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: { event_name: 'issues', event: {}, repository: { owner: 'test', name: 'repo' } },
        instructions: 'test',
      });

      const response = 'Just some text without structured outputs.';

      const outputs = (runner as any).parseOutputs(response);
      expect(outputs).toHaveLength(0);
    });
  });

  describe('buildContextString', () => {
    it('should build context for issue event', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: {
          event_name: 'issues',
          event: {},
          repository: { owner: 'testorg', name: 'testrepo' },
          issue: {
            number: 42,
            title: 'Test Issue',
            body: 'Issue body',
            user: { login: 'testuser' },
          },
        },
        instructions: 'test',
      });

      const context = (runner as any).buildContextString();

      expect(context).toContain('Event: issues');
      expect(context).toContain('Repository: testorg/testrepo');
      expect(context).toContain('Number: #42');
      expect(context).toContain('Title: Test Issue');
      expect(context).toContain('Author: @testuser');
      expect(context).toContain('Issue body');
    });

    it('should build context for PR event', () => {
      const runner = new ClaudeRunner({
        apiKey: 'test',
        githubToken: 'test',
        context: {
          event_name: 'pull_request',
          event: {},
          repository: { owner: 'testorg', name: 'testrepo' },
          pull_request: {
            number: 123,
            title: 'Test PR',
            body: 'PR body',
            user: { login: 'contributor' },
          },
        },
        instructions: 'test',
      });

      const context = (runner as any).buildContextString();

      expect(context).toContain('Event: pull_request');
      expect(context).toContain('Pull Request Information');
      expect(context).toContain('Number: #123');
      expect(context).toContain('Title: Test PR');
    });
  });
});
