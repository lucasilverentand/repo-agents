import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AgentParser } from "@repo-agents/parser";
import type { AgentDefinition, Output, OutputConfig } from "@repo-agents/types";
import { $ } from "bun";
import type { StageContext, StageResult } from "../types";

/** Directory where Claude writes output files */
const OUTPUTS_DIR = "/tmp/outputs";

/** Directory where validation errors are written */
const VALIDATION_ERRORS_DIR = "/tmp/validation-errors";

interface OutputFile {
  path: string;
  filename: string;
  data: Record<string, unknown>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ExecutionResult {
  success: boolean;
  executed: number;
  errors: string[];
}

/**
 * Outputs stage - validates and executes Claude's output files.
 *
 * This stage:
 * 1. Loads the agent definition to get output constraints
 * 2. Finds output files matching the specified output type (or all if not specified)
 * 3. Validates each file against the output type's schema and constraints
 * 4. Executes valid outputs using the gh CLI
 * 5. Writes validation errors for reporting
 */
export async function runOutputs(ctx: StageContext): Promise<StageResult> {
  // Load agent definition
  const parser = new AgentParser();
  const { agent, errors: parseErrors } = await parser.parseFile(ctx.agentPath);

  if (!agent || parseErrors.some((e) => e.severity === "error")) {
    return {
      success: false,
      outputs: {
        error: `Failed to parse agent definition: ${parseErrors.map((e) => e.message).join(", ")}`,
      },
    };
  }

  // Ensure validation errors directory exists
  await mkdir(VALIDATION_ERRORS_DIR, { recursive: true });

  // If no output type specified, process all configured outputs
  if (!ctx.outputType) {
    return await processAllOutputs(ctx, agent);
  }

  // Process single output type
  return await processSingleOutput(ctx, agent, ctx.outputType);
}

/**
 * Process a single output type
 */
async function processSingleOutput(
  ctx: StageContext,
  agent: AgentDefinition,
  outputType: string,
): Promise<StageResult> {
  // Get output config for this type
  const outputConfig = getOutputConfig(agent, outputType as Output);

  // Find output files
  const outputFiles = await findOutputFiles(outputType);

  if (outputFiles.length === 0) {
    return {
      success: true,
      outputs: {
        executed: "0",
        skipped: "true",
      },
      skipReason: `No ${outputType} output files found`,
    };
  }

  console.log(`Found ${outputFiles.length} ${outputType} output file(s)`);

  // Validate all files first
  const validationResult = await validateOutputFiles(
    outputType as Output,
    outputFiles,
    outputConfig,
    ctx,
    agent,
  );

  if (!validationResult.valid) {
    // Write validation errors
    await writeValidationErrors(outputType, validationResult.errors);

    return {
      success: false,
      outputs: {
        executed: "0",
        errors: String(validationResult.errors.length),
      },
    };
  }

  // Execute all outputs
  const executionResult = await executeOutputs(
    outputType as Output,
    outputFiles,
    outputConfig,
    ctx,
    agent,
  );

  if (executionResult.errors.length > 0) {
    await writeValidationErrors(outputType, executionResult.errors);
  }

  return {
    success: executionResult.success,
    outputs: {
      executed: String(executionResult.executed),
      errors: String(executionResult.errors.length),
    },
  };
}

/**
 * Process all configured output types
 */
async function processAllOutputs(ctx: StageContext, agent: AgentDefinition): Promise<StageResult> {
  if (!agent.outputs || Object.keys(agent.outputs).length === 0) {
    return {
      success: true,
      outputs: { executed: "0", skipped: "true" },
      skipReason: "No outputs configured for this agent",
    };
  }

  let totalExecuted = 0;
  let totalErrors = 0;
  const allErrors: string[] = [];

  // Process each configured output type
  for (const outputType of Object.keys(agent.outputs)) {
    console.log(`\nProcessing ${outputType} outputs...`);
    const result = await processSingleOutput(ctx, agent, outputType);

    if (result.outputs.executed) {
      totalExecuted += Number(result.outputs.executed);
    }
    if (result.outputs.errors) {
      totalErrors += Number(result.outputs.errors);
    }
    if (result.outputs.error) {
      allErrors.push(`${outputType}: ${result.outputs.error}`);
    }
  }

  return {
    success: totalErrors === 0 && allErrors.length === 0,
    outputs: {
      executed: String(totalExecuted),
      errors: String(totalErrors),
    },
  };
}

/**
 * Get the output configuration from agent definition.
 */
function getOutputConfig(agent: AgentDefinition, outputType: Output): OutputConfig {
  if (!agent.outputs) {
    return {};
  }

  const config = agent.outputs[outputType];
  if (config === true) {
    return {};
  }
  if (config === false || config === undefined) {
    return {};
  }
  return config;
}

/**
 * Find all output files matching the given type.
 * Matches patterns like: add-comment.json, add-comment-1.json, add-comment-2.json
 */
async function findOutputFiles(outputType: string): Promise<OutputFile[]> {
  if (!existsSync(OUTPUTS_DIR)) {
    return [];
  }

  const files = await readdir(OUTPUTS_DIR);
  const matchingFiles: OutputFile[] = [];

  // Match exact name or name with numeric suffix
  const pattern = new RegExp(`^${outputType}(-\\d+)?\\.json$`);

  for (const filename of files) {
    if (pattern.test(filename)) {
      const filePath = join(OUTPUTS_DIR, filename);
      try {
        const content = await readFile(filePath, "utf-8");
        const data = JSON.parse(content);
        matchingFiles.push({ path: filePath, filename, data });
      } catch (error) {
        // Invalid JSON - will be caught in validation
        matchingFiles.push({
          path: filePath,
          filename,
          data: { __parseError: (error as Error).message },
        });
      }
    }
  }

  return matchingFiles.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Validate all output files for a given type.
 */
async function validateOutputFiles(
  outputType: Output,
  files: OutputFile[],
  config: OutputConfig,
  ctx: StageContext,
  agent: AgentDefinition,
): Promise<ValidationResult> {
  const errors: string[] = [];

  // Check max constraint
  if (config.max && files.length > config.max) {
    errors.push(
      `**${outputType}**: Too many output files (${files.length}). Maximum allowed: ${config.max}`,
    );
    return { valid: false, errors };
  }

  // Validate each file
  for (const file of files) {
    const fileErrors = await validateOutputFile(outputType, file, config, ctx, agent);
    errors.push(...fileErrors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single output file.
 */
async function validateOutputFile(
  outputType: Output,
  file: OutputFile,
  _config: OutputConfig,
  ctx: StageContext,
  agent: AgentDefinition,
): Promise<string[]> {
  const errors: string[] = [];

  // Check for parse errors
  if (file.data.__parseError) {
    errors.push(
      `**${outputType}**: Invalid JSON format in ${file.filename}: ${file.data.__parseError}`,
    );
    return errors;
  }

  // Type-specific validation
  switch (outputType) {
    case "add-comment":
      if (!file.data.body || typeof file.data.body !== "string") {
        errors.push(`**${outputType}**: body is required and must be a string in ${file.filename}`);
      } else if ((file.data.body as string).length > 65536) {
        errors.push(`**${outputType}**: body exceeds 65536 characters in ${file.filename}`);
      }
      break;

    case "add-label":
      if (!Array.isArray(file.data.labels) || file.data.labels.length === 0) {
        errors.push(`**${outputType}**: labels must be a non-empty array in ${file.filename}`);
      } else {
        // Validate labels exist in repository
        const labelErrors = await validateLabelsExist(
          file.data.labels as string[],
          ctx.repository,
          outputType,
          file.filename,
        );
        errors.push(...labelErrors);
      }
      break;

    case "remove-label":
      if (!Array.isArray(file.data.labels) || file.data.labels.length === 0) {
        errors.push(`**${outputType}**: labels must be a non-empty array in ${file.filename}`);
      }
      // Note: remove-label doesn't validate that labels exist - silently ignores missing
      break;

    case "create-issue":
      if (!file.data.title || typeof file.data.title !== "string") {
        errors.push(`**${outputType}**: title is required in ${file.filename}`);
      } else if ((file.data.title as string).length > 256) {
        errors.push(`**${outputType}**: title exceeds 256 characters in ${file.filename}`);
      }
      if (!file.data.body || typeof file.data.body !== "string") {
        errors.push(`**${outputType}**: body is required in ${file.filename}`);
      }
      if (file.data.labels && Array.isArray(file.data.labels)) {
        const labelErrors = await validateLabelsExist(
          file.data.labels as string[],
          ctx.repository,
          outputType,
          file.filename,
        );
        errors.push(...labelErrors);
      }
      break;

    case "create-discussion":
      if (!file.data.title || typeof file.data.title !== "string") {
        errors.push(`**${outputType}**: title is required in ${file.filename}`);
      } else if ((file.data.title as string).length > 256) {
        errors.push(`**${outputType}**: title exceeds 256 characters in ${file.filename}`);
      }
      if (!file.data.body || typeof file.data.body !== "string") {
        errors.push(`**${outputType}**: body is required in ${file.filename}`);
      }
      if (!file.data.category || typeof file.data.category !== "string") {
        errors.push(`**${outputType}**: category is required in ${file.filename}`);
      } else {
        // Validate category exists
        const categoryError = await validateCategoryExists(
          file.data.category as string,
          ctx.repository,
          outputType,
          file.filename,
        );
        if (categoryError) {
          errors.push(categoryError);
        }
      }
      break;

    case "create-pr":
      if (!file.data.branch || typeof file.data.branch !== "string") {
        errors.push(`**${outputType}**: branch is required in ${file.filename}`);
      } else if (!/^[a-zA-Z0-9/_.-]+$/.test(file.data.branch as string)) {
        errors.push(
          `**${outputType}**: branch name contains invalid characters in ${file.filename}`,
        );
      }
      if (!file.data.title || typeof file.data.title !== "string") {
        errors.push(`**${outputType}**: title is required in ${file.filename}`);
      }
      if (!file.data.body || typeof file.data.body !== "string") {
        errors.push(`**${outputType}**: body is required in ${file.filename}`);
      }
      if (!Array.isArray(file.data.files) || file.data.files.length === 0) {
        errors.push(`**${outputType}**: files must be a non-empty array in ${file.filename}`);
      } else {
        // Validate file entries
        for (const fileEntry of file.data.files as Array<{ path?: string; content?: string }>) {
          if (!fileEntry.path || typeof fileEntry.path !== "string") {
            errors.push(
              `**${outputType}**: each file must have a 'path' string in ${file.filename}`,
            );
          }
          if (fileEntry.content === undefined || typeof fileEntry.content !== "string") {
            errors.push(
              `**${outputType}**: each file must have a 'content' string in ${file.filename}`,
            );
          }
        }
      }
      break;

    case "update-file":
      if (!Array.isArray(file.data.files) || file.data.files.length === 0) {
        errors.push(`**${outputType}**: files must be a non-empty array in ${file.filename}`);
      } else {
        // Validate file entries and allowed paths
        const allowedPaths = agent.allowed_paths || [];
        for (const fileEntry of file.data.files as Array<{ path?: string; content?: string }>) {
          if (!fileEntry.path || typeof fileEntry.path !== "string") {
            errors.push(
              `**${outputType}**: each file must have a 'path' string in ${file.filename}`,
            );
            continue;
          }
          if (fileEntry.content === undefined || typeof fileEntry.content !== "string") {
            errors.push(
              `**${outputType}**: each file must have a 'content' string in ${file.filename}`,
            );
          }
          // Validate path against allowed patterns
          if (allowedPaths.length > 0 && !matchesAnyPattern(fileEntry.path, allowedPaths)) {
            errors.push(
              `**${outputType}**: File path '${fileEntry.path}' does not match allowed patterns in ${file.filename}`,
            );
          }
        }
      }
      if (!file.data.message || typeof file.data.message !== "string") {
        errors.push(`**${outputType}**: message is required in ${file.filename}`);
      }
      break;

    case "close-issue":
      if (file.data.state_reason !== undefined) {
        const validReasons = ["completed", "not_planned"];
        if (!validReasons.includes(file.data.state_reason as string)) {
          errors.push(
            `**${outputType}**: state_reason must be 'completed' or 'not_planned' in ${file.filename}`,
          );
        }
      }
      break;

    case "close-pr":
      // merge is optional boolean, no required validation
      if (file.data.merge !== undefined && typeof file.data.merge !== "boolean") {
        errors.push(`**${outputType}**: merge must be a boolean in ${file.filename}`);
      }
      break;
  }

  return errors;
}

/**
 * Validate that all labels exist in the repository.
 */
async function validateLabelsExist(
  labels: string[],
  repository: string,
  outputType: string,
  filename: string,
): Promise<string[]> {
  const errors: string[] = [];

  try {
    const result = await $`gh api repos/${repository}/labels --jq '.[].name'`.text();
    const existingLabels = result
      .trim()
      .split("\n")
      .filter((l) => l);

    for (const label of labels) {
      if (!existingLabels.includes(label)) {
        errors.push(
          `**${outputType}**: Label '${label}' does not exist in repository (in ${filename})`,
        );
      }
    }
  } catch {
    // If we can't fetch labels, skip validation - will fail at execution
  }

  return errors;
}

/**
 * Validate that a discussion category exists.
 */
async function validateCategoryExists(
  category: string,
  repository: string,
  outputType: string,
  filename: string,
): Promise<string | null> {
  const [owner, repo] = repository.split("/");

  const query = `query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      discussionCategories(first: 50) {
        nodes { name }
      }
    }
  }`;

  try {
    const result =
      await $`gh api graphql -f query=${query} -f owner=${owner} -f repo=${repo} --jq '.data.repository.discussionCategories.nodes[].name'`.text();
    const categories = result
      .trim()
      .split("\n")
      .filter((c) => c);

    if (!categories.includes(category)) {
      return `**${outputType}**: Category '${category}' does not exist in repository (in ${filename})`;
    }
  } catch {
    // If we can't fetch categories, skip validation
  }

  return null;
}

/**
 * Check if a path matches any of the glob patterns.
 */
function matchesAnyPattern(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (matchGlob(path, pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Simple glob pattern matching.
 * Supports * (any characters except /) and ** (any characters including /)
 */
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexPattern = pattern
    .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/<<<DOUBLESTAR>>>/g, ".*")
    .replace(/\?/g, ".")
    .replace(/\./g, "\\.");

  // Handle patterns like "src/**" to match "src/foo/bar"
  if (!regexPattern.endsWith(".*")) {
    regexPattern = `^${regexPattern}$`;
  } else {
    regexPattern = `^${regexPattern}`;
  }

  try {
    const regex = new RegExp(regexPattern);
    return regex.test(path);
  } catch {
    // Invalid pattern, do exact match
    return path === pattern;
  }
}

/**
 * Execute all validated outputs.
 */
async function executeOutputs(
  outputType: Output,
  files: OutputFile[],
  config: OutputConfig,
  ctx: StageContext,
  agent: AgentDefinition,
): Promise<ExecutionResult> {
  const errors: string[] = [];
  let executed = 0;

  for (const file of files) {
    try {
      await executeOutput(outputType, file, config, ctx, agent);
      executed++;
      console.log(`Executed ${outputType} from ${file.filename}`);
    } catch (error) {
      errors.push(
        `**${outputType}**: Failed to execute ${file.filename}: ${(error as Error).message}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    executed,
    errors,
  };
}

/**
 * Execute a single output using the gh CLI.
 */
async function executeOutput(
  outputType: Output,
  file: OutputFile,
  config: OutputConfig,
  ctx: StageContext,
  agent: AgentDefinition,
): Promise<void> {
  const repository = ctx.repository;

  // Get issue/PR number from event payload
  // Priority: 1. EVENT_PAYLOAD (from dispatcher), 2. GITHUB_EVENT_PATH (direct trigger)
  let issueNumber: string | undefined;
  let prNumber: string | undefined;

  // Priority 1: Check for EVENT_PAYLOAD environment variable (from dispatcher)
  // Note: EVENT_PAYLOAD is base64-encoded to avoid newline issues with GitHub Actions
  const eventPayloadEnv = process.env.EVENT_PAYLOAD;
  if (eventPayloadEnv) {
    try {
      const decodedPayload = Buffer.from(eventPayloadEnv, "base64").toString("utf-8");
      const event = JSON.parse(decodedPayload);
      issueNumber = event.issue?.number?.toString();
      prNumber = event.pull_request?.number?.toString();
    } catch (error) {
      console.warn("Failed to parse EVENT_PAYLOAD:", error);
      // Fall through to standard event path handling
    }
  }

  // Priority 2: Fallback to standard event path (GITHUB_EVENT_PATH)
  if (!issueNumber && !prNumber) {
    const eventPath = ctx.eventPath;
    if (eventPath && existsSync(eventPath)) {
      try {
        const eventData = JSON.parse(await readFile(eventPath, "utf-8"));
        issueNumber = eventData.issue?.number?.toString();
        prNumber = eventData.pull_request?.number?.toString();
      } catch {
        // Ignore event parsing errors
      }
    }
  }

  const issueOrPrNumber = issueNumber || prNumber;

  switch (outputType) {
    case "add-comment":
      await executeAddComment(file, repository, issueOrPrNumber, agent, ctx);
      break;

    case "add-label":
      await executeAddLabel(file, repository, issueOrPrNumber);
      break;

    case "remove-label":
      await executeRemoveLabel(file, repository, issueOrPrNumber);
      break;

    case "create-issue":
      await executeCreateIssue(file, repository);
      break;

    case "create-discussion":
      await executeCreateDiscussion(file, repository, agent, ctx);
      break;

    case "create-pr":
      await executeCreatePr(file, repository, config);
      break;

    case "update-file":
      await executeUpdateFile(file, repository);
      break;

    case "close-issue":
      await executeCloseIssue(file, repository, issueNumber);
      break;

    case "close-pr":
      await executeClosePr(file, repository, prNumber);
      break;

    default:
      throw new Error(`Unknown output type: ${outputType}`);
  }
}

/**
 * Add a comment to an issue or PR.
 */
async function executeAddComment(
  file: OutputFile,
  repository: string,
  issueOrPrNumber: string | undefined,
  agent: AgentDefinition,
  ctx: StageContext,
): Promise<void> {
  if (!issueOrPrNumber) {
    throw new Error("No issue or PR number available");
  }

  const body = file.data.body as string;

  // Generate agent-specific attribution with link to agent definition
  const agentPath = ctx.agentPath.replace(/^\.github\/agents\//, "");
  const agentUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/blob/main/.github/agents/${agentPath}`;
  const workflowUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const footer = `\n\n> *Generated by [${agent.name}](${agentUrl}) in workflow [${process.env.GITHUB_WORKFLOW} #${process.env.GITHUB_RUN_NUMBER}](${workflowUrl})*`;

  await $`gh api repos/${repository}/issues/${issueOrPrNumber}/comments -f body=${body + footer}`;
}

/**
 * Add labels to an issue or PR.
 */
async function executeAddLabel(
  file: OutputFile,
  repository: string,
  issueOrPrNumber: string | undefined,
): Promise<void> {
  if (!issueOrPrNumber) {
    throw new Error("No issue or PR number available");
  }

  const labels = file.data.labels as string[];

  // Get current labels
  const currentLabelsResult =
    await $`gh api repos/${repository}/issues/${issueOrPrNumber} --jq '.labels[].name'`.text();
  const currentLabels = currentLabelsResult
    .trim()
    .split("\n")
    .filter((l) => l);

  // Merge labels
  const mergedLabels = [...new Set([...currentLabels, ...labels])];

  // Update labels via API
  const labelsJson = JSON.stringify(mergedLabels);
  await $`gh api repos/${repository}/issues/${issueOrPrNumber}/labels -X PUT --input - <<'EOF'
${labelsJson}
EOF
`;
}

/**
 * Remove labels from an issue or PR.
 */
async function executeRemoveLabel(
  file: OutputFile,
  repository: string,
  issueOrPrNumber: string | undefined,
): Promise<void> {
  if (!issueOrPrNumber) {
    throw new Error("No issue or PR number available");
  }

  const labelsToRemove = file.data.labels as string[];

  // Get current labels
  const currentLabelsResult =
    await $`gh api repos/${repository}/issues/${issueOrPrNumber} --jq '.labels[].name'`.text();
  const currentLabels = currentLabelsResult
    .trim()
    .split("\n")
    .filter((l) => l);

  // Filter out labels to remove
  const remainingLabels = currentLabels.filter((l) => !labelsToRemove.includes(l));

  // Update labels via API
  const remainingJson = JSON.stringify(remainingLabels);
  await $`gh api repos/${repository}/issues/${issueOrPrNumber}/labels -X PUT --input - <<'EOF'
${remainingJson}
EOF
`;
}

/**
 * Create a new issue.
 */
async function executeCreateIssue(file: OutputFile, repository: string): Promise<void> {
  const title = file.data.title as string;
  const body = file.data.body as string;
  const labels = (file.data.labels as string[]) || [];
  const assignees = (file.data.assignees as string[]) || [];

  const payload = JSON.stringify({
    title,
    body,
    labels,
    assignees,
  });

  await $`gh api repos/${repository}/issues --input - <<'EOF'
${payload}
EOF
`;
}

/**
 * Create a new discussion.
 */
async function executeCreateDiscussion(
  file: OutputFile,
  repository: string,
  agent: AgentDefinition,
  ctx: StageContext,
): Promise<void> {
  const title = file.data.title as string;
  const body = file.data.body as string;
  const category = file.data.category as string;

  const [owner, repo] = repository.split("/");

  // Get discussion categories
  const categoriesQuery = `query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      discussionCategories(first: 50) {
        nodes {
          id
          name
        }
      }
    }
  }`;

  const categoriesResult =
    await $`gh api graphql -f query=${categoriesQuery} -f owner=${owner} -f repo=${repo} --jq '.data.repository.discussionCategories.nodes'`.text();
  const categories = JSON.parse(categoriesResult);

  const categoryNode = categories.find((c: { name: string; id: string }) => c.name === category);
  if (!categoryNode) {
    throw new Error(`Category '${category}' not found in repository`);
  }

  // Get repository ID
  const repoIdQuery = `query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      id
    }
  }`;

  const repoIdResult =
    await $`gh api graphql -f query=${repoIdQuery} -f owner=${owner} -f repo=${repo} --jq '.data.repository.id'`.text();
  const repoId = repoIdResult.trim();

  // Create discussion
  const createMutation = `mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
      discussion {
        url
      }
    }
  }`;

  // Generate agent-specific attribution with link to agent definition
  const agentPath = ctx.agentPath.replace(/^\.github\/agents\//, "");
  const agentUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/blob/main/.github/agents/${agentPath}`;
  const workflowUrl = `${process.env.GITHUB_SERVER_URL}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const footer = `\n\n> *Generated by [${agent.name}](${agentUrl}) in workflow [${process.env.GITHUB_WORKFLOW} #${process.env.GITHUB_RUN_NUMBER}](${workflowUrl})*`;

  const result =
    await $`gh api graphql -f query=${createMutation} -f repositoryId=${repoId} -f categoryId=${categoryNode.id} -f title=${title} -f body=${body + footer}`.text();

  const resultData = JSON.parse(result);
  if (resultData.data?.createDiscussion?.discussion?.url) {
    console.log(`Created discussion: ${resultData.data.createDiscussion.discussion.url}`);
  }
}

/**
 * Create a pull request with code changes.
 */
async function executeCreatePr(
  file: OutputFile,
  _repository: string,
  config: OutputConfig,
): Promise<void> {
  const branch = file.data.branch as string;
  const title = file.data.title as string;
  const body = file.data.body as string;
  const base = (file.data.base as string) || "main";
  const files = file.data.files as Array<{ path: string; content: string }>;
  const signCommits = config.sign || false;

  // Check if PR already exists for this branch
  try {
    const existingPr = await $`gh pr view ${branch} --json state --jq '.state'`.text();
    if (existingPr.trim() === "OPEN") {
      console.log(`PR already exists for branch '${branch}', skipping`);
      return;
    }
  } catch {
    // No existing PR, continue
  }

  // Configure git
  const gitUser = process.env.GIT_USER || "github-actions[bot]";
  const gitEmail = process.env.GIT_EMAIL || "github-actions[bot]@users.noreply.github.com";
  await $`git config user.name ${gitUser}`;
  await $`git config user.email ${gitEmail}`;

  // Return to default branch
  await $`git checkout main`.catch(() => $`git checkout master`);

  // Delete existing remote branch if exists
  try {
    await $`git ls-remote --exit-code --heads origin ${branch}`;
    await $`git push origin --delete ${branch}`.catch(() => {});
  } catch {
    // Branch doesn't exist remotely
  }

  // Delete local branch if exists
  await $`git branch -D ${branch}`.catch(() => {});

  // Create new branch
  await $`git checkout -b ${branch}`;

  // Create/update files
  for (const fileSpec of files) {
    const dirPath = fileSpec.path.includes("/")
      ? fileSpec.path.substring(0, fileSpec.path.lastIndexOf("/"))
      : ".";
    await $`mkdir -p ${dirPath}`;
    await writeFile(fileSpec.path, fileSpec.content, "utf-8");
    await $`git add ${fileSpec.path}`;
  }

  // Commit changes
  if (signCommits) {
    await $`git commit -S -m ${title}`;
  } else {
    await $`git commit -m ${title}`;
  }

  // Push branch
  await $`git push origin ${branch}`;

  // Create PR
  await $`gh pr create --title ${title} --body ${body} --base ${base} --head ${branch}`;

  console.log(`Created PR: ${title}`);

  // Return to main branch
  await $`git checkout main`.catch(() => $`git checkout master`);
}

/**
 * Update files in the repository.
 */
async function executeUpdateFile(file: OutputFile, repository: string): Promise<void> {
  const files = file.data.files as Array<{ path: string; content: string }>;
  const message = file.data.message as string;
  const branch = (file.data.branch as string) || "main";

  for (const fileSpec of files) {
    // Get current file SHA if it exists
    let sha: string | undefined;
    try {
      const response =
        await $`gh api repos/${repository}/contents/${fileSpec.path} --jq '.sha'`.text();
      sha = response.trim();
    } catch {
      // File doesn't exist
    }

    // Encode content as base64
    const content = Buffer.from(fileSpec.content, "utf-8").toString("base64");

    // Build payload
    const payload: Record<string, string> = {
      message,
      content,
      branch,
    };
    if (sha) {
      payload.sha = sha;
    }

    // Update file via API
    const payloadJson = JSON.stringify(payload);
    await $`gh api repos/${repository}/contents/${fileSpec.path} -X PUT --input - <<'EOF'
${payloadJson}
EOF
`;
  }
}

/**
 * Close an issue.
 */
async function executeCloseIssue(
  file: OutputFile,
  repository: string,
  issueNumber: string | undefined,
): Promise<void> {
  if (!issueNumber) {
    throw new Error("No issue number available");
  }

  const stateReason = (file.data.state_reason as string) || "completed";

  await $`gh api repos/${repository}/issues/${issueNumber} -X PATCH -f state=closed -f state_reason=${stateReason}`;
}

/**
 * Close a pull request.
 */
async function executeClosePr(
  file: OutputFile,
  repository: string,
  prNumber: string | undefined,
): Promise<void> {
  if (!prNumber) {
    throw new Error("No pull request number available");
  }

  const shouldMerge = file.data.merge === true;

  if (shouldMerge) {
    await $`gh api repos/${repository}/pulls/${prNumber}/merge -X PUT`;
  } else {
    await $`gh api repos/${repository}/pulls/${prNumber} -X PATCH -f state=closed`;
  }
}

/**
 * Write validation errors to a file.
 */
async function writeValidationErrors(outputType: string, errors: string[]): Promise<void> {
  if (errors.length === 0) {
    return;
  }

  const errorFile = join(VALIDATION_ERRORS_DIR, `${outputType}.json`);
  await writeFile(errorFile, JSON.stringify(errors, null, 2), "utf-8");

  // Also write as text for compatibility
  const textFile = join(VALIDATION_ERRORS_DIR, `${outputType}.txt`);
  await writeFile(textFile, errors.join("\n"), "utf-8");
}
