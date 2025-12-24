import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class AddLabelHandler implements OutputHandler {
  name = 'add-label' as const;

  getContextScript(runtime: RuntimeContext): string | null {
    // Fetch available labels from the repository
    return `
# Fetch available labels for context
LABELS_JSON=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')
LABELS_LIST=$(echo "$LABELS_JSON" | jq -r 'join(", ")' 2>/dev/null || echo "No labels available")

cat >> /tmp/context.txt << 'LABELS_EOF'

## Available Repository Labels

The following labels are available in this repository:
$LABELS_LIST

**Important**: You can only add labels that already exist. New labels cannot be created by this agent.

LABELS_EOF
`;
  }

  generateSkill(_config: OutputConfig): string {
    return `## Skill: Add Labels

Add one or more labels to the current issue or pull request.

**Available labels**: See the "Available Repository Labels" section in the context above for the complete list of labels you can use.

**File to create**: \`/tmp/outputs/add-label.json\`

For multiple label operations, use numbered suffixes: \`add-label-1.json\`, \`add-label-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "labels": ["string"]
}
\`\`\`

**Fields**:
- \`labels\` (required): Array of label names to add

**Constraints**:
- Labels must already exist in the repository (see available labels above)
- Labels array must be non-empty
- Duplicate labels will be ignored
- This operation adds to existing labels (doesn't replace them)

**Example**:
Create \`/tmp/outputs/add-label.json\` with:
\`\`\`json
{
  "labels": ["bug", "priority: high"]
}
\`\`\`

**Important**: Use the Write tool to create this file. Only add labels that exist in the available labels list.`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;

    return `
# Validate and execute add-label output(s)
LABEL_FILES=$(find /tmp/outputs -name "add-label*.json" 2>/dev/null || true)

if [ -n "$LABEL_FILES" ]; then
  FILE_COUNT=$(echo "$LABEL_FILES" | wc -l)
  echo "Found $FILE_COUNT add-label output file(s)"

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  ALL_LABELS="[]"
  INVALID_LABELS=""

  # Fetch existing labels from repository
  EXISTING_LABELS=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')

  # Validate each file
  for label_file in $LABEL_FILES; do
    echo "Validating $label_file..."

    # Validate JSON structure
    if ! jq empty "$label_file" 2>/dev/null; then
      echo "- **add-label**: Invalid JSON format in $label_file" >> /tmp/validation-errors/add-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract labels array
    LABELS_ARRAY=$(jq -r '.labels' "$label_file" 2>/dev/null)

    # Validate labels is an array
    if [ "$LABELS_ARRAY" = "null" ] || ! echo "$LABELS_ARRAY" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **add-label**: labels field must be an array in $label_file" >> /tmp/validation-errors/add-label.txt
      VALIDATION_FAILED=true
      continue
    elif [ "$(echo "$LABELS_ARRAY" | jq 'length')" -eq 0 ]; then
      echo "- **add-label**: labels array cannot be empty in $label_file" >> /tmp/validation-errors/add-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate each label exists
    for label in $(echo "$LABELS_ARRAY" | jq -r '.[]'); do
      if ! echo "$EXISTING_LABELS" | jq -e --arg label "$label" 'index($label)' >/dev/null 2>&1; then
        if [ -z "$INVALID_LABELS" ]; then
          INVALID_LABELS="$label"
        else
          INVALID_LABELS="$INVALID_LABELS, $label"
        fi
        VALIDATION_FAILED=true
      fi
    done

    # Merge labels
    ALL_LABELS=$(echo "$ALL_LABELS" "$LABELS_ARRAY" | jq -s 'add | unique')
    echo "✓ Validation passed for $label_file"
  done

  # Write error if there are invalid labels
  if [ -n "$INVALID_LABELS" ]; then
    echo "- **add-label**: The following labels do not exist in the repository: $INVALID_LABELS" >> /tmp/validation-errors/add-label.txt
  fi

  # Check if we have an issue/PR number
  ISSUE_NUMBER="${issueOrPrNumber}"
  if [ -z "$ISSUE_NUMBER" ]; then
    echo "- **add-label**: No issue or PR number available" >> /tmp/validation-errors/add-label.txt
    VALIDATION_FAILED=true
  fi

  # Check if we have any labels to add
  if [ "$(echo "$ALL_LABELS" | jq 'length')" -eq 0 ]; then
    echo "- **add-label**: No valid labels to add" >> /tmp/validation-errors/add-label.txt
    VALIDATION_FAILED=true
  fi

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All add-label validations passed - executing..."

    # Get current labels and merge with new ones to avoid overwriting
    CURRENT_LABELS=$(gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" --jq '.labels[].name' 2>/dev/null | jq -R . | jq -s .)
    MERGED_LABELS=$(echo "$CURRENT_LABELS" "$ALL_LABELS" | jq -s 'add | unique')

    # Add labels via GitHub API
    echo "$MERGED_LABELS" | gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/labels" \\
      -X PUT \\
      --input - || {
      echo "- **add-label**: Failed to add labels via GitHub API" >> /tmp/validation-errors/add-label.txt
    }
  else
    echo "✗ add-label validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Register the handler
export const handler = new AddLabelHandler();

export default handler;
