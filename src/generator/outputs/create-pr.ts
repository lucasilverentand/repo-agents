import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreatePrHandler implements OutputHandler {
  readonly name = 'create-pr';

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-pr
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 5;
    const allowedPaths = config.allowed_paths
      ? `\n- Allowed file paths: ${(config.allowed_paths as string[]).join(', ')}`
      : '';

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
- Maximum PRs: ${maxConstraint}${allowedPaths}
- Branch name must be valid (no spaces, special chars)
- Files array must be non-empty

**Example**:
Create \`/tmp/outputs/create-pr.json\` with:
\`\`\`json
{
  "branch": "feature/fix-validation",
  "title": "Fix: Improve validation logic",
  "body": "## Changes\n\n- Updated validation rules\n- Added tests\n\n## Testing\n\nRan full test suite",
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

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max || 5;
    const allowedPaths = runtime.allowedPaths || [];

    return `
# Validate and execute create-pr output(s)
PR_FILES=$(find /tmp/outputs -name "create-pr*.json" 2>/dev/null || true)

if [ -n "$PR_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$PR_FILES" | wc -l)
  echo "Found $FILE_COUNT create-pr output file(s)"

  # Check max constraint
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **create-pr**: Too many PR files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/create-pr.txt
    exit 0
  fi

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for pr_file in $PR_FILES; do
    echo "Validating $pr_file..."

    # Validate JSON structure
    if ! jq empty "$pr_file" 2>/dev/null; then
      echo "- **create-pr**: Invalid JSON format in $pr_file" >> /tmp/validation-errors/create-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    BRANCH=$(jq -r '.branch' "$pr_file")
    TITLE=$(jq -r '.title' "$pr_file")
    BODY=$(jq -r '.body' "$pr_file")
    FILES_COUNT=$(jq '.files | length' "$pr_file")

    # Validate required fields
    if [ -z "$BRANCH" ] || [ "$BRANCH" = "null" ]; then
      echo "- **create-pr**: Branch name is missing in $pr_file" >> /tmp/validation-errors/create-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-pr**: Title is missing in $pr_file" >> /tmp/validation-errors/create-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-pr**: Body is missing in $pr_file" >> /tmp/validation-errors/create-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ "$FILES_COUNT" -eq 0 ]; then
      echo "- **create-pr**: Files array is empty in $pr_file" >> /tmp/validation-errors/create-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    ${allowedPaths.length > 0 ? `
    # Validate file paths against allowed patterns
    FILE_PATHS=$(jq -r '.files[].path' "$pr_file")
    while IFS= read -r file_path; do
      ALLOWED=false
      ${allowedPaths.map((pattern) => `if [[ "$file_path" == ${pattern} ]]; then ALLOWED=true; fi`).join('\n      ')}
      if [ "$ALLOWED" = false ]; then
        echo "- **create-pr**: File path '$file_path' is not in allowed paths (from $pr_file)" >> /tmp/validation-errors/create-pr.txt
        VALIDATION_FAILED=true
      fi
    done <<< "$FILE_PATHS"
    ` : ''}

    echo "✓ Validation passed for $pr_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-pr validations passed - executing..."
    for pr_file in $PR_FILES; do
      BRANCH=$(jq -r '.branch' "$pr_file")
      TITLE=$(jq -r '.title' "$pr_file")
      BODY=$(jq -r '.body' "$pr_file")
      BASE=$(jq -r '.base // "main"' "$pr_file")

      # Create and checkout new branch
      git checkout -b "$BRANCH" "$BASE" || {
        echo "- **create-pr**: Failed to create branch '$BRANCH' from $pr_file" >> /tmp/validation-errors/create-pr.txt
        continue
      }

      # Write all files
      jq -c '.files[]' "$pr_file" | while read -r file_obj; do
        FILE_PATH=$(echo "$file_obj" | jq -r '.path')
        FILE_CONTENT=$(echo "$file_obj" | jq -r '.content')
        mkdir -p "$(dirname "$FILE_PATH")"
        echo "$FILE_CONTENT" > "$FILE_PATH"
        git add "$FILE_PATH"
      done

      # Commit changes
      git commit -m "$TITLE" || {
        echo "- **create-pr**: Failed to commit changes from $pr_file" >> /tmp/validation-errors/create-pr.txt
        continue
      }

      # Push branch
      git push origin "$BRANCH" || {
        echo "- **create-pr**: Failed to push branch '$BRANCH' from $pr_file" >> /tmp/validation-errors/create-pr.txt
        continue
      }

      # Create PR
      gh pr create --title "$TITLE" --body "$BODY" --base "$BASE" || {
        echo "- **create-pr**: Failed to create PR from $pr_file" >> /tmp/validation-errors/create-pr.txt
      }
    done
  else
    echo "✗ create-pr validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new CreatePrHandler();

