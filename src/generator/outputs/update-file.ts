import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class UpdateFileHandler implements OutputHandler {
  readonly name = 'update-file';

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for update-file
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';
    const allowedPaths = config.allowed_paths
      ? `\n- Allowed file paths: ${(config.allowed_paths as string[]).join(', ')}`
      : '';

    return `## Skill: Update File

Update files in the repository.

**File to create**: \`/tmp/outputs/update-file.json\`

For multiple file updates, use numbered suffixes: \`update-file-1.json\`, \`update-file-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "path": "string",
  "content": "string",
  "message": "string"
}
\`\`\`

**Fields**:
- \`path\` (required): File path relative to repository root
- \`content\` (required): Complete new file content
- \`message\` (required): Commit message

**Constraints**:
- Maximum file updates: ${maxConstraint}${allowedPaths}
- Path must be within allowed paths

**Example**:
Create \`/tmp/outputs/update-file.json\` with:
\`\`\`json
{
  "path": "README.md",
  "content": "# Updated README\n\nNew content here...",
  "message": "docs: update README with new information"
}
\`\`\`

**Important**: Use the Write tool to create this file. Provide the complete file content, not just a diff.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;
    const allowedPaths = runtime.allowedPaths || [];

    return `
# Validate and execute update-file output(s)
UPDATE_FILES=$(find /tmp/outputs -name "update-file*.json" 2>/dev/null || true)

if [ -n "$UPDATE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$UPDATE_FILES" | wc -l)
  echo "Found $FILE_COUNT update-file output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **update-file**: Too many update files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/update-file.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for update_file in $UPDATE_FILES; do
    echo "Validating $update_file..."

    # Validate JSON structure
    if ! jq empty "$update_file" 2>/dev/null; then
      echo "- **update-file**: Invalid JSON format in $update_file" >> /tmp/validation-errors/update-file.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    FILE_PATH=$(jq -r '.path' "$update_file")
    CONTENT=$(jq -r '.content' "$update_file")
    MESSAGE=$(jq -r '.message' "$update_file")

    # Validate required fields
    if [ -z "$FILE_PATH" ] || [ "$FILE_PATH" = "null" ]; then
      echo "- **update-file**: Path is missing in $update_file" >> /tmp/validation-errors/update-file.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$CONTENT" ] || [ "$CONTENT" = "null" ]; then
      echo "- **update-file**: Content is missing in $update_file" >> /tmp/validation-errors/update-file.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$MESSAGE" ] || [ "$MESSAGE" = "null" ]; then
      echo "- **update-file**: Commit message is missing in $update_file" >> /tmp/validation-errors/update-file.txt
      VALIDATION_FAILED=true
      continue
    fi

    ${allowedPaths.length > 0 ? `
    # Validate file path against allowed patterns
    ALLOWED=false
    ${allowedPaths.map((pattern) => `if [[ "$FILE_PATH" == ${pattern} ]]; then ALLOWED=true; fi`).join('\n    ')}
    if [ "$ALLOWED" = false ]; then
      echo "- **update-file**: File path '$FILE_PATH' is not in allowed paths (from $update_file)" >> /tmp/validation-errors/update-file.txt
      VALIDATION_FAILED=true
      continue
    fi
    ` : ''}

    echo "✓ Validation passed for $update_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All update-file validations passed - executing..."
    for update_file in $UPDATE_FILES; do
      FILE_PATH=$(jq -r '.path' "$update_file")
      CONTENT=$(jq -r '.content' "$update_file")
      MESSAGE=$(jq -r '.message' "$update_file")

      # Write file content
      mkdir -p "$(dirname "$FILE_PATH")"
      echo "$CONTENT" > "$FILE_PATH"

      # Commit change
      git add "$FILE_PATH"
      git commit -m "$MESSAGE" || {
        echo "- **update-file**: Failed to commit changes to '$FILE_PATH' from $update_file" >> /tmp/validation-errors/update-file.txt
        continue
      }

      # Push changes
      git push origin HEAD || {
        echo "- **update-file**: Failed to push changes for '$FILE_PATH' from $update_file" >> /tmp/validation-errors/update-file.txt
      }
    done
  else
    echo "✗ update-file validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new UpdateFileHandler();

