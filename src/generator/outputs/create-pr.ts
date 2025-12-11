import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';
import { registry } from './index';

class CreatePRHandler implements OutputHandler {
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
- Commits will be made automatically`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const signCommits = config.sign || false;

    return `
# Validate and execute create-pr output
if [ -f "/tmp/outputs/create-pr.json" ]; then
  echo "Validating create-pr output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/create-pr.json 2>/dev/null; then
    echo "- **create-pr**: Invalid JSON format" > /tmp/validation-errors/create-pr.txt
  else
    # Extract fields
    BRANCH=$(jq -r '.branch' /tmp/outputs/create-pr.json)
    TITLE=$(jq -r '.title' /tmp/outputs/create-pr.json)
    BODY=$(jq -r '.body' /tmp/outputs/create-pr.json)
    BASE=$(jq -r '.base // "main"' /tmp/outputs/create-pr.json)
    FILES=$(jq -r '.files' /tmp/outputs/create-pr.json)

    # Validate required fields
    if [ -z "$BRANCH" ] || [ "$BRANCH" = "null" ]; then
      echo "- **create-pr**: branch is required" > /tmp/validation-errors/create-pr.txt
    elif [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-pr**: title is required" > /tmp/validation-errors/create-pr.txt
    elif [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-pr**: body is required" > /tmp/validation-errors/create-pr.txt
    elif [ "$FILES" = "null" ] || ! echo "$FILES" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **create-pr**: files field must be an array" > /tmp/validation-errors/create-pr.txt
    elif [ "$(echo "$FILES" | jq 'length')" -eq 0 ]; then
      echo "- **create-pr**: files array cannot be empty" > /tmp/validation-errors/create-pr.txt
    elif [[ ! "$BRANCH" =~ ^[a-zA-Z0-9/_-]+$ ]]; then
      echo "- **create-pr**: branch name contains invalid characters" > /tmp/validation-errors/create-pr.txt
    else
      # Validation passed - execute
      echo "✓ create-pr validation passed"

      # Configure git
      git config user.name "github-actions[bot]"
      git config user.email "github-actions[bot]@users.noreply.github.com"

      # Create and checkout new branch
      if ! git checkout -b "$BRANCH" 2>/dev/null; then
        echo "- **create-pr**: Failed to create branch '$BRANCH'" > /tmp/validation-errors/create-pr.txt
        exit 0
      fi

      # Create/update each file
      for file_info in $(echo "$FILES" | jq -c '.[]'); do
        FILE_PATH=$(echo "$file_info" | jq -r '.path')
        FILE_CONTENT=$(echo "$file_info" | jq -r '.content')

        # Create directory if needed
        mkdir -p "$(dirname "$FILE_PATH")"

        # Write file content
        echo "$FILE_CONTENT" > "$FILE_PATH"

        # Stage file
        git add "$FILE_PATH"
      done

      # Commit changes
      COMMIT_MESSAGE="$TITLE"
      ${signCommits ? 'git commit -S -m "$COMMIT_MESSAGE"' : 'git commit -m "$COMMIT_MESSAGE"'} || {
        echo "- **create-pr**: Failed to commit changes" > /tmp/validation-errors/create-pr.txt
        exit 0
      }

      # Push branch
      git push origin "$BRANCH" || {
        echo "- **create-pr**: Failed to push branch to remote" > /tmp/validation-errors/create-pr.txt
        exit 0
      }

      # Create pull request
      gh pr create \\
        --title "$TITLE" \\
        --body "$BODY" \\
        --base "$BASE" \\
        --head "$BRANCH" || {
        echo "- **create-pr**: Failed to create pull request via GitHub API" > /tmp/validation-errors/create-pr.txt
      }
    fi
  fi
fi
`;
  }
}

// Register the handler
const handler = new CreatePRHandler();
registry.register('create-pr', handler);

export default handler;
