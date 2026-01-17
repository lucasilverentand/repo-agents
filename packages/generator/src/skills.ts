import type { Output, OutputConfig } from "@repo-agents/types";

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
 * Generates documentation for a specific output type
 */
export function generateSkillForOutput(
  output: Output,
  config: OutputConfig | Record<string, never>,
  allowedPaths?: string[],
): string {
  switch (output) {
    case "add-comment":
      return generateAddCommentSkill(config);
    case "add-label":
      return generateAddLabelSkill(config);
    case "remove-label":
      return generateRemoveLabelSkill(config);
    case "create-issue":
      return generateCreateIssueSkill(config);
    case "create-pr":
      return generateCreatePRSkill(config);
    case "update-file":
      return generateUpdateFileSkill(config, allowedPaths);
    case "close-issue":
      return generateCloseIssueSkill(config);
    case "close-pr":
      return generateClosePRSkill(config);
    default:
      return "";
  }
}

function getMaxConstraint(config: OutputConfig | Record<string, never>): string | number {
  return "max" in config && config.max ? config.max : "unlimited";
}

function hasSignConfig(config: OutputConfig | Record<string, never>): boolean {
  return "sign" in config && config.sign === true;
}

function generateAddCommentSkill(config: OutputConfig | Record<string, never>): string {
  return `## Operation: Add Comment

Add a comment to the current issue or pull request.

**How to use:**
- Use \`mcp__github__add_issue_comment\` tool
- Works for both issues and pull requests
- Provide the comment body as markdown text
- Be constructive and professional in your comments

**Constraints:**
- Maximum comments: ${getMaxConstraint(config)}

**Example:**
\`\`\`
Use the mcp__github__add_issue_comment tool with:
- owner: repository owner
- repo: repository name
- issue_number: current issue/PR number
- body: "Your markdown comment here"
\`\`\``;
}

function generateAddLabelSkill(_config: OutputConfig | Record<string, never>): string {
  return `## Operation: Add Labels

Add labels to the current issue or pull request.

**How to use:**
- Use \`mcp__github__update_issue\` tool to add labels
- Works for both issues and pull requests
- Provide an array of label names to add
- Note: Labels must already exist in the repository
- This operation adds to existing labels (doesn't replace them)

**Example:**
\`\`\`
Use the mcp__github__update_issue tool with:
- owner: repository owner
- repo: repository name
- issue_number: current issue/PR number
- labels: ["bug", "needs-triage"]  # Labels to add
\`\`\``;
}

function generateRemoveLabelSkill(_config: OutputConfig | Record<string, never>): string {
  return `## Operation: Remove Labels

Remove labels from the current issue or pull request.

**How to use:**
- Use \`mcp__github__update_issue\` tool to update labels
- Works for both issues and pull requests
- First get current labels with \`mcp__github__get_issue\`
- Then update with labels array excluding the ones to remove

**Example:**
\`\`\`
1. Get current issue: mcp__github__get_issue
2. Filter out unwanted labels from the labels array
3. Update with mcp__github__update_issue:
   - owner: repository owner
   - repo: repository name
   - issue_number: current issue/PR number
   - labels: [remaining_labels]  # Array without removed labels
\`\`\``;
}

function generateCreateIssueSkill(config: OutputConfig | Record<string, never>): string {
  return `## Operation: Create Issue

Create a new issue in the repository.

**How to use:**
- Use \`mcp__github__create_issue\` tool
- Required fields: title and body
- Optional: labels, assignees, milestone

**Constraints:**
- Maximum issues: ${getMaxConstraint(config)}

**Example:**
\`\`\`
Use the mcp__github__create_issue tool with:
- owner: repository owner
- repo: repository name
- title: "Clear, descriptive title"
- body: "Detailed description with context"
- labels: ["bug", "priority-high"] (optional)
\`\`\``;
}

function generateCreatePRSkill(config: OutputConfig | Record<string, never>): string {
  const signCommits = hasSignConfig(config);

  return `## Operation: Create Pull Request

Create a pull request with code changes.

**Workflow:**
1. Create a new branch from the base branch
2. Make file modifications using the Edit or Write tools
3. Commit changes${signCommits ? " with signing" : ""}
4. Push the branch
5. Create the pull request using GitHub MCP

**How to use:**
- Use Git commands via Bash tool to create branch, commit, and push
- Use \`mcp__github__create_pull_request\` tool to create the PR
- Required: title, body, head (your branch), base (target branch)

**Constraints:**
- Maximum PRs: ${getMaxConstraint(config)}
${signCommits ? "- Commits must be signed (configured)" : ""}

**Example workflow:**
\`\`\`bash
# Create and checkout new branch
git checkout -b feature/your-change

# Make changes using Edit tool
# (Use Edit tool to modify files)

# Commit changes
git add .
git commit -m "Description of changes"

# Push branch
git push origin feature/your-change
\`\`\`

Then use \`mcp__github__create_pull_request\` with:
- owner: repository owner
- repo: repository name
- title: "Clear PR title"
- body: "Detailed description"
- head: "feature/your-change"
- base: "main" (or appropriate base branch)`;
}

function generateUpdateFileSkill(
  config: OutputConfig | Record<string, never>,
  allowedPaths?: string[],
): string {
  const signCommits = hasSignConfig(config);
  const hasAllowedPaths = allowedPaths && allowedPaths.length > 0;

  const pathsSection = hasAllowedPaths
    ? `
**Allowed paths (glob patterns):**
${allowedPaths.map((p) => `  - \`${p}\``).join("\n")}

**Security notice:** You MUST only modify files matching these patterns. Attempts to modify other files will fail validation.

**Glob pattern examples:**
- \`src/**/*.ts\` matches all TypeScript files in src/ directory and subdirectories
- \`*.md\` matches all markdown files in the root directory
- \`docs/**/*\` matches all files in the docs/ directory`
    : "";

  return `## Operation: Update Files

Modify existing files in the repository.

**Method 1: Using GitHub MCP (Recommended)**
- Use \`mcp__github__create_or_update_file\` tool
- Creates file if it doesn't exist, updates if it does
- Automatically commits and pushes

**Method 2: Using Git Workflow**
1. Use the Read tool to view current file contents
2. Use the Edit tool to make precise changes
3. Commit changes${signCommits ? " with signing" : ""}
4. Push using \`git push\` or \`mcp__github__push_files\`
${pathsSection}

**Constraints:**
${signCommits ? "- Commits must be signed (configured)" : "- Standard commit workflow"}

**Example (MCP method):**
\`\`\`
Use mcp__github__create_or_update_file with:
- owner: repository owner
- repo: repository name
- path: "path/to/file.txt"
- content: "new file content"
- message: "Update file.txt"
- branch: "main" (or feature branch)
\`\`\`

**Example (Git method):**
\`\`\`bash
# Read and modify using Edit tool
# Then commit and push:
git add <modified-files>
git commit -m "Description of changes"
git push
\`\`\``;
}

function generateCloseIssueSkill(_config: OutputConfig | Record<string, never>): string {
  return `## Operation: Close Issue

Close the current issue.

**How to use:**
- Use \`mcp__github__update_issue\` tool
- Set state to "closed"
- Optionally provide a reason in a comment before closing

**Example:**
\`\`\`
Use the mcp__github__update_issue tool with:
- owner: repository owner
- repo: repository name
- issue_number: current issue number
- state: "closed"
- state_reason: "completed" or "not_planned" (optional)
\`\`\``;
}

function generateClosePRSkill(_config: OutputConfig | Record<string, never>): string {
  return `## Operation: Close Pull Request

Close the current pull request.

**How to use:**
- Use \`mcp__github__update_pull_request\` tool
- Set state to "closed"
- Optionally provide a reason in a comment before closing
- Note: To merge instead of just closing, use \`mcp__github__merge_pull_request\`

**Example:**
\`\`\`
Use the mcp__github__update_pull_request tool with:
- owner: repository owner
- repo: repository name
- pull_number: current PR number
- state: "closed"
\`\`\``;
}
