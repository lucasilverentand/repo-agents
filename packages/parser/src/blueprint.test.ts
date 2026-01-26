import { describe, expect, test } from "bun:test";
import type { BlueprintMetadata } from "@repo-agents/types";
import {
  applyTemplate,
  applyTemplateToObject,
  extendsBlueprint,
  isBlueprint,
  mergeWithDefaults,
  parseBlueprintContent,
  parseBlueprintInstance,
  resolveBlueprintSource,
  validateParameters,
} from "./blueprint";

describe("parseBlueprintContent", () => {
  test("should parse valid blueprint content", () => {
    const content = `---
blueprint:
  name: triage-blueprint
  version: "1.0.0"
  description: A blueprint for triage agents
  parameters:
    - name: priority_labels
      type: array
      default: ["high", "medium", "low"]
    - name: response_time
      type: number
      default: 24
name: triage-agent
on:
  issues:
    types: [opened]
---

You are a triage agent. Use these priority labels: {{ parameters.priority_labels }}
Respond within {{ parameters.response_time }} hours.
`;

    const result = parseBlueprintContent(content);

    expect(result.errors).toHaveLength(0);
    expect(result.blueprint).toBeDefined();
    expect(result.blueprint!.blueprint.name).toBe("triage-blueprint");
    expect(result.blueprint!.blueprint.version).toBe("1.0.0");
    expect(result.blueprint!.blueprint.parameters).toHaveLength(2);
    expect(result.blueprint!.frontmatter.name).toBe("triage-agent");
    expect(result.blueprint!.markdown).toContain("{{ parameters.priority_labels }}");
  });

  test("should return error for missing blueprint metadata", () => {
    const content = `---
name: triage-agent
on:
  issues:
    types: [opened]
---

Some content
`;

    const result = parseBlueprintContent(content);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].field).toBe("blueprint");
    expect(result.errors[0].message).toContain("required");
  });

  test("should return error for invalid version format", () => {
    const content = `---
blueprint:
  name: test
  version: "v1"
---

Content
`;

    const result = parseBlueprintContent(content);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].message).toContain("semver");
  });

  test("should handle blueprint with enum parameter", () => {
    const content = `---
blueprint:
  name: enum-blueprint
  version: "1.0.0"
  parameters:
    - name: severity
      type: enum
      values: ["low", "medium", "high", "critical"]
      default: medium
---

Content
`;

    const result = parseBlueprintContent(content);

    expect(result.errors).toHaveLength(0);
    expect(result.blueprint!.blueprint.parameters[0].values).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });
});

describe("parseBlueprintInstance", () => {
  test("should parse valid instance", () => {
    const frontmatter = {
      extends: "./blueprints/triage.md",
      parameters: {
        priority_labels: ["urgent", "normal"],
        response_time: 12,
      },
    };

    const result = parseBlueprintInstance(frontmatter);

    expect(result.errors).toHaveLength(0);
    expect(result.instance).toBeDefined();
    expect(result.instance!.extends).toBe("./blueprints/triage.md");
    expect(result.instance!.parameters).toEqual({
      priority_labels: ["urgent", "normal"],
      response_time: 12,
    });
  });

  test("should return error for missing extends", () => {
    const frontmatter = {
      parameters: { foo: "bar" },
    };

    const result = parseBlueprintInstance(frontmatter);

    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("applyTemplate", () => {
  test("should replace parameter placeholders", () => {
    const template = "Use these labels: {{ parameters.labels }}";
    const params = { labels: "bug,feature" };

    const result = applyTemplate(template, params);

    expect(result).toBe("Use these labels: bug,feature");
  });

  test("should handle array parameters", () => {
    const template = "Labels: {{ parameters.labels }}";
    const params = { labels: ["bug", "feature", "enhancement"] };

    const result = applyTemplate(template, params);

    expect(result).toBe('Labels: ["bug","feature","enhancement"]');
  });

  test("should preserve unresolved placeholders", () => {
    const template = "{{ parameters.defined }} and {{ parameters.undefined }}";
    const params = { defined: "value" };

    const result = applyTemplate(template, params);

    expect(result).toBe("value and {{ parameters.undefined }}");
  });

  test("should handle multiple occurrences", () => {
    const template = "{{ parameters.name }} is {{ parameters.name }}";
    const params = { name: "Claude" };

    const result = applyTemplate(template, params);

    expect(result).toBe("Claude is Claude");
  });

  test("should handle whitespace variations", () => {
    const template = "{{parameters.a}} {{ parameters.b }} {{  parameters.c  }}";
    const params = { a: "1", b: "2", c: "3" };

    const result = applyTemplate(template, params);

    expect(result).toBe("1 2 3");
  });
});

describe("applyTemplateToObject", () => {
  test("should recursively apply templates to object", () => {
    const obj = {
      name: "{{ parameters.name }}",
      config: {
        timeout: "{{ parameters.timeout }}",
        labels: ["{{ parameters.label1 }}", "{{ parameters.label2 }}"],
      },
    };
    const params = { name: "agent", timeout: "30", label1: "bug", label2: "feature" };

    const result = applyTemplateToObject(obj, params);

    expect(result).toEqual({
      name: "agent",
      config: {
        timeout: "30",
        labels: ["bug", "feature"],
      },
    });
  });

  test("should preserve non-string values", () => {
    const obj = {
      count: 5,
      enabled: true,
      name: "{{ parameters.name }}",
    };
    const params = { name: "test" };

    const result = applyTemplateToObject(obj, params);

    expect(result.count).toBe(5);
    expect(result.enabled).toBe(true);
    expect(result.name).toBe("test");
  });
});

describe("validateParameters", () => {
  const blueprint: BlueprintMetadata = {
    name: "test",
    version: "1.0.0",
    parameters: [
      { name: "required_string", type: "string", required: true },
      { name: "optional_number", type: "number" },
      { name: "with_default", type: "string", default: "default_value" },
      { name: "enum_param", type: "enum", values: ["a", "b", "c"] },
      { name: "array_param", type: "array" },
      { name: "bool_param", type: "boolean" },
    ],
  };

  test("should validate required parameters", () => {
    const errors = validateParameters(blueprint, {});

    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("parameters.required_string");
    expect(errors[0].message).toContain("Required");
  });

  test("should accept valid parameter types", () => {
    const errors = validateParameters(blueprint, {
      required_string: "hello",
      optional_number: 42,
      enum_param: "b",
      array_param: ["x", "y"],
      bool_param: true,
    });

    expect(errors).toHaveLength(0);
  });

  test("should reject invalid enum value", () => {
    const errors = validateParameters(blueprint, {
      required_string: "test",
      enum_param: "invalid",
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("parameters.enum_param");
    expect(errors[0].message).toContain("must be one of");
  });

  test("should reject wrong parameter types", () => {
    const errors = validateParameters(blueprint, {
      required_string: 123, // should be string
      optional_number: "not a number", // should be number
    });

    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  test("should not require parameter with default", () => {
    const errors = validateParameters(blueprint, {
      required_string: "test",
    });

    expect(errors).toHaveLength(0);
  });
});

describe("mergeWithDefaults", () => {
  const blueprint: BlueprintMetadata = {
    name: "test",
    version: "1.0.0",
    parameters: [
      { name: "with_default", type: "string", default: "default_value" },
      { name: "no_default", type: "string" },
      { name: "number_default", type: "number", default: 100 },
    ],
  };

  test("should use provided values over defaults", () => {
    const result = mergeWithDefaults(blueprint, {
      with_default: "custom_value",
    });

    expect(result.with_default).toBe("custom_value");
  });

  test("should fill in defaults for missing values", () => {
    const result = mergeWithDefaults(blueprint, {});

    expect(result.with_default).toBe("default_value");
    expect(result.number_default).toBe(100);
    expect(result.no_default).toBeUndefined();
  });
});

describe("resolveBlueprintSource", () => {
  test("should resolve catalog source", () => {
    const result = resolveBlueprintSource("catalog:standard-triage@v1");

    expect(result.type).toBe("catalog");
    expect(result.path).toBe("standard-triage");
    expect(result.version).toBe("v1");
  });

  test("should resolve catalog source without version", () => {
    const result = resolveBlueprintSource("catalog:my-blueprint");

    expect(result.type).toBe("catalog");
    expect(result.path).toBe("my-blueprint");
    expect(result.version).toBe("latest");
  });

  test("should resolve GitHub source", () => {
    const result = resolveBlueprintSource("github.com/org/repo/blueprints/triage.md@v2.0.0");

    expect(result.type).toBe("github");
    expect(result.path).toBe("org/repo/blueprints/triage.md");
    expect(result.version).toBe("v2.0.0");
  });

  test("should resolve local relative path", () => {
    const result = resolveBlueprintSource("./blueprints/triage.md");

    expect(result.type).toBe("local");
    expect(result.path).toBe("./blueprints/triage.md");
  });

  test("should resolve local path with base path", () => {
    const result = resolveBlueprintSource("./triage.md", "/repo/.github/agents");

    expect(result.type).toBe("local");
    expect(result.path).toBe("/repo/.github/agents/triage.md");
  });

  test("should resolve absolute path", () => {
    const result = resolveBlueprintSource("/absolute/path/blueprint.md");

    expect(result.type).toBe("local");
    expect(result.path).toBe("/absolute/path/blueprint.md");
  });
});

describe("extendsBlueprint", () => {
  test("should return true for frontmatter with extends", () => {
    expect(extendsBlueprint({ extends: "./blueprint.md" })).toBe(true);
  });

  test("should return false for empty extends", () => {
    expect(extendsBlueprint({ extends: "" })).toBe(false);
  });

  test("should return false for missing extends", () => {
    expect(extendsBlueprint({ name: "agent" })).toBe(false);
  });

  test("should return false for non-string extends", () => {
    expect(extendsBlueprint({ extends: 123 })).toBe(false);
  });
});

describe("isBlueprint", () => {
  test("should return true for frontmatter with blueprint object", () => {
    expect(isBlueprint({ blueprint: { name: "test", version: "1.0.0" } })).toBe(true);
  });

  test("should return false for missing blueprint", () => {
    expect(isBlueprint({ name: "agent" })).toBe(false);
  });

  test("should return false for null blueprint", () => {
    expect(isBlueprint({ blueprint: null })).toBe(false);
  });

  test("should return false for non-object blueprint", () => {
    expect(isBlueprint({ blueprint: "string" })).toBe(false);
  });
});
