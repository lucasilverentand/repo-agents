import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class RemoveLabelHandler implements OutputHandler {
  readonly name = 'remove-label';

  getContextScript(runtime: RuntimeContext): string | null {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;

    return `
# Fetch current labels on the issue/PR
if [ -n "${issueOrPrNumber}" ]; then
  echo "" >> /tmp/context.txt
  echo "## Current Labels" >> /tmp/context.txt
  echo "" >> /tmp/context.txt
  echo "The following labels are currently on this issue/PR:" >> /tmp/context.txt

  CURRENT_LABELS=$(gh api "repos/${runtime.repository}/issues/${issueOrPrNumber}/labels" --jq '.[].name' || echo "Failed to fetch labels")
  if [ "$CURRENT_LABELS" = "Failed to fetch labels" ]; then
    echo "Failed to fetch current labels" >> /tmp/context.txt
  else
    echo "$CURRENT_LABELS" | while read -r label; do
      echo "- \`$label\`" >> /tmp/context.txt
    done
  fi
fi
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Remove Labels

Remove one or more labels from the current issue or pull request.

**Current labels**: See the "Current Labels" section in the context above.

**File to create**: \`/tmp/outputs/remove-label.json\`

For multiple removal operations, use numbered suffixes: \`remove-label-1.json\`, \`remove-label-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "labels": ["string"]
}
\`\`\`

**Fields**:
- \`labels\` (required): Array of label names to remove

**Constraints**:
- Maximum operations: ${maxConstraint}
- Labels array must be non-empty
- Only labels that are currently on the issue/PR can be removed

**Example**:
Create \`/tmp/outputs/remove-label.json\` with:
\`\`\`json
{
  "labels": ["needs-triage", "duplicate"]
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;
    const maxConstraint = config.max;

    return `
# Validate and execute remove-label output(s)
REMOVE_LABEL_FILES=$(find /tmp/outputs -name "remove-label*.json" 2>/dev/null || true)

if [ -n "$REMOVE_LABEL_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$REMOVE_LABEL_FILES" | wc -l)
  echo "Found $FILE_COUNT remove-label output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **remove-label**: Too many files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/remove-label.txt
    exit 0
  fi`
      : ''
  }

  # Check if we have an issue/PR number
  ISSUE_NUMBER="${issueOrPrNumber}"
  if [ -z "$ISSUE_NUMBER" ]; then
    echo "- **remove-label**: No issue or PR number available" >> /tmp/validation-errors/remove-label.txt
    exit 0
  fi

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for label_file in $REMOVE_LABEL_FILES; do
    echo "Validating $label_file..."

    # Validate JSON structure
    if ! jq empty "$label_file" 2>/dev/null; then
      echo "- **remove-label**: Invalid JSON format in $label_file" >> /tmp/validation-errors/remove-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract labels array
    LABELS=$(jq -r '.labels[]' "$label_file" 2>/dev/null)

    # Validate labels array is non-empty
    if [ -z "$LABELS" ]; then
      echo "- **remove-label**: Labels array is empty or missing in $label_file" >> /tmp/validation-errors/remove-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $label_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All remove-label validations passed - executing..."
    for label_file in $REMOVE_LABEL_FILES; do
      LABELS=$(jq -r '.labels[]' "$label_file")

      # Remove each label via GitHub API
      while IFS= read -r label; do
        gh api -X DELETE "repos/${runtime.repository}/issues/$ISSUE_NUMBER/labels/$(echo "$label" | jq -sRr @uri)" || {
          echo "- **remove-label**: Failed to remove label '$label' from $label_file" >> /tmp/validation-errors/remove-label.txt
        }
      done <<< "$LABELS"
    done
  else
    echo "✗ remove-label validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new RemoveLabelHandler();

