import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class PinIssueHandler implements OutputHandler {
  name = "pin-issue";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for pin-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 3;

    return `## Skill: Pin Issue

Pin an important issue to the repository.

**File to create**: \`/tmp/outputs/pin-issue.json\`

For multiple pins, use numbered suffixes: \`pin-issue-1.json\`, \`pin-issue-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number
}
\`\`\`

**Fields**:
- \`issue_number\` (required): Issue number to pin

**Constraints**:
- Maximum pins: ${maxConstraint} (GitHub allows max 3 pinned issues per repository)
- Only works on issues, not pull requests

**Example**:
Create \`/tmp/outputs/pin-issue.json\` with:
\`\`\`json
{
  "issue_number": 123
}
\`\`\`

**Important**: Use the Write tool to create this file. This uses GitHub's GraphQL API.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max || 3;

    return `
# Validate and execute pin-issue output(s)
PIN_FILES=$(find /tmp/outputs -name "pin-issue*.json" 2>/dev/null || true)

if [ -n "$PIN_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$PIN_FILES" | wc -l)
  echo "Found $FILE_COUNT pin-issue output file(s)"

  # Check max constraint
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **pin-issue**: Too many pin files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/pin-issue.txt
    exit 0
  fi

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for pin_file in $PIN_FILES; do
    echo "Validating $pin_file..."

    # Validate JSON structure
    if ! jq empty "$pin_file" 2>/dev/null; then
      echo "- **pin-issue**: Invalid JSON format in $pin_file" >> /tmp/validation-errors/pin-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ISSUE_NUMBER=$(jq -r '.issue_number' "$pin_file")

    # Validate issue number
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
      echo "- **pin-issue**: issue_number is required in $pin_file" >> /tmp/validation-errors/pin-issue.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$ISSUE_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **pin-issue**: issue_number must be a number in $pin_file" >> /tmp/validation-errors/pin-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $pin_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All pin-issue validations passed - executing..."
    for pin_file in $PIN_FILES; do
      ISSUE_NUMBER=$(jq -r '.issue_number' "$pin_file")

      # Get issue node ID
      ISSUE_NODE_ID=$(gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" --jq '.node_id' 2>/dev/null)

      if [ -z "$ISSUE_NODE_ID" ] || [ "$ISSUE_NODE_ID" = "null" ]; then
        echo "- **pin-issue**: Failed to get node ID for issue #$ISSUE_NUMBER" >> /tmp/validation-errors/pin-issue.txt
        continue
      fi

      # Pin issue via GraphQL mutation
      gh api graphql \\
        -f query='mutation($issueId: ID!) { pinIssue(input: {issueId: $issueId}) { issue { id } } }' \\
        -f issueId="$ISSUE_NODE_ID" || {
        echo "- **pin-issue**: Failed to pin issue #$ISSUE_NUMBER" >> /tmp/validation-errors/pin-issue.txt
      }
    done
  else
    echo "✗ pin-issue validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new PinIssueHandler();
