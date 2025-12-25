import { describe, it, expect, beforeAll } from 'bun:test';
import { workflowValidator } from './workflow-validator';

// Mock fetch to avoid network dependency
const mockSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['on', 'jobs'],
  properties: {
    name: { type: 'string' },
    on: {
      oneOf: [
        { type: 'string', enum: ['push', 'pull_request', 'workflow_dispatch'] },
        {
          type: 'object',
          properties: {
            push: { type: 'object' },
            pull_request: { type: 'object' },
            schedule: { type: 'array' },
            workflow_dispatch: { type: 'object' },
          },
          additionalProperties: false,
        },
      ],
    },
    permissions: { type: 'object' },
    jobs: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['runs-on', 'steps'],
        properties: {
          'runs-on': { type: 'string' },
          needs: {},
          if: { type: 'string' },
          outputs: { type: 'object' },
          env: { type: 'object' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                id: { type: 'string' },
                uses: { type: 'string' },
                run: { type: 'string' },
                env: { type: 'object' },
                with: { type: 'object' },
              },
            },
          },
        },
      },
    },
  },
};

describe('WorkflowValidator', () => {
  beforeAll(() => {
    // Mock global fetch
    globalThis.fetch = (() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSchema),
      } as Response)) as typeof fetch;
  });
  describe('validateWorkflow', () => {
    it('should validate a valid workflow', async () => {
      const validWorkflow = `
name: Test Workflow
on:
  push:
    branches:
      - main
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: npm test
`;

      const errors = await workflowValidator.validateWorkflow(validWorkflow);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid YAML', async () => {
      const invalidYaml = `
name: Test Workflow
on:
  push:
    branches: [
      - main
`;

      const errors = await workflowValidator.validateWorkflow(invalidYaml);
      expect(errors).toHaveLength(1);
      expect(errors[0].path).toBe('yaml');
      expect(errors[0].message).toContain('Invalid YAML');
    });

    it('should detect missing required fields', async () => {
      const missingJobs = `
name: Test Workflow
on:
  push:
`;

      const errors = await workflowValidator.validateWorkflow(missingJobs);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes('jobs') || e.path.includes('jobs'))).toBe(true);
    });

    it('should detect invalid trigger configuration', async () => {
      const invalidTrigger = `
name: Test Workflow
on:
  invalid_event:
    types: [opened]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`;

      const errors = await workflowValidator.validateWorkflow(invalidTrigger);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate workflow with multiple jobs', async () => {
      const multipleJobs = `
name: Multi-job Workflow
on:
  pull_request:
    types: [opened, synchronize]
permissions:
  contents: read
  pull-requests: write
jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      should-run: \${{ steps.check.outputs.result }}
    steps:
      - name: Check
        id: check
        run: echo "result=true" >> $GITHUB_OUTPUT

  build:
    runs-on: ubuntu-latest
    needs: validate
    if: needs.validate.outputs.should-run == 'true'
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: npm run build
`;

      const errors = await workflowValidator.validateWorkflow(multipleJobs);
      expect(errors).toHaveLength(0);
    });

    it('should detect invalid job structure', async () => {
      const invalidJob = `
name: Test Workflow
on: push
jobs:
  test:
    invalid_field: something
    steps:
      - run: echo "test"
`;

      const errors = await workflowValidator.validateWorkflow(invalidJob);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate workflow with environment variables', async () => {
      const withEnv = `
name: Env Workflow
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
      API_KEY: \${{ secrets.API_KEY }}
    steps:
      - name: Test
        run: npm test
        env:
          DEBUG: true
`;

      const errors = await workflowValidator.validateWorkflow(withEnv);
      expect(errors).toHaveLength(0);
    });

    it('should validate workflow with schedule trigger', async () => {
      const scheduled = `
name: Scheduled Workflow
on:
  schedule:
    - cron: '0 0 * * *'
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - run: echo "cleanup"
`;

      const errors = await workflowValidator.validateWorkflow(scheduled);
      expect(errors).toHaveLength(0);
    });

    it('should validate workflow with permissions', async () => {
      const withPermissions = `
name: Permissions Workflow
on: push
permissions:
  contents: write
  issues: read
  pull-requests: write
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: echo "test"
`;

      const errors = await workflowValidator.validateWorkflow(withPermissions);
      expect(errors).toHaveLength(0);
    });
  });
});
