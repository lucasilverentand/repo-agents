import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class AddLabelHandler implements OutputHandler {
  readonly name = 'add-label';

  getContextScript(runtime: RuntimeContext): string | null {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;

    return `
# Fetch available repository labels
echo "" >> /tmp/context.txt
echo "## Available Repository Labels" >> /tmp/context.txt
echo "" >> /tmp/context.txt
echo "The following labels are available in this repository:" >> /tmp/context.txt

LABELS_LIST=$(gh api "repos/${runtime.repository}/labels?per_page=100" --jq '.[] | "- \\`" + .name + "\\`: " + .description' || echo "Failed to fetch labels")
echo "$LABELS_LIST" >> /tmp/context.txt

if [ "$LABELS_LIST" = "Failed to fetch labels" ]; then
  echo "" >> /tmp/context.txt
  echo "**Note**: Could not fetch labels. Make sure the labels exist before using them." >> /tmp/context.txt
else
  echo "" >> /tmp/context.txt
  echo "**Important**: You can only add labels that already exist. New labels cannot be created by this agent." >> /tmp/context.txt
fi

# Make labels list available for validation
if [ -n "${issueOrPrNumber}" ]; then
  gh api "repos/${runtime.repository}/labels?per_page=100" --jq '.[].name' > /tmp/available-labels.txt 2>/dev/null || true
fi
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

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
- Maximum operations: ${maxConstraint}
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

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;
    const maxConstraint = config.max;

    return `
# Validate and execute add-label output(s)
LABEL_FILES=$(find /tmp/outputs -name "add-label*.json" 2>/dev/null || true)

if [ -n "$LABEL_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$LABEL_FILES" | wc -l)
  echo "Found $FILE_COUNT add-label output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **add-label**: Too many label files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/add-label.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for label_file in $LABEL_FILES; do
    echo "Validating $label_file..."

    # Validate JSON structure
    if ! jq empty "$label_file" 2>/dev/null; then
      echo "- **add-label**: Invalid JSON format in $label_file" >> /tmp/validation-errors/add-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract labels array
    LABELS=$(jq -r '.labels[]' "$label_file" 2>/dev/null)

    # Validate labels array is non-empty
    if [ -z "$LABELS" ]; then
      echo "- **add-label**: Labels array is empty or missing in $label_file" >> /tmp/validation-errors/add-label.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate labels exist in repository (if we have the list)
    if [ -f /tmp/available-labels.txt ]; then
      while IFS= read -r label; do
        if ! grep -Fxq "$label" /tmp/available-labels.txt; then
          echo "- **add-label**: Label '$label' does not exist in repository (from $label_file)" >> /tmp/validation-errors/add-label.txt
          VALIDATION_FAILED=true
        fi
      done <<< "$LABELS"
    fi

    echo "✓ Validation passed for $label_file"
  done

  # Check if we have an issue/PR number
  ISSUE_NUMBER="${issueOrPrNumber}"
  if [ -z "$ISSUE_NUMBER" ]; then
    echo "- **add-label**: No issue or PR number available" >> /tmp/validation-errors/add-label.txt
    VALIDATION_FAILED=true
  fi

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All add-label validations passed - executing..."
    for label_file in $LABEL_FILES; do
      LABELS_JSON=$(jq -c '.labels' "$label_file")

      # Add labels via GitHub API
      gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/labels" \\
        -f labels="$LABELS_JSON" || {
        echo "- **add-label**: Failed to add labels from $label_file via GitHub API" >> /tmp/validation-errors/add-label.txt
      }
    done
  else
    echo "✗ add-label validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new AddLabelHandler();

