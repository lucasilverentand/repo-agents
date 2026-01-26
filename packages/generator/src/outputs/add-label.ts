import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";
import { generateLabelsContextScript } from "./base";

interface AddLabelConfig extends OutputConfig {
  "blocked-labels"?: string[];
}

class AddLabelHandler implements OutputHandler {
  name = "add-label";

  getContextScript(runtime: RuntimeContext): string | null {
    return generateLabelsContextScript(runtime.repository);
  }

  generateSkill(config: OutputConfig): string {
    const labelConfig = config as AddLabelConfig;
    const blockedLabels = labelConfig?.["blocked-labels"] ?? [];
    const blockedNote =
      blockedLabels.length > 0
        ? `\n\n**Blocked labels** (you cannot add these): ${blockedLabels.map((l) => `\`${l}\``).join(", ")}`
        : "";

    return `## Skill: Add Labels

Add one or more labels to an issue or pull request.

**Available labels**: See the "Available Repository Labels" section in the context above for the complete list of labels you can use.${blockedNote}

**File to create**: \`/tmp/outputs/add-label.json\`

For multiple label operations, use numbered suffixes: \`add-label-1.json\`, \`add-label-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "labels": ["string"]
}
\`\`\`

**Fields**:
- \`issue_number\` (required for batch/scheduled mode, optional otherwise): The issue or PR number to add labels to
- \`labels\` (required): Array of label names to add

**Constraints**:
- Labels must already exist in the repository (see available labels above)
- Labels array must be non-empty
- Duplicate labels will be ignored
- This operation adds to existing labels (doesn't replace them)${blockedLabels.length > 0 ? `\n- Cannot add blocked labels: ${blockedLabels.join(", ")}` : ""}

**When to include issue_number**:
- In batch/scheduled mode (when processing multiple issues from context), you MUST include \`issue_number\` to specify which issue to label
- In single-issue mode (when triggered by an issue event), \`issue_number\` is optional and defaults to the triggering issue

**Example** (batch mode):
\`\`\`json
{
  "issue_number": 42,
  "labels": ["bug", "priority: high"]
}
\`\`\`

**Example** (single-issue mode):
\`\`\`json
{
  "labels": ["bug", "priority: high"]
}
\`\`\`

**Important**: Use the Write tool to create this file. In batch mode, create separate files for each issue with the appropriate issue_number in each.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const labelConfig = config as AddLabelConfig;
    const blockedLabels = labelConfig?.["blocked-labels"] ?? [];
    const blockedLabelsJson = JSON.stringify(blockedLabels);
    const issueOrPrNumber = runtime.issueOrPrNumber;

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
  BLOCKED_LABELS_ATTEMPTED=""

  # Blocked labels configuration
  BLOCKED_LABELS='${blockedLabelsJson}'

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

    # Validate each label exists and is not blocked
    for label in $(echo "$LABELS_ARRAY" | jq -r '.[]'); do
      # Check if label is blocked
      if echo "$BLOCKED_LABELS" | jq -e --arg label "$label" 'index($label) != null' >/dev/null 2>&1; then
        if [ -z "$BLOCKED_LABELS_ATTEMPTED" ]; then
          BLOCKED_LABELS_ATTEMPTED="$label"
        else
          BLOCKED_LABELS_ATTEMPTED="$BLOCKED_LABELS_ATTEMPTED, $label"
        fi
        VALIDATION_FAILED=true
        continue
      fi

      # Check if label exists in repository
      if ! echo "$EXISTING_LABELS" | jq -e --arg label "$label" 'index($label)' >/dev/null 2>&1; then
        if [ -z "$INVALID_LABELS" ]; then
          INVALID_LABELS="$label"
        else
          INVALID_LABELS="$INVALID_LABELS, $label"
        fi
        VALIDATION_FAILED=true
      fi
    done

    # Merge labels (excluding blocked ones)
    FILTERED_LABELS=$(echo "$LABELS_ARRAY" | jq --argjson blocked "$BLOCKED_LABELS" '[.[] | select(. as $l | $blocked | index($l) | not)]')
    ALL_LABELS=$(echo "$ALL_LABELS" "$FILTERED_LABELS" | jq -s 'add | unique')
    echo "✓ Validation passed for $label_file"
  done

  # Write error if there are blocked labels
  if [ -n "$BLOCKED_LABELS_ATTEMPTED" ]; then
    echo "- **add-label**: The following labels are blocked and cannot be added: $BLOCKED_LABELS_ATTEMPTED" >> /tmp/validation-errors/add-label.txt
  fi

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

export const handler = new AddLabelHandler();
