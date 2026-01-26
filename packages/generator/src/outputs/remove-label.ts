import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";
import { generateLabelsContextScript } from "./base";

class RemoveLabelHandler implements OutputHandler {
  name = "remove-label";

  getContextScript(runtime: RuntimeContext): string | null {
    return generateLabelsContextScript(runtime.repository);
  }

  generateSkill(_config: OutputConfig): string {
    return `## Skill: Remove Labels

Remove one or more labels from an issue or pull request.

**Available labels**: See the "Available Repository Labels" section in the context above for the complete list of labels.

**File to create**: \`/tmp/outputs/remove-label.json\`

For multiple remove operations, use numbered suffixes: \`remove-label-1.json\`, \`remove-label-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "labels": ["string"]
}
\`\`\`

**Fields**:
- \`issue_number\` (required for batch/scheduled mode, optional otherwise): The issue or PR number to remove labels from
- \`labels\` (required): Array of label names to remove

**Constraints**:
- Labels array must be non-empty
- Attempting to remove non-existent labels will be silently ignored

**When to include issue_number**:
- In batch/scheduled mode (when processing multiple issues from context), you MUST include \`issue_number\` to specify which issue to modify
- In single-issue mode (when triggered by an issue event), \`issue_number\` is optional and defaults to the triggering issue

**Example** (batch mode):
\`\`\`json
{
  "issue_number": 42,
  "labels": ["needs-triage", "duplicate"]
}
\`\`\`

**Example** (single-issue mode):
\`\`\`json
{
  "labels": ["needs-triage", "duplicate"]
}
\`\`\`

**Important**: Use the Write tool to create this file. In batch mode, create separate files for each issue with the appropriate issue_number in each.`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueOrPrNumber;

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

export const handler = new RemoveLabelHandler();
