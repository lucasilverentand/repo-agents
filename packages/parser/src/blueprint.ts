import { readFile } from "node:fs/promises";
import type {
  BlueprintDefinition,
  BlueprintInstance,
  BlueprintMetadata,
  ValidationError,
} from "@repo-agents/types";
import matter from "gray-matter";
import { z } from "zod";

/**
 * Schema for blueprint parameter definition
 */
const blueprintParameterSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["string", "number", "boolean", "array", "enum"]),
  default: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]).optional(),
  required: z.boolean().optional(),
  values: z.array(z.string()).optional(), // For enum type
});

/**
 * Schema for blueprint metadata
 */
const blueprintMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be semver format (e.g., 1.0.0)"),
  description: z.string().optional(),
  author: z.string().optional(),
  extends: z.string().optional(),
  parameters: z.array(blueprintParameterSchema).default([]),
});

/**
 * Schema for blueprint instance (agent that extends a blueprint)
 */
const blueprintInstanceSchema = z.object({
  extends: z.string().min(1),
  parameters: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
});

/**
 * Parse a blueprint definition file.
 */
export async function parseBlueprint(filePath: string): Promise<{
  blueprint?: BlueprintDefinition;
  errors: ValidationError[];
}> {
  let content: string;
  try {
    content = await readFile(filePath, "utf-8");
  } catch (error) {
    return {
      errors: [
        {
          field: "file",
          message: `Failed to read blueprint file: ${(error as Error).message}`,
          severity: "error",
        },
      ],
    };
  }

  return parseBlueprintContent(content);
}

/**
 * Parse blueprint content (for testing and internal use).
 */
export function parseBlueprintContent(content: string): {
  blueprint?: BlueprintDefinition;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  // Parse frontmatter
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

  // Check for blueprint metadata
  if (!parsed.data || !parsed.data.blueprint) {
    return {
      errors: [
        {
          field: "blueprint",
          message: "Blueprint metadata is required (blueprint: { name, version, ... })",
          severity: "error",
        },
      ],
    };
  }

  // Validate blueprint metadata
  const metadataResult = blueprintMetadataSchema.safeParse(parsed.data.blueprint);
  if (!metadataResult.success) {
    return {
      errors: metadataResult.error.issues.map((issue) => ({
        field: `blueprint.${issue.path.join(".")}`,
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }

  // Extract frontmatter template (everything except blueprint)
  const { blueprint: _metadata, ...frontmatterTemplate } = parsed.data;

  return {
    blueprint: {
      blueprint: metadataResult.data as BlueprintMetadata,
      frontmatter: frontmatterTemplate,
      markdown: parsed.content.trim(),
    },
    errors,
  };
}

/**
 * Parse an agent file that extends a blueprint.
 */
export function parseBlueprintInstance(frontmatter: Record<string, unknown>): {
  instance?: BlueprintInstance;
  errors: ValidationError[];
} {
  const result = blueprintInstanceSchema.safeParse(frontmatter);
  if (!result.success) {
    return {
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }

  return { instance: result.data, errors: [] };
}

/**
 * Apply parameters to a template string.
 * Supports {{ parameter_name }} syntax.
 */
export function applyTemplate(template: string, parameters: Record<string, unknown>): string {
  return template.replace(/\{\{\s*parameters\.(\w+)\s*\}\}/g, (_match, paramName) => {
    const value = parameters[paramName];
    if (value === undefined) {
      return `{{ parameters.${paramName} }}`; // Keep unresolved for error detection
    }
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Apply parameters to a template object (recursively).
 */
export function applyTemplateToObject(
  obj: Record<string, unknown>,
  parameters: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = applyTemplate(value, parameters);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") {
          return applyTemplate(item, parameters);
        }
        if (typeof item === "object" && item !== null) {
          return applyTemplateToObject(item as Record<string, unknown>, parameters);
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[key] = applyTemplateToObject(value as Record<string, unknown>, parameters);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Validate parameter values against blueprint definition.
 */
export function validateParameters(
  blueprint: BlueprintMetadata,
  providedParams: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required parameters
  for (const param of blueprint.parameters) {
    const value = providedParams[param.name];

    if (param.required && value === undefined && param.default === undefined) {
      errors.push({
        field: `parameters.${param.name}`,
        message: `Required parameter '${param.name}' is missing`,
        severity: "error",
      });
      continue;
    }

    if (value === undefined) continue;

    // Type validation
    switch (param.type) {
      case "string":
        if (typeof value !== "string") {
          errors.push({
            field: `parameters.${param.name}`,
            message: `Parameter '${param.name}' must be a string`,
            severity: "error",
          });
        }
        break;
      case "number":
        if (typeof value !== "number") {
          errors.push({
            field: `parameters.${param.name}`,
            message: `Parameter '${param.name}' must be a number`,
            severity: "error",
          });
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({
            field: `parameters.${param.name}`,
            message: `Parameter '${param.name}' must be a boolean`,
            severity: "error",
          });
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          errors.push({
            field: `parameters.${param.name}`,
            message: `Parameter '${param.name}' must be an array`,
            severity: "error",
          });
        }
        break;
      case "enum":
        if (!param.values?.includes(value as string)) {
          errors.push({
            field: `parameters.${param.name}`,
            message: `Parameter '${param.name}' must be one of: ${param.values?.join(", ")}`,
            severity: "error",
          });
        }
        break;
    }
  }

  return errors;
}

/**
 * Merge parameter values with defaults.
 */
export function mergeWithDefaults(
  blueprint: BlueprintMetadata,
  providedParams: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const param of blueprint.parameters) {
    if (providedParams[param.name] !== undefined) {
      merged[param.name] = providedParams[param.name];
    } else if (param.default !== undefined) {
      merged[param.name] = param.default;
    }
  }

  return merged;
}

/**
 * Resolve a blueprint source string to a file path or URL.
 * Supports:
 * - Local paths: ./blueprints/my-blueprint.md
 * - Catalog: catalog:standard-triage@v1
 * - GitHub: github.com/org/repo/path@version
 */
export function resolveBlueprintSource(
  source: string,
  basePath?: string,
): {
  type: "local" | "catalog" | "github";
  path: string;
  version?: string;
} {
  // Catalog source
  if (source.startsWith("catalog:")) {
    const [name, version] = source.replace("catalog:", "").split("@");
    return {
      type: "catalog",
      path: name,
      version: version || "latest",
    };
  }

  // GitHub source
  if (source.startsWith("github.com/") || source.includes("github.com/")) {
    const match = source.match(/github\.com\/([^@]+)(?:@(.+))?/);
    if (match) {
      return {
        type: "github",
        path: match[1],
        version: match[2],
      };
    }
  }

  // Local path
  if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
    const fullPath = basePath ? `${basePath}/${source.replace(/^\.\//, "")}` : source;
    return {
      type: "local",
      path: fullPath,
    };
  }

  // Default to local
  return {
    type: "local",
    path: source,
  };
}

/**
 * Check if content looks like it extends a blueprint.
 */
export function extendsBlueprint(frontmatter: Record<string, unknown>): boolean {
  return typeof frontmatter.extends === "string" && frontmatter.extends.length > 0;
}

/**
 * Check if content is a blueprint definition.
 */
export function isBlueprint(frontmatter: Record<string, unknown>): boolean {
  return typeof frontmatter.blueprint === "object" && frontmatter.blueprint !== null;
}
