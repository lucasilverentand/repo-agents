import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class RemoveLabelHandler implements OutputHandler {
  name = 'remove-label' as const;

  getContextScript(runtime: RuntimeContext): string | null {
    // Fetch available labels from the repository (same as add-label)
    // Note: If both add-label and remove-label are enabled, this will be duplicated
    // but that's okay as the context appending is idempotent
    return `
# Fetch available labels for context
LABELS_JSON=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')
LABELS_LIST=$(echo "$LABELS_JSON" | jq -r 'join(", ")' 2>/dev/null || echo "No labels available")

cat >> /tmp/context.txt << 'LABELS_EOF'

## Available Repository Labels

The following labels are available in this repository:
$LABELS_LIST

LABELS_EOF
`;
  }

  generateSkill(_config: OutputConfig): string {
    return `## Skill: Remove Labels

Remove one or more labels from the current issue or pull request.

**Available labels**: See the "Available Repository Labels" section in the context above for the complete list of labels.

**File to create**: \`/tmp/outputs/remove-label.json\`

**JSON Schema**:
\`\`\`json
{
  "labels": ["string"]
}
\`\`\`

**Fields**:
- \`labels\` (required): Array of label names to remove

**Constraints**:
- Labels array must be non-empty
- Attempting to remove non-existent labels will be silently ignored

**Example**:
Create \`/tmp/outputs/remove-label.json\` with:
\`\`\`json
{
  "labels": ["needs-triage", "duplicate"]
}
\`\`\`

**Important**: Use the Write tool to create this file. Only removes specified labels, keeps all others.`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;

    return `
# Validate and execute remove-label output
if [ -f "/tmp/outputs/remove-label.json" ]; then
  echo "Validating remove-label output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/remove-label.json 2>/dev/null; then
    echo "- **remove-label**: Invalid JSON format" > /tmp/validation-errors/remove-label.txt
  else
    # Extract labels array
    LABELS_ARRAY=$(jq -r '.labels' /tmp/outputs/remove-label.json 2>/dev/null)

    # Validate labels is an array
    if [ "$LABELS_ARRAY" = "null" ] || ! echo "$LABELS_ARRAY" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **remove-label**: labels field must be an array" > /tmp/validation-errors/remove-label.txt
    elif [ "$(echo "$LABELS_ARRAY" | jq 'length')" -eq 0 ]; then
      echo "- **remove-label**: labels array cannot be empty" > /tmp/validation-errors/remove-label.txt
    else
      # Validation passed - execute
      echo "✓ remove-label validation passed"

      # Check if we have an issue/PR number
      ISSUE_NUMBER="${issueOrPrNumber}"
      if [ -z "$ISSUE_NUMBER" ]; then
        echo "- **remove-label**: No issue or PR number available" > /tmp/validation-errors/remove-label.txt
      else
        # Get current labels
        CURRENT_LABELS=$(gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" --jq '.labels[].name' 2>/dev/null | jq -R . | jq -s .)

        # Filter out labels to remove
        LABELS_TO_REMOVE=$(echo "$LABELS_ARRAY" | jq -r '.[]' | jq -R . | jq -s .)
        REMAINING_LABELS=$(echo "$CURRENT_LABELS" | jq --argjson remove "$LABELS_TO_REMOVE" '[.[] | select(. as $label | $remove | index($label) | not)]')

        # Update labels via GitHub API
        echo "$REMAINING_LABELS" | gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/labels" \\
          -X PUT \\
          --input - || {
          echo "- **remove-label**: Failed to remove labels via GitHub API" > /tmp/validation-errors/remove-label.txt
        }
      fi
    fi
  fi
fi
`;
  }
}

// Register the handler
export const handler = new RemoveLabelHandler();

export default handler;
