import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { UnifiedWorkflowGenerator } from "@repo-agents/generator";
import { AgentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";

/**
 * Performance regression tests for compilation operations.
 *
 * These tests ensure that parsing and generation operations
 * stay within acceptable performance bounds. Tests will fail
 * if performance regresses by more than 20%.
 */

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  PARSE_10_AGENTS: 500,
  PARSE_100_AGENTS: 3000,
  GENERATE_10_AGENTS: 1000,
  GENERATE_50_AGENTS: 3000,
} as const;

// Allow 20% regression before failing
const REGRESSION_TOLERANCE = 1.2;

// Agent template for performance testing
const AGENT_TEMPLATE = `---
name: Performance Test Agent {index}
on:
  issues:
    types: [opened, labeled]
permissions:
  issues: write
  contents: read
outputs:
  add-comment: true
  add-label: true
---

# Performance Test Agent {index}

This is a test agent used for performance benchmarking.

## Purpose

Test agent for performance regression testing.

## Instructions

When triggered:
1. Analyze the issue content
2. Add appropriate labels
3. Post a comment
`;

describe("Compile Performance Benchmarks", () => {
  let tempDir: string;
  let parser: AgentParser;
  let generator: UnifiedWorkflowGenerator;

  beforeEach(async () => {
    // Create temp directory for each test
    tempDir = await mkdtemp(join(tmpdir(), "repo-agents-perf-"));
    parser = new AgentParser();
    generator = new UnifiedWorkflowGenerator();
  });

  afterEach(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create test agent files
   */
  async function createAgentFiles(count: number): Promise<string[]> {
    const agentDir = join(tempDir, ".github/agents");
    await mkdir(agentDir, { recursive: true });

    const filePaths: string[] = [];
    for (let i = 0; i < count; i++) {
      const content = AGENT_TEMPLATE.replace(/{index}/g, String(i));
      const filePath = join(agentDir, `agent-${i}.md`);
      await writeFile(filePath, content);
      filePaths.push(filePath);
    }

    return filePaths;
  }

  /**
   * Helper to measure execution time
   */
  async function measureTime<T>(
    fn: () => T | Promise<T>,
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    return { result, duration };
  }

  /**
   * Helper to assert performance threshold with tolerance
   */
  function assertPerformance(duration: number, threshold: number, operation: string): void {
    const maxAllowed = threshold * REGRESSION_TOLERANCE;

    if (duration > maxAllowed) {
      throw new Error(
        `Performance regression detected: ${operation} took ${duration.toFixed(2)}ms ` +
          `(threshold: ${threshold}ms, max allowed with 20% tolerance: ${maxAllowed.toFixed(2)}ms)`,
      );
    }

    // Log success for visibility
    console.log(
      `✓ ${operation}: ${duration.toFixed(2)}ms (threshold: ${threshold}ms, ` +
        `${((duration / threshold) * 100).toFixed(1)}% of limit)`,
    );
  }

  test("parsing 10 agents should take < 500ms", async () => {
    // Create 10 test agent files
    const filePaths = await createAgentFiles(10);

    // Measure parsing time
    const { result: agents, duration } = await measureTime(async () => {
      const parsed: AgentDefinition[] = [];
      for (const filePath of filePaths) {
        const { agent, errors } = await parser.parseFile(filePath);
        if (agent && errors.every((e) => e.severity !== "error")) {
          parsed.push(agent);
        }
      }
      return parsed;
    });

    // Verify we parsed all agents
    expect(agents).toHaveLength(10);

    // Assert performance threshold
    assertPerformance(duration, THRESHOLDS.PARSE_10_AGENTS, "Parsing 10 agents");
  });

  test("parsing 100 agents should take < 3000ms", async () => {
    // Create 100 test agent files
    const filePaths = await createAgentFiles(100);

    // Measure parsing time
    const { result: agents, duration } = await measureTime(async () => {
      const parsed: AgentDefinition[] = [];
      for (const filePath of filePaths) {
        const { agent, errors } = await parser.parseFile(filePath);
        if (agent && errors.every((e) => e.severity !== "error")) {
          parsed.push(agent);
        }
      }
      return parsed;
    });

    // Verify we parsed all agents
    expect(agents).toHaveLength(100);

    // Assert performance threshold
    assertPerformance(duration, THRESHOLDS.PARSE_100_AGENTS, "Parsing 100 agents");
  });

  test("generating workflow from 10 agents should take < 1000ms", async () => {
    // Create and parse 10 agents
    const filePaths = await createAgentFiles(10);
    const agents: AgentDefinition[] = [];

    for (const filePath of filePaths) {
      const { agent, errors } = await parser.parseFile(filePath);
      if (agent && errors.every((e) => e.severity !== "error")) {
        agents.push(agent);
      }
    }

    expect(agents).toHaveLength(10);

    // Measure workflow generation time
    const { result: workflow, duration } = await measureTime(() => {
      return generator.generate(agents, {
        hasApiKey: true,
        hasAccessToken: false,
      });
    });

    // Verify workflow was generated
    expect(workflow).toContain("name: AI Agents");
    expect(workflow).toContain("global-preflight:");
    expect(workflow).toContain("dispatcher:");

    // Assert performance threshold
    assertPerformance(
      duration,
      THRESHOLDS.GENERATE_10_AGENTS,
      "Generating workflow from 10 agents",
    );
  });

  test("generating workflow from 50 agents should take < 3000ms", async () => {
    // Create and parse 50 agents
    const filePaths = await createAgentFiles(50);
    const agents: AgentDefinition[] = [];

    for (const filePath of filePaths) {
      const { agent, errors } = await parser.parseFile(filePath);
      if (agent && errors.every((e) => e.severity !== "error")) {
        agents.push(agent);
      }
    }

    expect(agents).toHaveLength(50);

    // Measure workflow generation time
    const { result: workflow, duration } = await measureTime(() => {
      return generator.generate(agents, {
        hasApiKey: true,
        hasAccessToken: false,
      });
    });

    // Verify workflow was generated
    expect(workflow).toContain("name: AI Agents");
    expect(workflow).toContain("global-preflight:");
    expect(workflow).toContain("dispatcher:");

    // Assert performance threshold
    assertPerformance(
      duration,
      THRESHOLDS.GENERATE_50_AGENTS,
      "Generating workflow from 50 agents",
    );
  });

  test("end-to-end: parse and generate 10 agents within combined threshold", async () => {
    // Create agent files
    const filePaths = await createAgentFiles(10);

    // Measure end-to-end time (parse + generate)
    const { result: workflow, duration } = await measureTime(async () => {
      // Parse
      const agents: AgentDefinition[] = [];
      for (const filePath of filePaths) {
        const { agent, errors } = await parser.parseFile(filePath);
        if (agent && errors.every((e) => e.severity !== "error")) {
          agents.push(agent);
        }
      }

      // Generate
      return generator.generate(agents, {
        hasApiKey: true,
        hasAccessToken: false,
      });
    });

    // Verify workflow was generated
    expect(workflow).toContain("name: AI Agents");

    // Combined threshold: parse (500ms) + generate (1000ms) = 1500ms
    const combinedThreshold = THRESHOLDS.PARSE_10_AGENTS + THRESHOLDS.GENERATE_10_AGENTS;
    assertPerformance(duration, combinedThreshold, "End-to-end parse and generate 10 agents");
  });

  test("parser performance scales linearly", async () => {
    // Test that parsing time scales roughly linearly
    // Parse 10 agents
    const filePaths10 = await createAgentFiles(10);
    const { duration: duration10 } = await measureTime(async () => {
      for (const filePath of filePaths10) {
        await parser.parseFile(filePath);
      }
    });

    // Cleanup
    await rm(join(tempDir, ".github"), { recursive: true, force: true });

    // Parse 50 agents
    const filePaths50 = await createAgentFiles(50);
    const { duration: duration50 } = await measureTime(async () => {
      for (const filePath of filePaths50) {
        await parser.parseFile(filePath);
      }
    });

    // Calculate scaling factor
    const scalingFactor = duration50 / duration10;
    const expectedScaling = 50 / 10; // 5x

    // Allow 50% variance from linear scaling
    const minScaling = expectedScaling * 0.5;
    const maxScaling = expectedScaling * 1.5;

    console.log(
      `Parser scaling: 10 agents: ${duration10.toFixed(2)}ms, ` +
        `50 agents: ${duration50.toFixed(2)}ms, ` +
        `scaling factor: ${scalingFactor.toFixed(2)}x (expected: ${expectedScaling}x)`,
    );

    expect(scalingFactor).toBeGreaterThan(minScaling);
    expect(scalingFactor).toBeLessThan(maxScaling);
  });
});
