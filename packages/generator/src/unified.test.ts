import { describe, expect, it } from "bun:test";
import type { AgentDefinition } from "@repo-agents/types";
import yaml from "js-yaml";
import { unifiedWorkflowGenerator } from "./unified";

interface WorkflowYaml {
  name: string;
  on: Record<string, unknown>;
  permissions: Record<string, string>;
  jobs: Record<string, unknown>;
}

describe("UnifiedWorkflowGenerator", () => {
  const defaultSecrets = { hasApiKey: true, hasAccessToken: false };

  it("should generate a valid workflow YAML", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test instructions",
        on: {
          issues: { types: ["opened"] },
        },
        permissions: {
          issues: "write",
          contents: "read",
        },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);

    // Should be valid YAML
    expect(() => yaml.load(workflow)).not.toThrow();

    // Should contain expected structure
    expect(workflow).toContain("name: AI Agents");
    expect(workflow).toContain("global-preflight:");
    expect(workflow).toContain("route-event:");
    expect(workflow).toContain("agent-validation:");
    expect(workflow).toContain("agent-execution:");
    expect(workflow).toContain("execute-outputs:");
    expect(workflow).toContain("audit-report:");
  });

  it("should aggregate triggers from multiple agents", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Agent 1",
        markdown: "Test 1",
        on: {
          issues: { types: ["opened"] },
        },
      },
      {
        name: "Agent 2",
        markdown: "Test 2",
        on: {
          issues: { types: ["labeled"] },
          pull_request: { types: ["opened"] },
        },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);
    const parsed = yaml.load(workflow) as WorkflowYaml;

    // Should union issue types
    expect(parsed.on.issues.types).toContain("opened");
    expect(parsed.on.issues.types).toContain("labeled");

    // Should include PR types
    expect(parsed.on.pull_request.types).toContain("opened");

    // Should always include workflow_dispatch
    expect(parsed.on.workflow_dispatch).toBeDefined();
    expect(parsed.on.workflow_dispatch.inputs.agent).toBeDefined();
  });

  it("should aggregate permissions to maximum level", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Agent 1",
        markdown: "Test 1",
        on: { issues: { types: ["opened"] } },
        permissions: {
          contents: "read",
        },
      },
      {
        name: "Agent 2",
        markdown: "Test 2",
        on: { issues: { types: ["opened"] } },
        permissions: {
          contents: "write",
          pull_requests: "write",
        },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);
    const parsed = yaml.load(workflow) as WorkflowYaml;

    // Should upgrade to write if any agent needs it
    expect(parsed.permissions.contents).toBe("write");
    expect(parsed.permissions["pull-requests"]).toBe("write");

    // Should always include these
    expect(parsed.permissions.actions).toBe("write");
    expect(parsed.permissions.issues).toBe("write");
  });

  it("should add closed issue type when blocking checks enabled", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Agent 1",
        markdown: "Test 1",
        on: { issues: { types: ["opened"] } },
        pre_flight: {
          check_blocking_issues: true,
        },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);
    const parsed = yaml.load(workflow) as WorkflowYaml;

    // Should automatically add "closed" for retry logic
    expect(parsed.on.issues.types).toContain("closed");
  });

  it("should generate all 6 jobs", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);
    const parsed = yaml.load(workflow) as WorkflowYaml;

    expect(parsed.jobs["global-preflight"]).toBeDefined();
    expect(parsed.jobs["route-event"]).toBeDefined();
    expect(parsed.jobs["agent-validation"]).toBeDefined();
    expect(parsed.jobs["agent-execution"]).toBeDefined();
    expect(parsed.jobs["execute-outputs"]).toBeDefined();
    expect(parsed.jobs["audit-report"]).toBeDefined();
  });

  it("should generate matrix configuration in validation job", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);
    const parsed = yaml.load(workflow) as WorkflowYaml;

    const validationJob = parsed.jobs["agent-validation"];
    expect(validationJob.strategy).toBeDefined();
    expect(validationJob.strategy["fail-fast"]).toBe(false);
    expect(validationJob.strategy.matrix.agent).toContain(
      "fromJson(needs.route-event.outputs.matching-agents)",
    );
  });

  it("should format YAML with proper spacing", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);

    // Should have blank lines between jobs
    expect(workflow).toMatch(/jobs:\n\s+global-preflight:/);
    expect(workflow).toMatch(/\n\s+route-event:/);

    // Should have blank lines between steps
    expect(workflow).toMatch(/steps:\n\s+- uses:/);
  });

  it("should only include configured API key secret", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, {
      hasApiKey: true,
      hasAccessToken: false,
    });

    // Should include API key
    expect(workflow).toContain("ANTHROPIC_API_KEY");
    // Should NOT include OAuth token
    expect(workflow).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
  });

  it("should only include configured OAuth token secret", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, {
      hasApiKey: false,
      hasAccessToken: true,
    });

    // Should include OAuth token
    expect(workflow).toContain("CLAUDE_CODE_OAUTH_TOKEN");
    // Should NOT include API key
    expect(workflow).not.toContain("ANTHROPIC_API_KEY");
  });

  it("should include both secrets when both are configured", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    const workflow = unifiedWorkflowGenerator.generate(agents, {
      hasApiKey: true,
      hasAccessToken: true,
    });

    // Should include both
    expect(workflow).toContain("ANTHROPIC_API_KEY");
    expect(workflow).toContain("CLAUDE_CODE_OAUTH_TOKEN");
  });

  it("should handle missing secrets configuration", () => {
    const agents: AgentDefinition[] = [
      {
        name: "Test Agent",
        markdown: "Test",
        on: { issues: { types: ["opened"] } },
      },
    ];

    // Should not throw when secrets not provided
    const workflow = unifiedWorkflowGenerator.generate(agents);
    expect(workflow).toBeDefined();

    // Should not include either secret
    expect(workflow).not.toContain("ANTHROPIC_API_KEY");
    expect(workflow).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
  });
});
