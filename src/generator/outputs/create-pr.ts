import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreatePRHandler implements OutputHandler {
  name = 'create-pr' as const;

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-pr
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';
    const signCommits = config.sign || false;

    return `## Skill: Create Pull Request

Create a pull request with code changes.

**File to create**: \`/tmp/outputs/create-pr.json\`

**JSON Schema**:
\`\`\`json
{
  "branch": "string",
  "title": "string",
  "body": "string",
  "base": "string" (optional),
  "files": [
    {
      "path": "string",
      "content": "string"
    }
  ]
}
\`\`\`

**Fields**:
- \`branch\` (required): Name for the new branch (e.g., "feature/add-support")
- \`title\` (required): Clear PR title
- \`body\` (required): Detailed PR description
- \`base\` (optional): Target branch. Defaults to repository's default branch.
- \`files\` (required): Array of files to create/modify
  - \`path\` (required): File path relative to repository root
  - \`content\` (required): Complete file content

**Constraints**:
- Maximum PRs: ${maxConstraint}
- Branch name must be valid (no spaces, special chars)
- Files array must be non-empty
${signCommits ? '- Commits must be signed (GPG signature required)' : ''}

**Example**:
Create \`/tmp/outputs/create-pr.json\` with:
\`\`\`json
{
  "branch": "feature/fix-validation",
  "title": "Fix: Improve validation logic",
  "body": "## Changes\\n\\n- Updated validation rules\\n- Added tests\\n\\n## Testing\\n\\nRan full test suite",
  "base": "main",
  "files": [
    {
      "path": "src/validator.ts",
      "content": "export function validate() { ... }"
    },
    {
      "path": "src/validator.test.ts",
      "content": "describe('validate', () => { ... })"
    }
  ]
}
\`\`\`

**Important**:
- Use the Write tool to create this file
- Provide complete file content for each file
- Branch will be created automatically
- Commits will be made automatically

**Multiple PRs**: To create multiple PRs, use numbered files:
- \`/tmp/outputs/create-pr-1.json\`
- \`/tmp/outputs/create-pr-2.json\`
- etc.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const signCommits = config.sign || false;
    const maxPRs = config.max || 10;

    return `
# Validate and execute create-pr output(s)
# Find all create-pr JSON files (create-pr.json, create-pr-1.json, create-pr-2.json, etc.)
PR_FILES=$(find /tmp/outputs -name "create-pr*.json" 2>/dev/null | sort || true)

if [ -n "$PR_FILES" ]; then
  PR_COUNT=0
  MAX_PRS=${maxPRs}

  for PR_FILE in $PR_FILES; do
    if [ $PR_COUNT -ge $MAX_PRS ]; then
      echo "⚠️ Reached maximum PR limit ($MAX_PRS), skipping remaining files"
      break
    fi

    PR_NAME=$(basename "$PR_FILE" .json)
    echo "Processing $PR_NAME..."

    # Validate JSON structure
    if ! jq empty "$PR_FILE" 2>/dev/null; then
      echo "- **$PR_NAME**: Invalid JSON format" >> /tmp/validation-errors/create-pr.txt
      continue
    fi

    # Extract fields
    BRANCH=$(jq -r '.branch' "$PR_FILE")
    TITLE=$(jq -r '.title' "$PR_FILE")
    BODY=$(jq -r '.body' "$PR_FILE")
    BASE=$(jq -r '.base // "main"' "$PR_FILE")
    FILES=$(jq -r '.files' "$PR_FILE")

    # Validate required fields
    if [ -z "$BRANCH" ] || [ "$BRANCH" = "null" ]; then
      echo "- **$PR_NAME**: branch is required" >> /tmp/validation-errors/create-pr.txt
      continue
    elif [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **$PR_NAME**: title is required" >> /tmp/validation-errors/create-pr.txt
      continue
    elif [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **$PR_NAME**: body is required" >> /tmp/validation-errors/create-pr.txt
      continue
    elif [ "$FILES" = "null" ] || ! echo "$FILES" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **$PR_NAME**: files field must be an array" >> /tmp/validation-errors/create-pr.txt
      continue
    elif [ "$(echo "$FILES" | jq 'length')" -eq 0 ]; then
      echo "- **$PR_NAME**: files array cannot be empty" >> /tmp/validation-errors/create-pr.txt
      continue
    elif [[ ! "$BRANCH" =~ ^[a-zA-Z0-9/_.-]+$ ]]; then
      echo "- **$PR_NAME**: branch name contains invalid characters" >> /tmp/validation-errors/create-pr.txt
      continue
    fi

    # Validation passed - execute
    echo "✓ $PR_NAME validation passed"

    # Configure git with dynamic identity (from GitHub App or default)
    git config user.name "\${GIT_USER:-github-actions[bot]}"
    git config user.email "\${GIT_EMAIL:-github-actions[bot]@users.noreply.github.com}"

    # Return to main branch before creating new branch
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || true

    # Check if PR already exists for this branch
    if gh pr view "$BRANCH" --json state --jq '.state' 2>/dev/null | grep -q "OPEN"; then
      echo "⏭️ PR already exists for branch '$BRANCH', skipping"
      continue
    fi

    # Delete existing remote branch if it exists (from previous failed attempts)
    if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
      echo "🗑️ Deleting existing remote branch '$BRANCH'"
      git push origin --delete "$BRANCH" 2>/dev/null || true
    fi

    # Delete local branch if it exists
    git branch -D "$BRANCH" 2>/dev/null || true

    # Create and checkout new branch
    if ! git checkout -b "$BRANCH" 2>/dev/null; then
      echo "- **$PR_NAME**: Failed to create branch '$BRANCH'" >> /tmp/validation-errors/create-pr.txt
      continue
    fi

    # Create/update each file using jq to extract paths and contents safely
    FILE_COUNT=$(jq '.files | length' "$PR_FILE")
    for i in $(seq 0 $((FILE_COUNT - 1))); do
      FILE_PATH=$(jq -r ".files[$i].path" "$PR_FILE")

      # Create directory if needed
      mkdir -p "$(dirname "$FILE_PATH")"

      # Write file content directly using jq (handles special chars properly)
      jq -r ".files[$i].content" "$PR_FILE" > "$FILE_PATH"

      # Stage file
      git add "$FILE_PATH"
    done

    # Commit changes
    COMMIT_MESSAGE="$TITLE"
    ${signCommits ? 'git commit -S -m "$COMMIT_MESSAGE"' : 'git commit -m "$COMMIT_MESSAGE"'} || {
      echo "- **$PR_NAME**: Failed to commit changes" >> /tmp/validation-errors/create-pr.txt
      git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
      continue
    }

    # Push branch
    git push origin "$BRANCH" || {
      echo "- **$PR_NAME**: Failed to push branch to remote" >> /tmp/validation-errors/create-pr.txt
      git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
      continue
    }

    # Create pull request
    gh pr create \\
      --title "$TITLE" \\
      --body "$BODY" \\
      --base "$BASE" \\
      --head "$BRANCH" && {
      echo "✅ Created PR: $TITLE"
      PR_COUNT=$((PR_COUNT + 1))
    } || {
      echo "- **$PR_NAME**: Failed to create pull request via GitHub API" >> /tmp/validation-errors/create-pr.txt
    }

    # Return to main branch for next PR
    git checkout main 2>/dev/null || git checkout master 2>/dev/null || true
  done

  echo "📊 Created $PR_COUNT PRs"
fi
`;
  }
}

// Register the handler
export const handler = new CreatePRHandler();

export default handler;
