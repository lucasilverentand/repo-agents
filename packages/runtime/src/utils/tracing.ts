import { randomUUID } from "node:crypto";
import type {
  AgentDefinition,
  ExecutionTrace,
  ToolCall,
  TraceDecision,
  TraceEntry,
  TraceLevel,
  TracingConfig,
} from "@repo-agents/types";

/**
 * Default tracing configuration
 */
const DEFAULT_TRACING_CONFIG: TracingConfig = {
  level: "summary",
  retention: "7d",
  include: ["tool-calls", "timing"],
  exclude: ["secrets"],
  redact: {
    secrets: true,
    file_contents_over: 100,
  },
};

/**
 * Patterns to redact from traces
 */
const SECRET_PATTERNS = [
  /password["\s:=]+["']?[^"'\s]+["']?/gi,
  /api[_-]?key["\s:=]+["']?[^"'\s]+["']?/gi,
  /token["\s:=]+["']?[^"'\s]+["']?/gi,
  /secret["\s:=]+["']?[^"'\s]+["']?/gi,
  /bearer\s+[a-zA-Z0-9\-_]+/gi,
  /ghp_[a-zA-Z0-9]+/g, // GitHub Personal Access Token
  /gho_[a-zA-Z0-9]+/g, // GitHub OAuth Token
  /ghs_[a-zA-Z0-9]+/g, // GitHub App Token
  /sk-[a-zA-Z0-9]+/g, // OpenAI/Anthropic API Key
];

/**
 * Execution tracer for tracking agent actions.
 */
export class ExecutionTracer {
  private trace: ExecutionTrace;
  private config: TracingConfig;
  private startTime: number;
  private actionCounts: Map<string, number> = new Map();

  constructor(agentName: string, workflowRunId: string, config?: TracingConfig) {
    this.config = { ...DEFAULT_TRACING_CONFIG, ...config };
    this.startTime = Date.now();

    this.trace = {
      schema_version: "1.0.0",
      trace_id: randomUUID(),
      agent_name: agentName,
      workflow_run_id: workflowRunId,
      level: this.config.level ?? "summary",
      started_at: new Date().toISOString(),
      status: "running",
      summary: {
        duration_ms: 0,
        actions: [],
        total_tool_calls: 0,
        successful_tool_calls: 0,
        failed_tool_calls: 0,
      },
    };

    // Initialize arrays for detailed/debug levels
    if (this.config.level === "detailed" || this.config.level === "debug") {
      this.trace.steps = [];
      this.trace.decisions = [];
    }

    if (this.config.level === "debug") {
      this.trace.tool_calls = [];
    }
  }

  /**
   * Record a step in the execution.
   */
  recordStep(
    action: string,
    target: string | undefined,
    result: "success" | "failure" | "skipped",
    durationMs?: number,
    details?: Record<string, unknown>,
  ): void {
    // Update action counts for summary
    const currentCount = this.actionCounts.get(action) ?? 0;
    this.actionCounts.set(action, currentCount + 1);

    // Only record detailed steps if level is detailed or debug
    if (this.config.level === "detailed" || this.config.level === "debug") {
      const entry: TraceEntry = {
        timestamp: new Date().toISOString(),
        elapsed_ms: Date.now() - this.startTime,
        action,
        target: this.redactSensitive(target),
        result,
        duration_ms: durationMs,
        details: details ? this.redactObject(details) : undefined,
      };

      this.trace.steps?.push(entry);
    }
  }

  /**
   * Record a decision made during execution.
   */
  recordDecision(question: string, input: string, output: string, reasoning?: string): void {
    if (this.config.level === "detailed" || this.config.level === "debug") {
      const decision: TraceDecision = {
        timestamp: new Date().toISOString(),
        question,
        input: this.redactSensitive(input) ?? "",
        output: this.redactSensitive(output) ?? "",
        reasoning: reasoning ? this.redactSensitive(reasoning) : undefined,
      };

      this.trace.decisions?.push(decision);
    }
  }

  /**
   * Record a tool call.
   */
  recordToolCall(
    tool: string,
    parameters: Record<string, unknown>,
    result: "success" | "failure",
    durationMs: number,
    error?: string,
  ): void {
    this.trace.summary.total_tool_calls++;
    if (result === "success") {
      this.trace.summary.successful_tool_calls++;
    } else {
      this.trace.summary.failed_tool_calls++;
    }

    // Only record detailed tool calls if level is debug
    if (this.config.level === "debug") {
      const toolCall: ToolCall = {
        timestamp: new Date().toISOString(),
        tool,
        parameters: this.redactObject(parameters),
        result,
        duration_ms: durationMs,
        error: error ? this.redactSensitive(error) : undefined,
      };

      this.trace.tool_calls?.push(toolCall);
    }
  }

  /**
   * Complete the trace with final status.
   */
  complete(status: "success" | "failure" | "cancelled", rawOutput?: string): ExecutionTrace {
    this.trace.status = status;
    this.trace.completed_at = new Date().toISOString();
    this.trace.summary.duration_ms = Date.now() - this.startTime;

    // Generate action summary
    this.trace.summary.actions = Array.from(this.actionCounts.entries()).map(
      ([action, count]) => `${action} ${count} ${count === 1 ? "time" : "times"}`,
    );

    // Add raw output if debug level
    if (this.config.level === "debug" && rawOutput) {
      this.trace.raw_output = this.redactSensitive(rawOutput);
    }

    return this.trace;
  }

  /**
   * Get the current trace state.
   */
  getTrace(): ExecutionTrace {
    return {
      ...this.trace,
      summary: {
        ...this.trace.summary,
        duration_ms: Date.now() - this.startTime,
        actions: Array.from(this.actionCounts.entries()).map(
          ([action, count]) => `${action} ${count} ${count === 1 ? "time" : "times"}`,
        ),
      },
    };
  }

  /**
   * Get the trace ID.
   */
  getTraceId(): string {
    return this.trace.trace_id;
  }

  /**
   * Redact sensitive information from a string.
   */
  private redactSensitive(value: string | undefined): string | undefined {
    if (!value) return value;

    let redacted = value;

    // Apply built-in secret patterns if secrets redaction is enabled
    if (this.config.redact?.secrets !== false) {
      for (const pattern of SECRET_PATTERNS) {
        redacted = redacted.replace(pattern, "[REDACTED]");
      }
    }

    // Apply custom patterns
    if (this.config.redact?.patterns) {
      for (const pattern of this.config.redact.patterns) {
        try {
          const regex = new RegExp(pattern, "gi");
          redacted = redacted.replace(regex, "[REDACTED]");
        } catch {
          // Invalid regex, skip
        }
      }
    }

    // Truncate file contents if configured
    if (this.config.redact?.file_contents_over) {
      const lines = redacted.split("\n");
      if (lines.length > this.config.redact.file_contents_over) {
        redacted =
          lines.slice(0, this.config.redact.file_contents_over).join("\n") +
          `\n... [truncated ${lines.length - this.config.redact.file_contents_over} lines]`;
      }
    }

    return redacted;
  }

  /**
   * Redact sensitive information from an object.
   */
  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        redacted[key] = this.redactSensitive(value);
      } else if (typeof value === "object" && value !== null) {
        redacted[key] = this.redactObject(value as Record<string, unknown>);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }
}

/**
 * Format a trace as a timeline string for display.
 */
export function formatTraceTimeline(trace: ExecutionTrace): string {
  const lines: string[] = [];

  lines.push(`${trace.agent_name} execution timeline:`);
  lines.push("");

  if (!trace.steps || trace.steps.length === 0) {
    lines.push("No detailed steps recorded (trace level: summary)");
    lines.push("");
    lines.push("Summary:");
    for (const action of trace.summary.actions) {
      lines.push(`  - ${action}`);
    }
    return lines.join("\n");
  }

  // Format each step as a timeline entry
  for (const step of trace.steps) {
    const elapsed = formatElapsed(step.elapsed_ms);
    const status = step.result === "success" ? "✓" : step.result === "failure" ? "✗" : "○";
    const duration = step.duration_ms ? ` (${step.duration_ms}ms)` : "";
    const target = step.target ? ` ${step.target}` : "";

    lines.push(`${elapsed} ─── ${status} ${step.action}${target}${duration}`);
  }

  lines.push("");
  lines.push(`Total duration: ${formatElapsed(trace.summary.duration_ms)}`);
  lines.push(
    `Tool calls: ${trace.summary.successful_tool_calls}/${trace.summary.total_tool_calls} successful`,
  );

  return lines.join("\n");
}

/**
 * Format milliseconds as a human-readable time string.
 */
function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `0:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Create a tracer for an agent based on its configuration.
 */
export function createTracer(agent: AgentDefinition, workflowRunId: string): ExecutionTracer {
  return new ExecutionTracer(agent.name, workflowRunId, agent.tracing);
}

/**
 * Check if tracing is enabled for the agent.
 */
export function isTracingEnabled(agent: AgentDefinition): boolean {
  return agent.tracing !== undefined;
}

/**
 * Get the trace level for an agent.
 */
export function getTraceLevel(agent: AgentDefinition): TraceLevel {
  return agent.tracing?.level ?? "summary";
}
