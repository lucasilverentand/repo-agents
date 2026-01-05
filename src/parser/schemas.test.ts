import { describe, it, expect } from 'bun:test';
import { agentFrontmatterSchema } from './schemas';

describe('agentFrontmatterSchema', () => {
  describe('valid configurations', () => {
    it('should accept minimal valid config with name and trigger', () => {
      const config = {
        name: 'Test Agent',
        on: {
          issues: {
            types: ['opened'],
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with all trigger types', () => {
      const config = {
        name: 'Multi-Trigger Agent',
        on: {
          issues: { types: ['opened', 'closed'] },
          pull_request: { types: ['opened', 'synchronize'] },
          discussion: { types: ['created'] },
          schedule: [{ cron: '0 0 * * *' }],
          workflow_dispatch: {},
          repository_dispatch: { types: ['custom-event'] },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with permissions', () => {
      const config = {
        name: 'Permission Test',
        on: { issues: { types: ['opened'] } },
        permissions: {
          contents: 'write',
          issues: 'read',
          pull_requests: 'write',
          discussions: 'read',
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with claude settings', () => {
      const config = {
        name: 'Claude Config Test',
        on: { issues: { types: ['opened'] } },
        claude: {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 8192,
          temperature: 0.7,
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with outputs', () => {
      const config = {
        name: 'Output Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'add-comment': { max: 1 },
          'add-label': true,
          'create-pr': { max: 3, sign: true },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with inputs', () => {
      const config = {
        name: 'Input Test',
        on: { schedule: [{ cron: '0 0 * * *' }] },
        inputs: {
          issues: {
            states: ['open'],
            labels: ['bug'],
            limit: 100,
          },
          pull_requests: {
            states: ['open', 'merged'],
            limit: 50,
          },
          since: '24h',
          min_items: 1,
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with audit settings', () => {
      const config = {
        name: 'Audit Test',
        on: { issues: { types: ['opened'] } },
        audit: {
          create_issues: true,
          labels: ['automation', 'audit'],
          assignees: ['admin'],
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with authorization settings', () => {
      const config = {
        name: 'Auth Test',
        on: { issues: { types: ['opened'] } },
        'allowed-actors': ['user1', 'user2'],
        'allowed-users': ['user3'],
        'allowed-teams': ['core-team'],
        'allowed-paths': ['src/**/*.ts', 'docs/**'],
        trigger_labels: ['automation'],
        rate_limit_minutes: 15,
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('invalid configurations', () => {
    it('should reject config without name', () => {
      const config = {
        on: { issues: { types: ['opened'] } },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('name'))).toBe(true);
      }
    });

    it('should reject config with empty name', () => {
      const config = {
        name: '',
        on: { issues: { types: ['opened'] } },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject config without trigger', () => {
      const config = {
        name: 'Test Agent',
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('on'))).toBe(true);
      }
    });

    it('should reject invalid permission values', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        permissions: {
          contents: 'execute', // Invalid - should be 'read' or 'write'
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid temperature values', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        claude: {
          temperature: 1.5, // Invalid - must be between 0 and 1
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject negative rate_limit_minutes', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        rate_limit_minutes: -5,
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid output types', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'invalid-output': true, // Not a valid output type
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject invalid input states', () => {
      const config = {
        name: 'Test',
        on: { schedule: [{ cron: '0 0 * * *' }] },
        inputs: {
          issues: {
            states: ['invalid'], // Should be 'open', 'closed', or 'all'
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject input limit exceeding maximum', () => {
      const config = {
        name: 'Test',
        on: { schedule: [{ cron: '0 0 * * *' }] },
        inputs: {
          issues: {
            limit: 2000, // Exceeds max of 1000
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should reject input limit below minimum', () => {
      const config = {
        name: 'Test',
        on: { schedule: [{ cron: '0 0 * * *' }] },
        inputs: {
          issues: {
            limit: 0, // Below min of 1
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should accept workflow_dispatch without inputs', () => {
      const config = {
        name: 'Test',
        on: {
          workflow_dispatch: {},
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept workflow_dispatch with inputs', () => {
      const config = {
        name: 'Test',
        on: {
          workflow_dispatch: {
            inputs: {
              environment: {
                description: 'Environment to deploy to',
                required: true,
                type: 'choice',
                options: ['dev', 'staging', 'prod'],
              },
            },
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept empty permissions object', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        permissions: {},
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept outputs with passthrough properties', () => {
      const config = {
        name: 'Test',
        on: { issues: { types: ['opened'] } },
        outputs: {
          'create-pr': {
            max: 1,
            sign: true,
            customProperty: 'value', // passthrough allowed
          },
        },
      };

      const result = agentFrontmatterSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });
});

