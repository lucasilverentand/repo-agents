import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentParser } from "./index";

describe("AgentParser", () => {
  let parser: AgentParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new AgentParser();
    tempDir = mkdtempSync(join(tmpdir(), "parser-test-"));
  });

  describe("parseContent", () => {
    describe("valid agent definitions", () => {
      it("should parse minimal valid agent with issue trigger", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.name).toBe("Test Agent");
        expect(result.agent?.on.issues?.types).toEqual(["opened"]);
        expect(result.agent?.markdown).toBe("Test instructions");
        expect(result.errors).toHaveLength(0);
      });

      it("should parse agent with pull_request trigger", () => {
        const content = `---
name: PR Agent
on:
  pull_request:
    types: [opened, synchronize]
---

PR instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.pull_request?.types).toEqual(["opened", "synchronize"]);
      });

      it("should parse agent with discussion trigger", () => {
        const content = `---
name: Discussion Agent
on:
  discussion:
    types: [created]
---

Discussion instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.discussion?.types).toEqual(["created"]);
      });

      it("should parse agent with schedule trigger", () => {
        const content = `---
name: Scheduled Agent
on:
  schedule:
    - cron: "0 0 * * *"
    - cron: "0 12 * * *"
---

Scheduled instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.schedule).toHaveLength(2);
        expect(result.agent?.on.schedule?.[0].cron).toBe("0 0 * * *");
      });

      it("should parse agent with workflow_dispatch trigger", () => {
        const content = `---
name: Manual Agent
on:
  workflow_dispatch:
    inputs:
      environment:
        description: Target environment
        required: true
        type: choice
        options: [dev, staging, prod]
---

Manual instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.workflow_dispatch).toBeDefined();
        expect(result.agent?.on.workflow_dispatch?.inputs?.environment).toBeDefined();
      });

      it("should parse agent with repository_dispatch trigger", () => {
        const content = `---
name: Dispatch Agent
on:
  repository_dispatch:
    types: [custom-event]
---

Dispatch instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.repository_dispatch?.types).toEqual(["custom-event"]);
      });

      it("should parse agent with multiple triggers", () => {
        const content = `---
name: Multi-Trigger Agent
on:
  issues:
    types: [opened]
  pull_request:
    types: [opened]
---

Multi-trigger instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.issues).toBeDefined();
        expect(result.agent?.on.pull_request).toBeDefined();
      });

      it("should parse agent with permissions", () => {
        const content = `---
name: Permissions Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
  issues: write
  pull_requests: read
  discussions: read
---

Permissions test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.permissions?.contents).toBe("write");
        expect(result.agent?.permissions?.issues).toBe("write");
        expect(result.agent?.permissions?.pull_requests).toBe("read");
        expect(result.agent?.permissions?.discussions).toBe("read");
      });

      it("should parse agent with outputs", () => {
        const content = `---
name: Output Agent
on:
  issues:
    types: [opened]
outputs:
  add-comment: true
  add-label:
    max: 5
  create-pr:
    sign: true
---

Output test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.outputs?.["add-comment"]).toBe(true);
        expect(result.agent?.outputs?.["add-label"]).toEqual({ max: 5 });
        expect(result.agent?.outputs?.["create-pr"]).toEqual({ sign: true });
      });

      it("should parse agent with allowed-users", () => {
        const content = `---
name: User Access Agent
on:
  issues:
    types: [opened]
allowed-users:
  - user1
  - user2
---

User access test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.allowed_users).toEqual(["user1", "user2"]);
      });

      it("should parse agent with allowed-actors", () => {
        const content = `---
name: Actor Access Agent
on:
  issues:
    types: [opened]
allowed-actors:
  - actor1
  - actor2
---

Actor access test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.allowed_actors).toEqual(["actor1", "actor2"]);
      });

      it("should parse agent with allowed-teams", () => {
        const content = `---
name: Team Access Agent
on:
  issues:
    types: [opened]
allowed-teams:
  - team1
  - team2
---

Team access test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.allowed_teams).toEqual(["team1", "team2"]);
      });

      it("should parse agent with allowed-paths", () => {
        const content = `---
name: Path Agent
on:
  issues:
    types: [opened]
allowed-paths:
  - src/**/*.ts
  - docs/**/*.md
---

Path test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.allowed_paths).toEqual(["src/**/*.ts", "docs/**/*.md"]);
      });

      it("should parse agent with trigger_labels", () => {
        const content = `---
name: Label Trigger Agent
on:
  issues:
    types: [labeled]
trigger_labels:
  - bug
  - critical
---

Label trigger test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.trigger_labels).toEqual(["bug", "critical"]);
      });

      it("should parse agent with max_open_prs", () => {
        const content = `---
name: PR Limit Agent
on:
  issues:
    types: [opened]
max_open_prs: 3
---

PR limit test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.max_open_prs).toBe(3);
      });

      it("should parse agent with rate_limit_minutes", () => {
        const content = `---
name: Rate Limit Agent
on:
  issues:
    types: [opened]
rate_limit_minutes: 15
---

Rate limit test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.rate_limit_minutes).toBe(15);
      });

      it("should parse agent with single invocation trigger", () => {
        const content = `---
name: Review Agent
on:
  invocation:
    command: review
    description: "Performs code review"
---

Review instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.on.invocation).toBeDefined();
        const invocation = result.agent?.on.invocation;
        if (!Array.isArray(invocation)) {
          expect(invocation?.command).toBe("review");
          expect(invocation?.description).toBe("Performs code review");
        }
      });

      it("should parse agent with multiple invocation triggers", () => {
        const content = `---
name: Multi Invoke Agent
on:
  invocation:
    - command: review
      description: "Full code review"
    - command: quick-review
      description: "Quick review"
      aliases: ["/cr", "/qr"]
---

Instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        const invocations = result.agent?.on.invocation;
        expect(Array.isArray(invocations)).toBe(true);
        if (Array.isArray(invocations)) {
          expect(invocations).toHaveLength(2);
          expect(invocations[0].command).toBe("review");
          expect(invocations[1].command).toBe("quick-review");
          expect(invocations[1].aliases).toEqual(["/cr", "/qr"]);
        }
      });

      it("should parse agent with invocation access control", () => {
        const content = `---
name: Protected Agent
on:
  invocation:
    command: deploy
    allowed_users: [admin1, admin2]
    allowed_teams: [devops]
---

Deploy instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        const invocation = result.agent?.on.invocation;
        if (!Array.isArray(invocation)) {
          expect(invocation?.command).toBe("deploy");
          expect(invocation?.allowed_users).toEqual(["admin1", "admin2"]);
          expect(invocation?.allowed_teams).toEqual(["devops"]);
        }
      });

      it("should parse agent with context configuration", () => {
        const content = `---
name: Context Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  issues:
    states: [open]
    limit: 50
  pull_requests:
    states: [open, merged]
    limit: 25
  stars: true
  forks: true
  since: "24h"
  min_items: 5
---

Context test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.context?.issues?.states).toEqual(["open"]);
        expect(result.agent?.context?.issues?.limit).toBe(50);
        expect(result.agent?.context?.pull_requests?.limit).toBe(25);
        expect(result.agent?.context?.stars).toBe(true);
        expect(result.agent?.context?.forks).toBe(true);
        expect(result.agent?.context?.since).toBe("24h");
        expect(result.agent?.context?.min_items).toBe(5);
      });

      it("should parse agent with audit configuration", () => {
        const content = `---
name: Audit Agent
on:
  issues:
    types: [opened]
audit:
  create_issues: true
  labels: [bot, audit]
  assignees: [admin]
---

Audit test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.audit?.create_issues).toBe(true);
        expect(result.agent?.audit?.labels).toEqual(["bot", "audit"]);
        expect(result.agent?.audit?.assignees).toEqual(["admin"]);
      });

      it("should parse agent with provider", () => {
        const content = `---
name: OpenCode Agent
on:
  issues:
    types: [opened]
provider: opencode
---

Provider test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.provider).toBe("opencode");
      });

      it("should parse agent with tools", () => {
        const content = `---
name: Tools Agent
on:
  issues:
    types: [opened]
tools:
  - name: custom-tool
    description: A custom tool
    parameters:
      param1: value1
---

Tools test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.tools).toHaveLength(1);
        expect(result.agent?.tools?.[0].name).toBe("custom-tool");
      });

      it("should handle whitespace in markdown body", () => {
        const content = `---
name: Whitespace Agent
on:
  issues:
    types: [opened]
---

  Test instructions with leading whitespace
`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.markdown).toBe("Test instructions with leading whitespace");
      });
    });

    describe("error handling - frontmatter parsing", () => {
      it("should error on malformed YAML frontmatter", () => {
        const content = `---
name: Test Agent
on:
  issues: [opened
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe("frontmatter");
        expect(result.errors[0].message).toContain("Failed to parse frontmatter");
        expect(result.errors[0].severity).toBe("error");
      });

      it("should error on missing frontmatter", () => {
        const content = "Just markdown content without frontmatter";

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe("frontmatter");
        expect(result.errors[0].message).toBe("Frontmatter is required");
      });

      it("should error on empty frontmatter", () => {
        const content = `---
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe("frontmatter");
        expect(result.errors[0].message).toBe("Frontmatter is required");
      });
    });

    describe("error handling - schema validation", () => {
      it("should error on missing name field", () => {
        const content = `---
on:
  issues:
    types: [opened]
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field === "name")).toBe(true);
        expect(result.errors[0].severity).toBe("error");
      });

      it("should error on empty name field", () => {
        const content = `---
name: ""
on:
  issues:
    types: [opened]
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.message.includes("name"))).toBe(true);
      });

      it("should error on missing on field", () => {
        const content = `---
name: Test Agent
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field === "on")).toBe(true);
      });

      it("should error on invalid permission value", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: invalid
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("permissions"))).toBe(true);
      });

      it("should error on invalid output type", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
outputs:
  invalid-output: true
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("outputs"))).toBe(true);
      });

      it("should error on invalid provider", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
provider: invalid-provider
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("provider"))).toBe(true);
      });

      it("should error on unknown property", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
unknown_field: value
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should error on invalid schedule cron", () => {
        const content = `---
name: Test Agent
on:
  schedule: invalid
---

Test instructions`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("schedule"))).toBe(true);
      });

      it("should handle Zod errors with nested paths", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: invalid-value
  issues: also-invalid
---

Test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("permissions"))).toBe(true);
        expect(result.errors.every((e) => e.severity === "error")).toBe(true);
      });

      it("should map Zod error paths correctly", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
context:
  issues:
    limit: -1
---

Test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.field.includes("context"))).toBe(true);
      });
    });

    describe("markdown body validation", () => {
      it("should warn on empty markdown body", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe("markdown");
        expect(result.errors[0].message).toContain("required");
        expect(result.errors[0].severity).toBe("warning");
      });

      it("should warn on whitespace-only markdown body", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---



`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].severity).toBe("warning");
      });

      it("should accept agent with valid markdown body", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

# Valid Markdown

This is valid markdown content with proper instructions.
`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.errors).toHaveLength(0);
        expect(result.agent?.markdown).toContain("Valid Markdown");
      });
    });

    describe("edge cases", () => {
      it("should handle markdown with frontmatter delimiters in body", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Here's how to use YAML:
\`\`\`yaml
---
key: value
---
\`\`\`
`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.markdown).toContain("```yaml");
      });

      it("should handle unicode in name and markdown", () => {
        const content = `---
name: Test Agent 🤖
on:
  issues:
    types: [opened]
---

Unicode instructions: 你好 мир 🌍`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.name).toBe("Test Agent 🤖");
        expect(result.agent?.markdown).toContain("🌍");
      });

      it("should handle very long markdown content", () => {
        const longMarkdown = `# Instructions\n\n${"This is a test line.\n".repeat(1000)}`;
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

${longMarkdown}`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(result.agent?.markdown.length).toBeGreaterThan(10000);
      });

      it("should handle all output types", () => {
        const content = `---
name: All Outputs Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
  issues: write
  pull_requests: write
  discussions: write
allowed-paths:
  - "**/*"
outputs:
  add-comment: true
  add-label: true
  remove-label: true
  create-issue: true
  create-discussion: true
  create-pr: true
  update-file: true
  close-issue: true
  close-pr: true
  assign-issue: true
  request-review: true
  merge-pr: true
  approve-pr: true
  create-release: true
  delete-branch: true
  lock-conversation: true
  pin-issue: true
  convert-to-discussion: true
  edit-issue: true
  reopen-issue: true
  set-milestone: true
  trigger-workflow: true
  add-reaction: true
  create-branch: true
---

All outputs test`;

        const result = parser.parseContent(content);

        expect(result.agent).toBeDefined();
        expect(Object.keys(result.agent?.outputs || {})).toHaveLength(24);
      });
    });
  });

  describe("validateAgent", () => {
    describe("output validation rules", () => {
      it("should error when update-file output has no allowed-paths", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
---

Test`;

        const result = parser.parseContent(content);
        expect(result.agent).toBeDefined();

        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("outputs");
        expect(errors[0].message).toContain("update-file requires allowed-paths");
        expect(errors[0].severity).toBe("error");
      });

      it("should not error when update-file has allowed-paths", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
allowed-paths:
  - src/**/*.ts
outputs:
  update-file: true
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });

      it("should error when create-pr lacks contents: write permission", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
outputs:
  create-pr: true
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.message.includes("create-pr requires contents: write"))).toBe(
          true,
        );
      });

      it("should error when update-file lacks contents: write permission", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: read
allowed-paths:
  - src/**/*.ts
outputs:
  update-file: true
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some((e) => e.message.includes("update-file requires contents: write"))).toBe(
          true,
        );
      });

      it("should not error when create-pr has contents: write", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  create-pr: true
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });
    });

    describe("trigger validation rules", () => {
      it("should error when no triggers are specified", () => {
        const content = `---
name: Test Agent
on: {}
---

Test`;

        const result = parser.parseContent(content);
        expect(result.agent).toBeDefined();

        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(1);
        expect(errors[0].field).toBe("on");
        expect(errors[0].message).toContain("At least one trigger must be specified");
      });

      it("should not error when issue trigger is specified", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });

      it("should not error when pull_request trigger is specified", () => {
        const content = `---
name: Test Agent
on:
  pull_request:
    types: [opened]
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });

      it("should not error when schedule trigger is specified", () => {
        const content = `---
name: Test Agent
on:
  schedule:
    - cron: "0 0 * * *"
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });

      it("should not error when workflow_dispatch trigger is specified", () => {
        const content = `---
name: Test Agent
on:
  workflow_dispatch: {}
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });
    });

    describe("combined validation scenarios", () => {
      it("should collect multiple validation errors", () => {
        const content = `---
name: Test Agent
on: {}
outputs:
  update-file: true
  create-pr: true
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors.length).toBeGreaterThan(2);
        expect(errors.some((e) => e.message.includes("At least one trigger"))).toBe(true);
        expect(errors.some((e) => e.message.includes("update-file requires allowed-paths"))).toBe(
          true,
        );
        expect(errors.some((e) => e.message.includes("create-pr requires contents: write"))).toBe(
          true,
        );
      });

      it("should validate agent with no outputs", () => {
        const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Test`;

        const result = parser.parseContent(content);
        const errors = parser.validateAgent(result.agent!);

        expect(errors).toHaveLength(0);
      });
    });
  });

  describe("parseFile", () => {
    it("should read and parse a valid file", async () => {
      const filePath = join(tempDir, "agent.md");
      const content = `---
name: File Test Agent
on:
  issues:
    types: [opened]
---

File test instructions`;

      writeFileSync(filePath, content, "utf-8");

      const result = await parser.parseFile(filePath);

      expect(result.agent).toBeDefined();
      expect(result.agent?.name).toBe("File Test Agent");
      expect(result.errors).toHaveLength(0);
    });

    it("should error on non-existent file", async () => {
      const filePath = join(tempDir, "non-existent.md");

      const result = await parser.parseFile(filePath);

      expect(result.agent).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("file");
      expect(result.errors[0].message).toContain("Failed to read file");
      expect(result.errors[0].severity).toBe("error");
    });

    it("should error on directory instead of file", async () => {
      const result = await parser.parseFile(tempDir);

      expect(result.agent).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("file");
    });

    it("should handle file with invalid content", async () => {
      const filePath = join(tempDir, "invalid.md");
      writeFileSync(filePath, "invalid content without frontmatter", "utf-8");

      const result = await parser.parseFile(filePath);

      expect(result.agent).toBeUndefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle file with malformed YAML", async () => {
      const filePath = join(tempDir, "malformed.md");
      const content = `---
name: Test
on: {broken
---

Test`;
      writeFileSync(filePath, content, "utf-8");

      const result = await parser.parseFile(filePath);

      expect(result.agent).toBeUndefined();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("frontmatter");
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete agent lifecycle", async () => {
      const filePath = join(tempDir, "complete-agent.md");
      const content = `---
name: Complete Agent
on:
  issues:
    types: [opened, labeled]
  pull_request:
    types: [opened]
permissions:
  contents: write
  issues: write
  pull_requests: write
outputs:
  add-comment: true
  add-label:
    max: 3
  create-pr: true
allowed-paths:
  - src/**/*.ts
  - docs/**/*.md
allowed-users:
  - user1
  - user2
trigger_labels:
  - enhancement
rate_limit_minutes: 10
max_open_prs: 5
audit:
  create_issues: true
  labels: [bot]
---

# Complete Agent Instructions

This agent handles multiple scenarios with comprehensive configuration.
`;

      writeFileSync(filePath, content, "utf-8");

      const parseResult = await parser.parseFile(filePath);
      expect(parseResult.agent).toBeDefined();
      expect(parseResult.errors).toHaveLength(0);

      const agent = parseResult.agent!;
      const validationErrors = parser.validateAgent(agent);
      expect(validationErrors).toHaveLength(0);

      expect(agent.name).toBe("Complete Agent");
      expect(agent.on.issues?.types).toContain("opened");
      expect(agent.on.pull_request?.types).toContain("opened");
      expect(agent.permissions?.contents).toBe("write");
      expect(agent.outputs?.["add-comment"]).toBe(true);
      expect(agent.allowed_paths).toContain("src/**/*.ts");
      expect(agent.trigger_labels).toContain("enhancement");
      expect(agent.rate_limit_minutes).toBe(10);
      expect(agent.max_open_prs).toBe(5);
      expect(agent.audit?.create_issues).toBe(true);
    });

    it("should handle minimal valid agent", async () => {
      const filePath = join(tempDir, "minimal-agent.md");
      const content = `---
name: Minimal Agent
on:
  workflow_dispatch: {}
---

Minimal instructions`;

      writeFileSync(filePath, content, "utf-8");

      const parseResult = await parser.parseFile(filePath);
      expect(parseResult.agent).toBeDefined();

      const validationErrors = parser.validateAgent(parseResult.agent!);
      expect(validationErrors).toHaveLength(0);
    });

    it("should handle agent with context collection", async () => {
      const filePath = join(tempDir, "context-agent.md");
      const content = `---
name: Context Collection Agent
on:
  schedule:
    - cron: "0 0 * * *"
context:
  issues:
    states: [open]
    labels: [bug, critical]
    limit: 100
  pull_requests:
    states: [open, merged]
    reviewers: [reviewer1]
    limit: 50
  discussions:
    categories: [General]
    answered: false
    limit: 25
  stars: true
  forks: true
  since: "7d"
  min_items: 10
---

Collect and analyze repository data`;

      writeFileSync(filePath, content, "utf-8");

      const parseResult = await parser.parseFile(filePath);
      expect(parseResult.agent).toBeDefined();

      const agent = parseResult.agent!;
      expect(agent.context?.issues?.states).toEqual(["open"]);
      expect(agent.context?.issues?.labels).toEqual(["bug", "critical"]);
      expect(agent.context?.pull_requests?.reviewers).toEqual(["reviewer1"]);
      expect(agent.context?.discussions?.answered).toBe(false);
      expect(agent.context?.stars).toBe(true);
      expect(agent.context?.since).toBe("7d");
    });
  });

  describe("type safety", () => {
    it("should return correct types for successful parse", () => {
      const content = `---
name: Type Test
on:
  issues:
    types: [opened]
---

Test`;

      const result = parser.parseContent(content);

      if (result.agent) {
        expect(typeof result.agent.name).toBe("string");
        expect(typeof result.agent.on).toBe("object");
        expect(typeof result.agent.markdown).toBe("string");
      }
    });

    it("should return correct types for failed parse", () => {
      const content = "invalid";

      const result = parser.parseContent(content);

      expect(result.agent).toBeUndefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors[0]).toHaveProperty("field");
      expect(result.errors[0]).toHaveProperty("message");
      expect(result.errors[0]).toHaveProperty("severity");
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton agentParser instance", async () => {
      const { agentParser: singleton } = await import("./index");

      expect(singleton).toBeDefined();
      expect(singleton).toBeInstanceOf(AgentParser);
    });

    it("should be usable via singleton", async () => {
      const { agentParser: singleton } = await import("./index");

      const content = `---
name: Singleton Test
on:
  issues:
    types: [opened]
---

Test`;

      const result = singleton.parseContent(content);

      expect(result.agent).toBeDefined();
      expect(result.agent?.name).toBe("Singleton Test");
    });
  });

  describe("exported schema", () => {
    it("should export agentFrontmatterSchema", async () => {
      const { agentFrontmatterSchema } = await import("./index");

      expect(agentFrontmatterSchema).toBeDefined();
      expect(typeof agentFrontmatterSchema.parse).toBe("function");
    });

    it("should validate frontmatter using exported schema", async () => {
      const { agentFrontmatterSchema } = await import("./index");

      const validFrontmatter = {
        name: "Schema Test",
        on: {
          issues: {
            types: ["opened"],
          },
        },
      };

      const result = agentFrontmatterSchema.parse(validFrontmatter);

      expect(result).toBeDefined();
      expect(result.name).toBe("Schema Test");
    });

    it("should reject invalid frontmatter using exported schema", async () => {
      const { agentFrontmatterSchema } = await import("./index");

      const invalidFrontmatter = {
        name: "",
        on: {},
      };

      expect(() => {
        agentFrontmatterSchema.parse(invalidFrontmatter);
      }).toThrow();
    });
  });

  describe("error edge cases", () => {
    it("should handle permission with empty allowed_paths array", () => {
      const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
permissions:
  contents: write
outputs:
  update-file: true
allowed-paths: []
---

Test`;

      const result = parser.parseContent(content);
      const errors = parser.validateAgent(result.agent!);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.message.includes("update-file requires allowed-paths"))).toBe(
        true,
      );
    });

    it("should handle multiple validation errors in create-pr and update-file", () => {
      const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
outputs:
  create-pr: true
  update-file: true
---

Test`;

      const result = parser.parseContent(content);
      const errors = parser.validateAgent(result.agent!);

      expect(errors.length).toBeGreaterThanOrEqual(3);
      expect(errors.some((e) => e.message.includes("create-pr requires contents: write"))).toBe(
        true,
      );
      expect(errors.some((e) => e.message.includes("update-file requires contents: write"))).toBe(
        true,
      );
      expect(errors.some((e) => e.message.includes("update-file requires allowed-paths"))).toBe(
        true,
      );
    });

    it("should handle file read error with specific error messages", async () => {
      const result = await parser.parseFile("/path/to/nonexistent/file.md");

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("file");
      expect(result.errors[0].message).toContain("Failed to read file");
    });

    it("should handle progress_comment field", () => {
      const content = `---
name: Progress Test
on:
  issues:
    types: [opened]
progress_comment: false
---

Test`;

      const result = parser.parseContent(content);

      expect(result.agent).toBeDefined();
      expect(result.agent?.name).toBe("Progress Test");
    });

    it("should handle pre_flight configuration", () => {
      const content = `---
name: PreFlight Test
on:
  issues:
    types: [opened]
pre_flight:
  check_blocking_issues: true
  max_estimate: 8
---

Test`;

      const result = parser.parseContent(content);

      expect(result.agent).toBeDefined();
      expect(result.agent?.name).toBe("PreFlight Test");
    });
  });
});
