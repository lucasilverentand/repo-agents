import { readFile } from "node:fs/promises";
import type { AgentDefinition, ValidationError } from "@repo-agents/types";
import matter from "gray-matter";
import { ZodError } from "zod";
import { type AgentFrontmatter, agentFrontmatterSchema } from "./schemas";

export class AgentParser {
  async parseFile(filePath: string): Promise<{
    agent?: AgentDefinition;
    errors: ValidationError[];
  }> {
    try {
      const content = await readFile(filePath, "utf-8");
      return this.parseContent(content);
    } catch (error) {
      return {
        errors: [
          {
            field: "file",
            message: `Failed to read file: ${(error as Error).message}`,
            severity: "error",
          },
        ],
      };
    }
  }

  parseContent(content: string): {
    agent?: AgentDefinition;
    errors: ValidationError[];
  } {
    const errors: ValidationError[] = [];

    let parsed: ReturnType<typeof matter>;
    try {
      parsed = matter(content);
    } catch (error) {
      return {
        errors: [
          {
            field: "frontmatter",
            message: `Failed to parse frontmatter: ${(error as Error).message}`,
            severity: "error",
          },
        ],
      };
    }

    if (!parsed.data || Object.keys(parsed.data).length === 0) {
      return {
        errors: [
          {
            field: "frontmatter",
            message: "Frontmatter is required",
            severity: "error",
          },
        ],
      };
    }

    let frontmatter: AgentFrontmatter;
    try {
      frontmatter = agentFrontmatterSchema.parse(parsed.data);
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          errors: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
            severity: "error" as const,
          })),
        };
      }
      throw error;
    }

    if (!parsed.content || parsed.content.trim().length === 0) {
      errors.push({
        field: "markdown",
        message: "Agent instructions (markdown body) are required",
        severity: "warning",
      });
    }

    const agent: AgentDefinition = {
      name: frontmatter.name,
      on: frontmatter.on,
      permissions: frontmatter.permissions,
      provider: frontmatter.provider,
      outputs: frontmatter.outputs,
      tools: frontmatter.tools,
      allowed_actors: frontmatter["allowed-actors"],
      allowed_users: frontmatter["allowed-users"],
      allowed_teams: frontmatter["allowed-teams"],
      allowed_paths: frontmatter["allowed-paths"],
      trigger_labels: frontmatter.trigger_labels,
      max_open_prs: frontmatter.max_open_prs,
      rate_limit_minutes: frontmatter.rate_limit_minutes,
      context: frontmatter.context,
      audit: frontmatter.audit,
      markdown: parsed.content.trim(),
    };

    return { agent, errors };
  }

  validateAgent(agent: AgentDefinition): ValidationError[] {
    const errors: ValidationError[] = [];
    const outputTypes = agent.outputs ? Object.keys(agent.outputs) : [];

    if (
      outputTypes.includes("update-file") &&
      (!agent.allowed_paths || agent.allowed_paths.length === 0)
    ) {
      errors.push({
        field: "outputs",
        message: "update-file requires allowed-paths to be specified",
        severity: "error",
      });
    }

    const outputsRequiringContentsWrite = ["create-pr", "update-file"];
    for (const outputType of outputsRequiringContentsWrite) {
      if (outputTypes.includes(outputType) && agent.permissions?.contents !== "write") {
        errors.push({
          field: "permissions",
          message: `${outputType} requires contents: write permission`,
          severity: "error",
        });
      }
    }

    const hasTrigger =
      agent.on.issues ||
      agent.on.pull_request ||
      agent.on.discussion ||
      agent.on.repository_dispatch ||
      agent.on.schedule ||
      agent.on.workflow_dispatch;

    if (!hasTrigger) {
      errors.push({
        field: "on",
        message: "At least one trigger must be specified",
        severity: "error",
      });
    }

    return errors;
  }
}

export const agentParser = new AgentParser();

export type { AgentFrontmatter } from "./schemas";
// Re-export schema types
export { agentFrontmatterSchema } from "./schemas";
