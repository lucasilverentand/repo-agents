import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class UpdateFileHandler implements OutputHandler {
  name = 'update-file' as const;

  getContextScript(runtime: RuntimeContext): string | null {
    // Include allowed paths in context if specified
    if (!runtime.allowedPaths || runtime.allowedPaths.length === 0) {
      return null;
    }

    const pathsList = runtime.allowedPaths.map((p) => `- \`${p}\``).join('\\n');
    return `
cat >> /tmp/context.txt << 'ALLOWED_PATHS_EOF'

## Allowed File Paths

You can only modify files matching these glob patterns:
${pathsList}

**Important**: Attempts to modify files outside these patterns will fail validation.

ALLOWED_PATHS_EOF
`;
  }

  generateSkill(config: OutputConfig): string {
    const signCommits = config.sign || false;

    return `## Skill: Update Files

Modify existing files in the repository or create new ones.

**File to create**: \`/tmp/outputs/update-file.json\`

**JSON Schema**:
\`\`\`json
{
  "files": [
    {
      "path": "string",
      "content": "string"
    }
  ],
  "message": "string",
  "branch": "string" (optional)
}
\`\`\`

**Fields**:
- \`files\` (required): Array of files to update/create
  - \`path\` (required): File path relative to repository root
  - \`content\` (required): Complete file content
- \`message\` (required): Commit message describing the changes
- \`branch\` (optional): Branch to commit to. Defaults to repository's default branch.

**Constraints**:
- File paths must match allowed patterns (see "Allowed File Paths" section)
- Files array must be non-empty
${signCommits ? '- Commits must be signed (GPG signature required)' : ''}

**Example**:
Create \`/tmp/outputs/update-file.json\` with:
\`\`\`json
{
  "files": [
    {
      "path": "src/config.ts",
      "content": "export const config = { ... };"
    }
  ],
  "message": "Update configuration settings",
  "branch": "main"
}
\`\`\`

**Important**:
- Use the Write tool to create this file
- Provide complete file content, not just changes
- Ensure file paths match allowed patterns`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    const allowedPaths = runtime.allowedPaths || [];

    return `
# Validate and execute update-file output
if [ -f "/tmp/outputs/update-file.json" ]; then
  echo "Validating update-file output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/update-file.json 2>/dev/null; then
    echo "- **update-file**: Invalid JSON format" > /tmp/validation-errors/update-file.txt
  else
    # Extract fields
    FILES=$(jq -r '.files' /tmp/outputs/update-file.json)
    MESSAGE=$(jq -r '.message' /tmp/outputs/update-file.json)
    BRANCH=$(jq -r '.branch // "main"' /tmp/outputs/update-file.json)

    # Validate required fields
    if [ "$FILES" = "null" ] || ! echo "$FILES" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **update-file**: files field must be an array" > /tmp/validation-errors/update-file.txt
    elif [ "$(echo "$FILES" | jq 'length')" -eq 0 ]; then
      echo "- **update-file**: files array cannot be empty" > /tmp/validation-errors/update-file.txt
    elif [ -z "$MESSAGE" ] || [ "$MESSAGE" = "null" ]; then
      echo "- **update-file**: message is required" > /tmp/validation-errors/update-file.txt
    else
      # Validate each file path against allowed patterns
      ALLOWED_PATTERNS="${allowedPaths.map((p) => `"${p}"`).join(' ')}"
      VALIDATION_FAILED=false

      for file_path in $(echo "$FILES" | jq -r '.[].path'); do
        MATCHED=false

        # Check if path matches any allowed pattern (basic glob matching)
        for pattern in $ALLOWED_PATTERNS; do
          pattern_clean=\${pattern//\"/}
          # Simple pattern matching - in production, use proper glob matching
          if [[ "$file_path" == $pattern_clean ]]; then
            MATCHED=true
            break
          fi
        done

        if [ "$MATCHED" = false ]; then
          echo "- **update-file**: File path '$file_path' does not match allowed patterns" >> /tmp/validation-errors/update-file.txt
          VALIDATION_FAILED=true
        fi
      done

      # If validation failed, skip execution
      if [ "$VALIDATION_FAILED" = true ]; then
        exit 0
      fi

      # Validation passed - execute
      echo "✓ update-file validation passed"

      # Update files via GitHub API
      for file_info in $(echo "$FILES" | jq -c '.[]'); do
        FILE_PATH=$(echo "$file_info" | jq -r '.path')
        FILE_CONTENT=$(echo "$file_info" | jq -r '.content')

        # Get current file SHA if it exists
        FILE_SHA=$(gh api "repos/${runtime.repository}/contents/$FILE_PATH" --jq '.sha' 2>/dev/null || echo "")

        # Build payload
        if [ -n "$FILE_SHA" ]; then
          # File exists - update it
          PAYLOAD=$(jq -n \\
            --arg content "$(echo -n "$FILE_CONTENT" | base64)" \\
            --arg message "$MESSAGE" \\
            --arg branch "$BRANCH" \\
            --arg sha "$FILE_SHA" \\
            '{message: $message, content: $content, branch: $branch, sha: $sha}')
        else
          # File doesn't exist - create it
          PAYLOAD=$(jq -n \\
            --arg content "$(echo -n "$FILE_CONTENT" | base64)" \\
            --arg message "$MESSAGE" \\
            --arg branch "$BRANCH" \\
            '{message: $message, content: $content, branch: $branch}')
        fi

        # Execute API call
        gh api "repos/${runtime.repository}/contents/$FILE_PATH" \\
          -X PUT \\
          --input - <<< "$PAYLOAD" || {
          echo "- **update-file**: Failed to update file '$FILE_PATH' via GitHub API" >> /tmp/validation-errors/update-file.txt
        }
      done
    fi
  fi
fi
`;
  }
}

// Register the handler
export const handler = new UpdateFileHandler();

export default handler;
