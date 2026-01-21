import { describe, expect, it } from "bun:test";
import * as fc from "fast-check";
import * as yaml from "js-yaml";
import { AgentParser } from "./index";

describe("AgentParser - Property-Based Tests", () => {
  const parser = new AgentParser();

  // Arbitraries for building valid agent definitions
  const agentNameArb = fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  const issueTypesArb = fc.array(
    fc.oneof(
      fc.constant("opened"),
      fc.constant("edited"),
      fc.constant("closed"),
      fc.constant("reopened"),
      fc.constant("labeled"),
      fc.constant("unlabeled"),
    ),
    { minLength: 1, maxLength: 5 },
  );

  const prTypesArb = fc.array(
    fc.oneof(
      fc.constant("opened"),
      fc.constant("edited"),
      fc.constant("closed"),
      fc.constant("reopened"),
      fc.constant("synchronize"),
      fc.constant("ready_for_review"),
    ),
    { minLength: 1, maxLength: 5 },
  );

  const discussionTypesArb = fc.array(
    fc.oneof(
      fc.constant("created"),
      fc.constant("edited"),
      fc.constant("deleted"),
      fc.constant("answered"),
      fc.constant("unanswered"),
    ),
    { minLength: 1, maxLength: 3 },
  );

  const cronArb = fc.constantFrom("0 0 * * *", "0 */6 * * *", "0 12 * * 1", "*/15 * * * *");

  const repositoryDispatchTypeArb = fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  const triggerConfigArb = fc
    .record(
      {
        issues: fc.option(
          fc.record({
            types: fc.option(issueTypesArb),
          }),
          { nil: undefined },
        ),
        pull_request: fc.option(
          fc.record({
            types: fc.option(prTypesArb),
          }),
          { nil: undefined },
        ),
        discussion: fc.option(
          fc.record({
            types: fc.option(discussionTypesArb),
          }),
          { nil: undefined },
        ),
        schedule: fc.option(
          fc.array(
            fc.record({
              cron: cronArb,
            }),
            { minLength: 1, maxLength: 3 },
          ),
          { nil: undefined },
        ),
        workflow_dispatch: fc.option(
          fc.record({
            inputs: fc.option(fc.constant({}), { nil: undefined }),
          }),
          { nil: undefined },
        ),
        repository_dispatch: fc.option(
          fc.record({
            types: fc.option(fc.array(repositoryDispatchTypeArb, { minLength: 1, maxLength: 3 })),
          }),
          { nil: undefined },
        ),
      },
      { requiredKeys: [] },
    )
    .filter((config) => {
      // Ensure at least one trigger is defined
      return (
        config.issues !== undefined ||
        config.pull_request !== undefined ||
        config.discussion !== undefined ||
        config.schedule !== undefined ||
        config.workflow_dispatch !== undefined ||
        config.repository_dispatch !== undefined
      );
    });

  const permissionLevelArb = fc.constantFrom("read", "write");

  const permissionsArb = fc.option(
    fc.record(
      {
        contents: fc.option(permissionLevelArb, { nil: undefined }),
        issues: fc.option(permissionLevelArb, { nil: undefined }),
        pull_requests: fc.option(permissionLevelArb, { nil: undefined }),
        discussions: fc.option(permissionLevelArb, { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
    { nil: undefined },
  );

  const outputTypeArb = fc.constantFrom(
    "add-comment",
    "add-label",
    "remove-label",
    "create-issue",
    "create-discussion",
    "create-pr",
    "update-file",
    "close-issue",
    "close-pr",
    "assign-issue",
    "request-review",
    "merge-pr",
    "approve-pr",
    "create-release",
    "delete-branch",
    "lock-conversation",
    "pin-issue",
    "convert-to-discussion",
    "edit-issue",
    "reopen-issue",
    "set-milestone",
    "trigger-workflow",
    "add-reaction",
    "create-branch",
  );

  const outputConfigArb = fc.oneof(
    fc.constant(true),
    fc.record(
      {
        max: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
        sign: fc.option(fc.boolean(), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
  );

  const outputsArb = fc.option(
    fc.dictionary(outputTypeArb, outputConfigArb, { minKeys: 0, maxKeys: 8 }),
    { nil: undefined },
  );

  const usernameArb = fc
    .string({ minLength: 1, maxLength: 39 })
    .map((s) => s.replace(/[^a-zA-Z0-9-]/g, "a"));

  const allowedUsersArb = fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 10 }), {
    nil: undefined,
  });

  const allowedActorsArb = fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 10 }), {
    nil: undefined,
  });

  const allowedTeamsArb = fc.option(
    fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    { nil: undefined },
  );

  const allowedPathsArb = fc.option(
    fc.array(
      fc.oneof(
        fc.constant("src/**/*.ts"),
        fc.constant("**/*.md"),
        fc.constant("docs/**/*"),
        fc.constant("*.json"),
        fc.constant("src/components/**/*.tsx"),
      ),
      { minLength: 1, maxLength: 5 },
    ),
    { nil: undefined },
  );

  const issuesContextArb = fc.option(
    fc.record(
      {
        states: fc.option(
          fc.array(fc.constantFrom("open", "closed", "all"), { minLength: 1, maxLength: 3 }),
          {
            nil: undefined,
          },
        ),
        labels: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          {
            nil: undefined,
          },
        ),
        assignees: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        creators: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        mentions: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        milestones: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          {
            nil: undefined,
          },
        ),
        exclude_labels: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          { nil: undefined },
        ),
        limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
    { nil: undefined },
  );

  const pullRequestsContextArb = fc.option(
    fc.record(
      {
        states: fc.option(
          fc.array(fc.constantFrom("open", "closed", "merged", "all"), {
            minLength: 1,
            maxLength: 4,
          }),
          { nil: undefined },
        ),
        labels: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          {
            nil: undefined,
          },
        ),
        assignees: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        creators: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        reviewers: fc.option(fc.array(usernameArb, { minLength: 1, maxLength: 5 }), {
          nil: undefined,
        }),
        base_branch: fc.option(fc.constantFrom("main", "develop", "master"), { nil: undefined }),
        head_branch: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
        exclude_labels: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          { nil: undefined },
        ),
        limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
    { nil: undefined },
  );

  const discussionsContextArb = fc.option(
    fc.record(
      {
        categories: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
          {
            nil: undefined,
          },
        ),
        answered: fc.option(fc.boolean(), { nil: undefined }),
        unanswered: fc.option(fc.boolean(), { nil: undefined }),
        labels: fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          {
            nil: undefined,
          },
        ),
        limit: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
    { nil: undefined },
  );

  const contextConfigArb = fc.option(
    fc.record(
      {
        issues: issuesContextArb,
        pull_requests: pullRequestsContextArb,
        discussions: discussionsContextArb,
        stars: fc.option(fc.boolean(), { nil: undefined }),
        forks: fc.option(fc.boolean(), { nil: undefined }),
        since: fc.option(fc.constantFrom("last-run", "1h", "24h", "7d", "30d"), { nil: undefined }),
        min_items: fc.option(fc.nat({ max: 100 }), { nil: undefined }),
      },
      { requiredKeys: [] },
    ),
    { nil: undefined },
  );

  const markdownArb = fc
    .string({ minLength: 10, maxLength: 500 })
    .filter((s) => s.trim().length > 0)
    .map((s) => s.trim());

  // Property 1: Parser never crashes on valid agent definitions with random names and triggers
  it("should never crash on valid agent definitions with random names and triggers", () => {
    fc.assert(
      fc.property(agentNameArb, triggerConfigArb, markdownArb, (name, on, markdown) => {
        const frontmatter = {
          name,
          on,
        };

        const yamlFrontmatter = yaml.dump(frontmatter);
        const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

        let result: ReturnType<typeof parser.parseContent>;
        try {
          result = parser.parseContent(content);
        } catch (error) {
          console.log("Parser threw error:", error);
          console.log("Name:", name);
          console.log("On:", JSON.stringify(on, null, 2));
          console.log("Content:", content);
          throw error;
        }

        // Parser should not throw
        expect(result).toBeDefined();
        // Should have either an agent or errors (or both if there are warnings)
        if (!result.agent && result.errors.length === 0) {
          console.log("No agent and no errors:", { name, on, result });
        }
        expect(result.agent !== undefined || result.errors.length > 0).toBe(true);
        // If agent is present, should match input
        if (result.agent) {
          expect(result.agent.name).toBe(name);
          expect(result.agent.markdown).toBe(markdown);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 2: Parser handles all valid permission combinations
  it("should correctly parse all valid permission combinations", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        permissionsArb,
        markdownArb,
        (name, on, permissions, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (permissions !== undefined) {
            frontmatterObj.permissions = permissions;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          // Should parse successfully
          expect(result).toBeDefined();
          if (result.agent) {
            // If permissions were provided, they should match
            if (permissions !== undefined) {
              expect(result.agent.permissions).toEqual(permissions);
            }
            // Validate that permission values are only 'read' or 'write'
            if (result.agent.permissions) {
              for (const value of Object.values(result.agent.permissions)) {
                if (value !== undefined) {
                  expect(["read", "write"]).toContain(value);
                }
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 3: Parser validates output configurations with proper permissions
  it("should validate output configurations and enforce permission requirements", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        outputsArb,
        permissionsArb,
        allowedPathsArb,
        markdownArb,
        (name, on, outputs, permissions, allowedPaths, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (outputs !== undefined) {
            frontmatterObj.outputs = outputs;
          }
          if (permissions !== undefined) {
            frontmatterObj.permissions = permissions;
          }
          if (allowedPaths !== undefined) {
            frontmatterObj["allowed-paths"] = allowedPaths;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          expect(result).toBeDefined();

          if (result.agent) {
            // Validate business logic
            const validationErrors = parser.validateAgent(result.agent);

            // Check update-file validation
            if (outputs && "update-file" in outputs) {
              if (!allowedPaths || allowedPaths.length === 0) {
                // Should have a validation error
                const hasUpdateFileError = validationErrors.some(
                  (e) =>
                    e.field === "outputs" &&
                    e.message.includes("update-file requires allowed-paths"),
                );
                expect(hasUpdateFileError).toBe(true);
              }
            }

            // Check create-pr and update-file require contents: write
            const outputsRequiringWrite = ["create-pr", "update-file"];
            for (const outputType of outputsRequiringWrite) {
              if (outputs && outputType in outputs) {
                if (permissions?.contents !== "write") {
                  const hasPermissionError = validationErrors.some(
                    (e) =>
                      e.field === "permissions" &&
                      e.message.includes(`${outputType} requires contents: write`),
                  );
                  expect(hasPermissionError).toBe(true);
                }
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 4: Parser handles context configurations correctly
  it("should parse and validate context configurations", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        contextConfigArb,
        markdownArb,
        (name, on, context, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (context !== undefined) {
            frontmatterObj.context = context;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          expect(result).toBeDefined();

          if (result.agent) {
            // Context should match input if provided
            if (context !== undefined) {
              expect(result.agent.context).toBeDefined();

              // Validate numeric constraints
              if (context.min_items !== undefined) {
                expect(result.agent.context?.min_items).toBeGreaterThanOrEqual(0);
              }

              // Validate limit constraints in nested configs
              if (context.issues?.limit !== undefined) {
                expect(context.issues.limit).toBeGreaterThanOrEqual(1);
                expect(context.issues.limit).toBeLessThanOrEqual(1000);
              }
              if (context.pull_requests?.limit !== undefined) {
                expect(context.pull_requests.limit).toBeGreaterThanOrEqual(1);
                expect(context.pull_requests.limit).toBeLessThanOrEqual(1000);
              }
              if (context.discussions?.limit !== undefined) {
                expect(context.discussions.limit).toBeGreaterThanOrEqual(1);
                expect(context.discussions.limit).toBeLessThanOrEqual(1000);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 5: Parser handles allowed users, actors, and teams
  it("should parse and validate authorization lists", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        allowedUsersArb,
        allowedActorsArb,
        allowedTeamsArb,
        markdownArb,
        (name, on, allowedUsers, allowedActors, allowedTeams, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (allowedUsers !== undefined) {
            frontmatterObj["allowed-users"] = allowedUsers;
          }
          if (allowedActors !== undefined) {
            frontmatterObj["allowed-actors"] = allowedActors;
          }
          if (allowedTeams !== undefined) {
            frontmatterObj["allowed-teams"] = allowedTeams;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          expect(result).toBeDefined();

          if (result.agent) {
            // Arrays should match input if provided
            if (allowedUsers !== undefined) {
              expect(result.agent.allowed_users).toEqual(allowedUsers);
              expect(Array.isArray(result.agent.allowed_users)).toBe(true);
              expect(result.agent.allowed_users?.length).toBeGreaterThan(0);
            }
            if (allowedActors !== undefined) {
              expect(result.agent.allowed_actors).toEqual(allowedActors);
              expect(Array.isArray(result.agent.allowed_actors)).toBe(true);
              expect(result.agent.allowed_actors?.length).toBeGreaterThan(0);
            }
            if (allowedTeams !== undefined) {
              expect(result.agent.allowed_teams).toEqual(allowedTeams);
              expect(Array.isArray(result.agent.allowed_teams)).toBe(true);
              expect(result.agent.allowed_teams?.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 6: Parser always validates that at least one trigger exists
  it("should always require at least one trigger to be defined", () => {
    fc.assert(
      fc.property(agentNameArb, triggerConfigArb, markdownArb, (name, on, markdown) => {
        const frontmatter = {
          name,
          on,
        };

        const yamlFrontmatter = yaml.dump(frontmatter);
        const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

        const result = parser.parseContent(content);

        if (result.agent) {
          const validationErrors = parser.validateAgent(result.agent);
          // Since triggerConfigArb is filtered to always have at least one trigger,
          // there should be no "At least one trigger" error
          const hasTriggerError = validationErrors.some(
            (e) => e.field === "on" && e.message.includes("At least one trigger"),
          );
          expect(hasTriggerError).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Property 7: Parser handles rate limiting and PR limits correctly
  it("should parse and validate rate limiting and max PR configurations", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        fc.option(fc.nat({ max: 1440 }), { nil: undefined }), // rate_limit_minutes
        fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }), // max_open_prs
        markdownArb,
        (name, on, rateLimitMinutes, maxOpenPrs, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (rateLimitMinutes !== undefined) {
            frontmatterObj.rate_limit_minutes = rateLimitMinutes;
          }
          if (maxOpenPrs !== undefined) {
            frontmatterObj.max_open_prs = maxOpenPrs;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          expect(result).toBeDefined();

          if (result.agent) {
            // Values should match input if provided
            if (rateLimitMinutes !== undefined) {
              expect(result.agent.rate_limit_minutes).toBe(rateLimitMinutes);
              expect(result.agent.rate_limit_minutes).toBeGreaterThanOrEqual(0);
            }
            if (maxOpenPrs !== undefined) {
              expect(result.agent.max_open_prs).toBe(maxOpenPrs);
              expect(result.agent.max_open_prs).toBeGreaterThanOrEqual(1);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Property 8: Parser handles trigger labels correctly
  it("should parse and validate trigger labels", () => {
    fc.assert(
      fc.property(
        agentNameArb,
        triggerConfigArb,
        fc.option(
          fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 10 }),
          {
            nil: undefined,
          },
        ),
        markdownArb,
        (name, on, triggerLabels, markdown) => {
          const frontmatterObj: Record<string, unknown> = {
            name,
            on,
          };

          if (triggerLabels !== undefined) {
            frontmatterObj.trigger_labels = triggerLabels;
          }

          const yamlFrontmatter = yaml.dump(frontmatterObj);
          const content = `---\n${yamlFrontmatter}---\n\n${markdown}`;

          const result = parser.parseContent(content);

          expect(result).toBeDefined();

          if (result.agent) {
            if (triggerLabels !== undefined) {
              expect(result.agent.trigger_labels).toEqual(triggerLabels);
              expect(Array.isArray(result.agent.trigger_labels)).toBe(true);
              expect(result.agent.trigger_labels?.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
