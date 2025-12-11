import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';
import { registry } from './index';

class AddLabelHandler implements OutputHandler {
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
# Validate and execute add-label output
if [ -f "/tmp/outputs/add-label.json" ]; then
  echo "Validating add-label output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/add-label.json 2>/dev/null; then
    echo "- **add-label**: Invalid JSON format" > /tmp/validation-errors/add-label.txt
  else
    # Extract labels array
    LABELS_ARRAY=$(jq -r '.labels' /tmp/outputs/add-label.json 2>/dev/null)

    # Validate labels is an array
    if [ "$LABELS_ARRAY" = "null" ] || ! echo "$LABELS_ARRAY" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **add-label**: labels field must be an array" > /tmp/validation-errors/add-label.txt
    elif [ "$(echo "$LABELS_ARRAY" | jq 'length')" -eq 0 ]; then
      echo "- **add-label**: labels array cannot be empty" > /tmp/validation-errors/add-label.txt
    else
      # Fetch existing labels from repository
      EXISTING_LABELS=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')

      # Validate each label exists
      INVALID_LABELS=""
      for label in $(echo "$LABELS_ARRAY" | jq -r '.[]'); do
        if ! echo "$EXISTING_LABELS" | jq -e --arg label "$label" 'index($label)' >/dev/null 2>&1; then
          if [ -z "$INVALID_LABELS" ]; then
            INVALID_LABELS="$label"
          else
            INVALID_LABELS="$INVALID_LABELS, $label"
          fi
        fi
      done

      # If there are invalid labels, write error and skip execution
      if [ -n "$INVALID_LABELS" ]; then
        echo "- **add-label**: The following labels do not exist in the repository: $INVALID_LABELS" > /tmp/validation-errors/add-label.txt
      else
        # Validation passed - execute
        echo "✓ add-label validation passed"

        # Check if we have an issue/PR number
        ISSUE_NUMBER="${issueOrPrNumber}"
        if [ -z "$ISSUE_NUMBER" ]; then
          echo "- **add-label**: No issue or PR number available" > /tmp/validation-errors/add-label.txt
        else
          # Get current labels and merge with new ones to avoid overwriting
          CURRENT_LABELS=$(gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" --jq '.labels[].name' 2>/dev/null | jq -R . | jq -s .)
          NEW_LABELS=$(echo "$LABELS_ARRAY" | jq -r '.[]' | jq -R . | jq -s .)
          MERGED_LABELS=$(echo "$CURRENT_LABELS" "$NEW_LABELS" | jq -s 'add | unique')

          # Add labels via GitHub API
          echo "$MERGED_LABELS" | gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/labels" \\
            -X PUT \\
            --input - || {
            echo "- **add-label**: Failed to add labels via GitHub API" > /tmp/validation-errors/add-label.txt
          }
        fi
      fi
    fi
  fi
fi
`;
  }
}

// Register the handler
const handler = new AddLabelHandler();
registry.register('add-label', handler);

export default handler;
