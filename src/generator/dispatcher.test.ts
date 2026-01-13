import { describe, expect, it } from 'bun:test';
import { DispatcherGenerator } from './dispatcher';
import type { AgentDefinition } from '../types';

describe('DispatcherGenerator', () => {
  const generator = new DispatcherGenerator();

  const createAgent = (overrides: Partial<AgentDefinition> = {}): AgentDefinition => ({
    name: 'Test Agent',
    on: { issues: { types: ['opened'] } },
    markdown: 'Test instructions',
    ...overrides,
  });

  describe('aggregateTriggers', () => {
    it('should aggregate issue triggers from multiple agents', () => {
      const agents = [
        createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } }),
        createAgent({ name: 'Agent B', on: { issues: { types: ['opened', 'labeled'] } } }),
        createAgent({ name: 'Agent C', on: { issues: { types: ['closed'] } } }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.issues).toBeDefined();
      expect(triggers.issues?.types).toContain('opened');
      expect(triggers.issues?.types).toContain('labeled');
      expect(triggers.issues?.types).toContain('closed');
      // Should be deduplicated
      expect(triggers.issues?.types?.filter((t) => t === 'opened').length).toBe(1);
    });

    it('should aggregate pull_request triggers', () => {
      const agents = [
        createAgent({ name: 'Agent A', on: { pull_request: { types: ['opened'] } } }),
        createAgent({ name: 'Agent B', on: { pull_request: { types: ['synchronize', 'closed'] } } }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.pull_request).toBeDefined();
      expect(triggers.pull_request?.types).toContain('opened');
      expect(triggers.pull_request?.types).toContain('synchronize');
      expect(triggers.pull_request?.types).toContain('closed');
    });

    it('should aggregate discussion triggers', () => {
      const agents = [
        createAgent({ name: 'Agent A', on: { discussion: { types: ['created'] } } }),
        createAgent({ name: 'Agent B', on: { discussion: { types: ['answered'] } } }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.discussion).toBeDefined();
      expect(triggers.discussion?.types).toContain('created');
      expect(triggers.discussion?.types).toContain('answered');
    });

    it('should aggregate schedule triggers with unique cron expressions', () => {
      const agents = [
        createAgent({
          name: 'Agent A',
          on: { schedule: [{ cron: '0 9 * * 1-5' }] },
        }),
        createAgent({
          name: 'Agent B',
          on: { schedule: [{ cron: '0 */6 * * *' }] },
        }),
        createAgent({
          name: 'Agent C',
          on: { schedule: [{ cron: '0 9 * * 1-5' }] }, // Duplicate
        }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.schedule).toBeDefined();
      expect(triggers.schedule?.length).toBe(2);
      expect(triggers.schedule?.map((s) => s.cron)).toContain('0 9 * * 1-5');
      expect(triggers.schedule?.map((s) => s.cron)).toContain('0 */6 * * *');
    });

    it('should aggregate repository_dispatch triggers', () => {
      const agents = [
        createAgent({
          name: 'Agent A',
          on: { repository_dispatch: { types: ['deploy'] } },
        }),
        createAgent({
          name: 'Agent B',
          on: { repository_dispatch: { types: ['deploy', 'rollback'] } },
        }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.repository_dispatch).toBeDefined();
      expect(triggers.repository_dispatch?.types).toContain('deploy');
      expect(triggers.repository_dispatch?.types).toContain('rollback');
    });

    it('should always include workflow_dispatch with agent input', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.workflow_dispatch).toBeDefined();
      expect(triggers.workflow_dispatch?.inputs?.agent).toBeDefined();
    });

    it('should handle agents with multiple trigger types', () => {
      const agents = [
        createAgent({
          name: 'Multi-trigger Agent',
          on: {
            issues: { types: ['opened'] },
            pull_request: { types: ['opened'] },
            schedule: [{ cron: '0 9 * * *' }],
          },
        }),
      ];

      const triggers = generator.aggregateTriggers(agents);

      expect(triggers.issues?.types).toContain('opened');
      expect(triggers.pull_request?.types).toContain('opened');
      expect(triggers.schedule?.length).toBe(1);
    });
  });

  describe('generateRoutingTable', () => {
    it('should create routing rules for each agent', () => {
      const agents = [
        createAgent({ name: 'Issue Triage', on: { issues: { types: ['opened'] } } }),
        createAgent({ name: 'PR Review', on: { pull_request: { types: ['opened'] } } }),
      ];

      const rules = generator.generateRoutingTable(agents);

      expect(rules.length).toBe(2);

      const issueTriage = rules.find((r) => r.agentName === 'Issue Triage');
      expect(issueTriage).toBeDefined();
      expect(issueTriage?.workflowFile).toBe('claude-issue-triage.yml');
      expect(issueTriage?.triggers.some((t) => t.eventType === 'issues')).toBe(true);

      const prReview = rules.find((r) => r.agentName === 'PR Review');
      expect(prReview).toBeDefined();
      expect(prReview?.workflowFile).toBe('claude-pr-review.yml');
      expect(prReview?.triggers.some((t) => t.eventType === 'pull_request')).toBe(true);
    });

    it('should include event actions in routing rules', () => {
      const agents = [
        createAgent({
          name: 'Agent A',
          on: { issues: { types: ['opened', 'labeled'] } },
        }),
      ];

      const rules = generator.generateRoutingTable(agents);
      const rule = rules[0];

      const issueTrigger = rule.triggers.find((t) => t.eventType === 'issues');
      expect(issueTrigger?.eventActions).toContain('opened');
      expect(issueTrigger?.eventActions).toContain('labeled');
    });

    it('should include schedule cron expressions in routing rules', () => {
      const agents = [
        createAgent({
          name: 'Daily Report',
          on: { schedule: [{ cron: '0 9 * * 1-5' }] },
        }),
      ];

      const rules = generator.generateRoutingTable(agents);
      const rule = rules[0];

      const scheduleTrigger = rule.triggers.find((t) => t.eventType === 'schedule');
      expect(scheduleTrigger?.schedule).toBe('0 9 * * 1-5');
    });

    it('should include workflow_dispatch trigger for all agents', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const rules = generator.generateRoutingTable(agents);
      const rule = rules[0];

      expect(rule.triggers.some((t) => t.eventType === 'workflow_dispatch')).toBe(true);
    });
  });

  describe('generate', () => {
    it('should generate valid YAML workflow', () => {
      const agents = [
        createAgent({ name: 'Issue Triage', on: { issues: { types: ['opened'] } } }),
      ];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('name: Claude Agent Dispatcher');
      expect(workflow).toContain('on:');
      expect(workflow).toContain('issues:');
      expect(workflow).toContain('jobs:');
      expect(workflow).toContain('pre-flight:');
      expect(workflow).toContain('prepare-context:');
      expect(workflow).toContain('route-event:');
      expect(workflow).toContain('dispatch-agents:');
    });

    it('should include self-healing steps in pre-flight', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('Check configuration');
      expect(workflow).toContain('Self-heal on configuration error');
      expect(workflow).toContain('gh issue create');
      expect(workflow).toContain('gh workflow disable');
    });

    it('should include routing table in route-event job', () => {
      const agents = [
        createAgent({ name: 'Issue Triage', on: { issues: { types: ['opened'] } } }),
        createAgent({ name: 'PR Review', on: { pull_request: { types: ['opened'] } } }),
      ];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('Route event to agents');
      expect(workflow).toContain('ROUTING_TABLE');
      expect(workflow).toContain('Issue Triage');
      expect(workflow).toContain('PR Review');
    });

    it('should include permissions for actions and issues', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('permissions:');
      expect(workflow).toContain('actions: write');
      expect(workflow).toContain('issues: write');
    });

    it('should include context preparation steps', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('Prepare dispatch context');
      expect(workflow).toContain('Upload context artifact');
      expect(workflow).toContain('dispatch-context');
    });

    it('should include dispatch job with matrix strategy', () => {
      const agents = [createAgent({ name: 'Agent A', on: { issues: { types: ['opened'] } } })];

      const workflow = generator.generate(agents);

      expect(workflow).toContain('dispatch-agents:');
      expect(workflow).toContain('strategy:');
      expect(workflow).toContain('matrix:');
      expect(workflow).toContain('gh workflow run');
    });
  });
});
