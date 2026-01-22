import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import yaml from "js-yaml";
import { unifiedWorkflowGenerator } from "./unified";

// Path to legacy fixtures
const PROJECT_ROOT = resolve(import.meta.dir, "../../..");
const LEGACY_FIXTURES_DIR = join(PROJECT_ROOT, "tests/fixtures/legacy");

interface WorkflowYaml {
  name: string;
  on: {
    issues?: { types?: string[] };
    pull_request?: { types?: string[] };
    discussion?: { types?: string[] };
    schedule?: Array<{ cron: string }>;
    workflow_dispatch?: Record<string, unknown>;
    [key: string]: unknown;
  };
  permissions?: Record<string, string>;
  jobs: Record<string, unknown>;
}

describe("Backward Compatibility Tests", () => {
  const defaultSecrets = { hasApiKey: true, hasAccessToken: false };

  // Get all legacy fixture files (exclude README)
  const legacyFixtures = readdirSync(LEGACY_FIXTURES_DIR)
    .filter((file) => file.endsWith(".md") && !file.startsWith("README"))
    .map((file) => ({
      name: file,
      path: join(LEGACY_FIXTURES_DIR, file),
      version: file.startsWith("v1.0") ? "v1.0" : "v1.4",
    }));

  describe("Legacy Agent Parsing", () => {
    it("should have legacy fixtures", () => {
      expect(legacyFixtures.length).toBeGreaterThan(0);
    });

    it("should have both v1.0 and v1.4 fixtures", () => {
      const v1_0_fixtures = legacyFixtures.filter((f) => f.version === "v1.0");
      const v1_4_fixtures = legacyFixtures.filter((f) => f.version === "v1.4");

      expect(v1_0_fixtures.length).toBeGreaterThan(0);
      expect(v1_4_fixtures.length).toBeGreaterThan(0);
    });

    for (const fixture of legacyFixtures) {
      it(`should parse ${fixture.name} (${fixture.version}) successfully`, () => {
        const content = readFileSync(fixture.path, "utf-8");
        const result = agentParser.parseContent(content);

        // Should parse without errors
        expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
        expect(result.agent).toBeDefined();
      });
    }
  });

  describe("V1.0 Format Compatibility", () => {
    it("should parse v1.0 basic agent with minimal configuration", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-basic.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      expect(agent.name).toBe("Basic V1.0 Agent");
      expect(agent.on.issues).toBeDefined();
      expect(agent.on.issues?.types).toEqual(["opened"]);
      expect(agent.permissions?.issues).toBe("write");
      expect(agent.outputs).toBeDefined();
      expect(agent.outputs?.["add-comment"]).toBe(true);
    });

    it("should parse v1.0 agent without optional fields", () => {
      const content = readFileSync(
        join(LEGACY_FIXTURES_DIR, "v1.0-no-optional-fields.md"),
        "utf-8",
      );
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      expect(agent.name).toBe("V1.0 No Optional Fields");
      expect(agent.on.pull_request).toBeDefined();
      expect(agent.permissions).toBeUndefined();
      expect(agent.outputs).toBeUndefined();
      expect(agent.context).toBeUndefined();
      expect(agent.audit).toBeUndefined();
      expect(agent.provider).toBeUndefined();
    });

    it("should parse v1.0 schedule trigger", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-schedule.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      expect(agent.on.schedule).toBeDefined();
      expect(agent.on.schedule).toHaveLength(1);
      expect(agent.on.schedule?.[0].cron).toBe("0 9 * * *");
    });
  });

  describe("V1.4 Format Compatibility", () => {
    it("should parse v1.4 simple outputs format", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-simple-outputs.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      expect(agent.outputs).toBeDefined();
      expect(agent.outputs?.["add-comment"]).toBe(true);
      expect(agent.outputs?.["add-label"]).toBe(true);
      expect(agent.outputs?.["remove-label"]).toBe(true);
      expect(agent.allowed_actors).toEqual(["admin", "write"]);
    });

    it("should parse v1.4 output configuration objects", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-output-config.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      expect(agent.outputs).toBeDefined();

      // Check max limits on outputs
      expect(agent.outputs?.["add-comment"]).toEqual({ max: 5 });
      expect(agent.outputs?.["create-issue"]).toEqual({ max: 3 });
      expect(agent.outputs?.["add-label"]).toBe(true);

      // Check other v1.4 features
      expect(agent.allowed_paths).toEqual(["docs/**/*", "README.md"]);
      expect(agent.rate_limit_minutes).toBe(10);
    });

    it("should parse v1.4 multiple triggers", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-multiple-triggers.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;

      // Check all trigger types
      expect(agent.on.issues).toBeDefined();
      expect(agent.on.issues?.types).toEqual(["opened", "labeled", "closed"]);
      expect(agent.on.pull_request).toBeDefined();
      expect(agent.on.pull_request?.types).toEqual(["opened", "synchronize", "closed"]);
      expect(agent.on.discussion).toBeDefined();
      expect(agent.on.discussion?.types).toEqual(["created"]);
      expect(agent.on.schedule).toBeDefined();
      expect(agent.on.schedule?.[0].cron).toBe("0 12 * * 1");

      // Check v1.4 features
      expect(agent.max_open_prs).toBe(5);
    });

    it("should parse v1.4 PR workflow with file operations", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-pr-workflow.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;

      // Check PR-specific outputs
      expect(agent.outputs?.["create-pr"]).toEqual({ sign: true });
      expect(agent.outputs?.["update-file"]).toBe(true);
      expect(agent.allowed_paths).toEqual(["**/*.md", ".github/**/*"]);
      expect(agent.permissions?.contents).toBe("write");
      expect(agent.permissions?.pull_requests).toBe("write");
    });
  });

  describe("Legacy Workflow Generation", () => {
    for (const fixture of legacyFixtures) {
      it(`should generate valid workflow YAML for ${fixture.name}`, () => {
        const content = readFileSync(fixture.path, "utf-8");
        const result = agentParser.parseContent(content);

        expect(result.errors.filter((e) => e.severity === "error")).toHaveLength(0);
        expect(result.agent).toBeDefined();

        const agent = result.agent as AgentDefinition;
        const workflow = unifiedWorkflowGenerator.generate([agent], defaultSecrets);

        // Should be valid YAML
        expect(() => yaml.load(workflow)).not.toThrow();

        const parsed = yaml.load(workflow) as WorkflowYaml;

        // Should have required workflow structure
        expect(parsed.name).toBe("AI Agents");
        expect(parsed.on).toBeDefined();
        expect(parsed.jobs).toBeDefined();

        // Should have core jobs
        expect(parsed.jobs.dispatcher).toBeDefined();
      });
    }

    it("should generate workflow with correct triggers for v1.0 basic agent", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-basic.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      const workflow = unifiedWorkflowGenerator.generate([agent], defaultSecrets);
      const parsed = yaml.load(workflow) as WorkflowYaml;

      // Should include issue trigger
      expect(parsed.on.issues).toBeDefined();
      expect(parsed.on.issues?.types).toContain("opened");

      // Should always add workflow_dispatch
      expect(parsed.on.workflow_dispatch).toBeDefined();
    });

    it("should generate workflow with correct permissions for v1.4 output-config agent", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-output-config.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      const workflow = unifiedWorkflowGenerator.generate([agent], defaultSecrets);
      const parsed = yaml.load(workflow) as WorkflowYaml;

      // Should include required permissions
      expect(parsed.permissions).toBeDefined();
      expect(parsed.permissions?.issues).toBe("write");
      expect(parsed.permissions?.contents).toBe("write");
    });

    it("should generate workflow with schedule trigger for v1.0 schedule agent", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-schedule.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      const workflow = unifiedWorkflowGenerator.generate([agent], defaultSecrets);
      const parsed = yaml.load(workflow) as WorkflowYaml;

      // Should include schedule trigger
      expect(parsed.on.schedule).toBeDefined();
      expect(parsed.on.schedule).toHaveLength(1);
      expect(parsed.on.schedule?.[0].cron).toBe("0 9 * * *");
    });

    it("should handle multiple legacy agents in single workflow", () => {
      const v1_0_content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-basic.md"), "utf-8");
      const v1_4_content = readFileSync(
        join(LEGACY_FIXTURES_DIR, "v1.4-simple-outputs.md"),
        "utf-8",
      );

      const v1_0_result = agentParser.parseContent(v1_0_content);
      const v1_4_result = agentParser.parseContent(v1_4_content);

      expect(v1_0_result.agent).toBeDefined();
      expect(v1_4_result.agent).toBeDefined();

      const agents = [v1_0_result.agent, v1_4_result.agent] as AgentDefinition[];
      const workflow = unifiedWorkflowGenerator.generate(agents, defaultSecrets);

      // Should be valid YAML
      expect(() => yaml.load(workflow)).not.toThrow();

      const parsed = yaml.load(workflow) as WorkflowYaml;

      // Should aggregate triggers from both agents
      expect(parsed.on.issues).toBeDefined();
      expect(parsed.on.issues?.types).toContain("opened");
      expect(parsed.on.issues?.types).toContain("edited");

      // Should have jobs for both agents
      expect(parsed.jobs).toBeDefined();
      const jobNames = Object.keys(parsed.jobs);
      expect(jobNames.some((name) => name.includes("basic-v1-0-agent"))).toBe(true);
      expect(jobNames.some((name) => name.includes("v1-4-simple-outputs"))).toBe(true);
    });
  });

  describe("Legacy Agent Validation", () => {
    it("should validate v1.4 update-file with allowed-paths", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-output-config.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      const validationErrors = agentParser.validateAgent(agent);

      // Should not have validation errors
      expect(validationErrors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("should validate v1.4 create-pr with contents write permission", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-pr-workflow.md"), "utf-8");
      const result = agentParser.parseContent(content);

      expect(result.agent).toBeDefined();

      const agent = result.agent as AgentDefinition;
      const validationErrors = agentParser.validateAgent(agent);

      // Should not have validation errors
      expect(validationErrors.filter((e) => e.severity === "error")).toHaveLength(0);
    });

    it("should pass validation for all legacy fixtures", () => {
      for (const fixture of legacyFixtures) {
        const content = readFileSync(fixture.path, "utf-8");
        const result = agentParser.parseContent(content);

        expect(result.agent).toBeDefined();

        const agent = result.agent as AgentDefinition;
        const validationErrors = agentParser.validateAgent(agent);

        // Should not have critical validation errors
        const criticalErrors = validationErrors.filter((e) => e.severity === "error");
        expect(criticalErrors).toHaveLength(0);
      }
    });
  });

  describe("Legacy Format Features", () => {
    it("should preserve allowed-actors field from v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-simple-outputs.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(agent.allowed_actors).toBeDefined();
      expect(agent.allowed_actors).toEqual(["admin", "write"]);
    });

    it("should preserve rate_limit_minutes from v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-output-config.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(agent.rate_limit_minutes).toBe(10);
    });

    it("should preserve max_open_prs from v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-multiple-triggers.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(agent.max_open_prs).toBe(5);
    });

    it("should handle output boolean values from v1.0/v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.0-basic.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(agent.outputs?.["add-comment"]).toBe(true);
    });

    it("should handle output config objects from v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-output-config.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(typeof agent.outputs?.["add-comment"]).toBe("object");
      expect(agent.outputs?.["add-comment"]).toEqual({ max: 5 });
    });

    it("should handle sign option in create-pr output from v1.4", () => {
      const content = readFileSync(join(LEGACY_FIXTURES_DIR, "v1.4-pr-workflow.md"), "utf-8");
      const result = agentParser.parseContent(content);
      const agent = result.agent as AgentDefinition;

      expect(agent.outputs?.["create-pr"]).toEqual({ sign: true });
    });
  });

  describe("Coverage Summary", () => {
    it("should test all legacy fixtures", () => {
      expect(legacyFixtures.length).toBeGreaterThanOrEqual(7);
    });

    it("should cover v1.0 features", () => {
      const v1_0_fixtures = legacyFixtures.filter((f) => f.version === "v1.0");

      // Should have basic, no-optional-fields, and schedule fixtures
      expect(v1_0_fixtures.length).toBeGreaterThanOrEqual(3);
    });

    it("should cover v1.4 features", () => {
      const v1_4_fixtures = legacyFixtures.filter((f) => f.version === "v1.4");

      // Should have simple-outputs, output-config, multiple-triggers, and pr-workflow
      expect(v1_4_fixtures.length).toBeGreaterThanOrEqual(4);
    });
  });
});
