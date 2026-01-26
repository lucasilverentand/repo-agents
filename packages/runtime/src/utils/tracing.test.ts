import { describe, expect, it } from "bun:test";
import type { AgentDefinition } from "@repo-agents/types";
import {
  createTracer,
  ExecutionTracer,
  formatTraceTimeline,
  getTraceLevel,
  isTracingEnabled,
} from "./tracing";

describe("ExecutionTracer", () => {
  describe("constructor", () => {
    it("should create a trace with default config", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123");
      const trace = tracer.getTrace();

      expect(trace.agent_name).toBe("test-agent");
      expect(trace.workflow_run_id).toBe("run-123");
      expect(trace.level).toBe("summary");
      expect(trace.status).toBe("running");
      expect(trace.schema_version).toBe("1.0.0");
      expect(trace.trace_id).toBeDefined();
    });

    it("should create a trace with custom config", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
        retention: "30d",
      });
      const trace = tracer.getTrace();

      expect(trace.level).toBe("detailed");
      expect(trace.steps).toBeDefined();
      expect(trace.decisions).toBeDefined();
    });

    it("should initialize tool_calls array for debug level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "debug",
      });
      const trace = tracer.getTrace();

      expect(trace.level).toBe("debug");
      expect(trace.tool_calls).toBeDefined();
    });
  });

  describe("recordStep", () => {
    it("should update action counts for summary level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "summary",
      });

      tracer.recordStep("read", "src/file.ts", "success", 10);
      tracer.recordStep("read", "src/other.ts", "success", 15);
      tracer.recordStep("analyze", undefined, "success", 100);

      const trace = tracer.getTrace();
      expect(trace.summary.actions).toContain("read 2 times");
      expect(trace.summary.actions).toContain("analyze 1 time");
    });

    it("should record detailed steps for detailed level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordStep("read", "src/file.ts", "success", 10, { lines: 100 });

      const trace = tracer.getTrace();
      expect(trace.steps).toHaveLength(1);
      expect(trace.steps?.[0].action).toBe("read");
      expect(trace.steps?.[0].target).toBe("src/file.ts");
      expect(trace.steps?.[0].result).toBe("success");
      expect(trace.steps?.[0].duration_ms).toBe(10);
      expect(trace.steps?.[0].details).toEqual({ lines: 100 });
    });

    it("should not record detailed steps for summary level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "summary",
      });

      tracer.recordStep("read", "src/file.ts", "success", 10);

      const trace = tracer.getTrace();
      expect(trace.steps).toBeUndefined();
    });
  });

  describe("recordDecision", () => {
    it("should record decisions for detailed level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordDecision(
        "Should comment on line 45?",
        "Potential null pointer",
        "Yes, add suggestion",
        "No existing comment on this line",
      );

      const trace = tracer.getTrace();
      expect(trace.decisions).toHaveLength(1);
      expect(trace.decisions?.[0].question).toBe("Should comment on line 45?");
      expect(trace.decisions?.[0].output).toBe("Yes, add suggestion");
    });

    it("should not record decisions for summary level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "summary",
      });

      tracer.recordDecision("Question?", "Input", "Output");

      const trace = tracer.getTrace();
      expect(trace.decisions).toBeUndefined();
    });
  });

  describe("recordToolCall", () => {
    it("should update tool call counts", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "summary",
      });

      tracer.recordToolCall("Read", { path: "/file.ts" }, "success", 50);
      tracer.recordToolCall("Write", { path: "/file.ts" }, "failure", 100, "Permission denied");
      tracer.recordToolCall("Bash", { command: "ls" }, "success", 20);

      const trace = tracer.getTrace();
      expect(trace.summary.total_tool_calls).toBe(3);
      expect(trace.summary.successful_tool_calls).toBe(2);
      expect(trace.summary.failed_tool_calls).toBe(1);
    });

    it("should record detailed tool calls for debug level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "debug",
      });

      tracer.recordToolCall("Read", { path: "/file.ts" }, "success", 50);

      const trace = tracer.getTrace();
      expect(trace.tool_calls).toHaveLength(1);
      expect(trace.tool_calls?.[0].tool).toBe("Read");
      expect(trace.tool_calls?.[0].parameters).toEqual({ path: "/file.ts" });
    });

    it("should not record detailed tool calls for detailed level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordToolCall("Read", { path: "/file.ts" }, "success", 50);

      const trace = tracer.getTrace();
      expect(trace.tool_calls).toBeUndefined();
    });
  });

  describe("complete", () => {
    it("should finalize the trace", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123");

      tracer.recordStep("read", "file.ts", "success");
      const trace = tracer.complete("success");

      expect(trace.status).toBe("success");
      expect(trace.completed_at).toBeDefined();
      expect(trace.summary.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("should include raw output for debug level", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "debug",
      });

      const trace = tracer.complete("success", "Raw output here");

      expect(trace.raw_output).toBe("Raw output here");
    });
  });

  describe("redaction", () => {
    it("should redact secrets by default", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordStep("read", "config with password=secret123", "success");

      const trace = tracer.getTrace();
      expect(trace.steps?.[0].target).not.toContain("secret123");
      expect(trace.steps?.[0].target).toContain("[REDACTED]");
    });

    it("should redact GitHub tokens", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordStep("api", "Token: ghp_1234567890abcdef", "success");

      const trace = tracer.getTrace();
      expect(trace.steps?.[0].target).not.toContain("ghp_1234567890abcdef");
      expect(trace.steps?.[0].target).toContain("[REDACTED]");
    });

    it("should redact API keys", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
      });

      tracer.recordStep("api", "Key: sk-1234567890abcdef", "success");

      const trace = tracer.getTrace();
      expect(trace.steps?.[0].target).not.toContain("sk-1234567890abcdef");
      expect(trace.steps?.[0].target).toContain("[REDACTED]");
    });

    it("should apply custom redaction patterns", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
        redact: {
          patterns: ["customsecret\\d+"],
        },
      });

      tracer.recordStep("read", "Found customsecret12345 in file", "success");

      const trace = tracer.getTrace();
      expect(trace.steps?.[0].target).not.toContain("customsecret12345");
      expect(trace.steps?.[0].target).toContain("[REDACTED]");
    });

    it("should truncate long file contents", () => {
      const tracer = new ExecutionTracer("test-agent", "run-123", {
        level: "detailed",
        redact: {
          file_contents_over: 5,
        },
      });

      const longContent = "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8";
      tracer.recordStep("read", longContent, "success");

      const trace = tracer.getTrace();
      expect(trace.steps?.[0].target).toContain("[truncated");
      expect(trace.steps?.[0].target?.split("\n").length).toBeLessThanOrEqual(6);
    });
  });
});

describe("formatTraceTimeline", () => {
  it("should format a summary trace", () => {
    const tracer = new ExecutionTracer("test-agent", "run-123", {
      level: "summary",
    });

    tracer.recordStep("read", "file.ts", "success");
    tracer.recordStep("read", "other.ts", "success");
    tracer.recordToolCall("Read", {}, "success", 10);

    const trace = tracer.complete("success");
    const timeline = formatTraceTimeline(trace);

    expect(timeline).toContain("test-agent execution timeline");
    expect(timeline).toContain("summary");
    expect(timeline).toContain("read 2 times");
  });

  it("should format a detailed trace", () => {
    const tracer = new ExecutionTracer("test-agent", "run-123", {
      level: "detailed",
    });

    tracer.recordStep("read", "file.ts", "success", 10);
    tracer.recordStep("analyze", undefined, "success", 50);
    tracer.recordToolCall("Read", {}, "success", 10);
    tracer.recordToolCall("Bash", {}, "failure", 5);

    const trace = tracer.complete("success");
    const timeline = formatTraceTimeline(trace);

    expect(timeline).toContain("test-agent execution timeline");
    expect(timeline).toContain("read");
    expect(timeline).toContain("analyze");
    expect(timeline).toContain("1/2 successful");
  });
});

describe("createTracer", () => {
  it("should create a tracer with agent config", () => {
    const agent: AgentDefinition = {
      name: "test-agent",
      on: { issues: { types: ["opened"] } },
      tracing: { level: "detailed" },
      markdown: "",
    };

    const tracer = createTracer(agent, "run-123");
    const trace = tracer.getTrace();

    expect(trace.agent_name).toBe("test-agent");
    expect(trace.level).toBe("detailed");
  });

  it("should create a tracer with default config if no tracing specified", () => {
    const agent: AgentDefinition = {
      name: "test-agent",
      on: { issues: { types: ["opened"] } },
      markdown: "",
    };

    const tracer = createTracer(agent, "run-123");
    const trace = tracer.getTrace();

    expect(trace.level).toBe("summary");
  });
});

describe("isTracingEnabled", () => {
  it("should return true if tracing is configured", () => {
    const agent: AgentDefinition = {
      name: "test",
      on: {},
      tracing: { level: "detailed" },
      markdown: "",
    };

    expect(isTracingEnabled(agent)).toBe(true);
  });

  it("should return false if tracing is not configured", () => {
    const agent: AgentDefinition = {
      name: "test",
      on: {},
      markdown: "",
    };

    expect(isTracingEnabled(agent)).toBe(false);
  });
});

describe("getTraceLevel", () => {
  it("should return configured level", () => {
    const agent: AgentDefinition = {
      name: "test",
      on: {},
      tracing: { level: "debug" },
      markdown: "",
    };

    expect(getTraceLevel(agent)).toBe("debug");
  });

  it("should return summary as default", () => {
    const agent: AgentDefinition = {
      name: "test",
      on: {},
      markdown: "",
    };

    expect(getTraceLevel(agent)).toBe("summary");
  });
});
