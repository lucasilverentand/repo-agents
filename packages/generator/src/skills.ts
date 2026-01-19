import type { Output, OutputConfig } from "@repo-agents/types";
import { getOutputHandler } from "./outputs";

/**
 * Generates the "Available Operations" section for Claude based on enabled outputs.
 * This section documents what operations Claude can perform and how to use them.
 */
export function generateSkillsSection(
  outputs: Record<string, OutputConfig | boolean> | undefined,
  allowedPaths?: string[],
): string {
  if (!outputs || Object.keys(outputs).length === 0) {
    return "";
  }

  const skillDocs = Object.entries(outputs)
    .map(([output, config]) =>
      generateSkillForOutput(
        output as Output,
        typeof config === "object" ? config : {},
        allowedPaths,
      ),
    )
    .join("\n\n");

  return `
---
# Available Operations

You are authorized to perform the following operations in this workflow. Use these operations to complete your assigned task.

${skillDocs}
`;
}

/**
 * Generates documentation for a specific output type using the output handler
 */
export function generateSkillForOutput(
  output: Output,
  config: OutputConfig | Record<string, never>,
  _allowedPaths?: string[],
): string {
  try {
    const handler = getOutputHandler(output);
    return handler.generateSkill(config);
  } catch (error) {
    console.error(`Failed to generate skill for output ${output}:`, error);
    return "";
  }
}
