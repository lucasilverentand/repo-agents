import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CloseIssueHandler implements OutputHandler {
  readonly name = 'close-issue';

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for close-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Close Issue

Close the current issue or a specific issue by number.

**File to create**: \`/tmp/outputs/close-issue.json\`

**JSON Schema**:
\`\`\`json
{
  "issue_number": number (optional),
  "reason": "completed" | "not_planned" (optional),
  "comment": "string" (optional)
}
\`\`\`

**Fields**:
- \`issue_number\` (optional): Issue number to close. If not provided, closes the current issue.
- \`reason\` (optional): Reason for closing. Either "completed" (default) or "not_planned".
- \`comment\` (optional): Comment to add when closing the issue.

**Constraints**:
- Maximum operations: ${maxConstraint}

**Example**:
Create \`/tmp/outputs/close-issue.json\` with:
\`\`\`json
{
  "reason": "completed",
  "comment": "This issue has been resolved. Thank you for reporting!"
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const issueNumber = runtime.issueNumber;
    const maxConstraint = config.max;

    return `
# Validate and execute close-issue output(s)
CLOSE_ISSUE_FILES=$(find /tmp/outputs -name "close-issue*.json" 2>/dev/null || true)

if [ -n "$CLOSE_ISSUE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$CLOSE_ISSUE_FILES" | wc -l)
  echo "Found $FILE_COUNT close-issue output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **close-issue**: Too many files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/close-issue.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for close_file in $CLOSE_ISSUE_FILES; do
    echo "Validating $close_file..."

    # Validate JSON structure
    if ! jq empty "$close_file" 2>/dev/null; then
      echo "- **close-issue**: Invalid JSON format in $close_file" >> /tmp/validation-errors/close-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $close_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All close-issue validations passed - executing..."
    for close_file in $CLOSE_ISSUE_FILES; do
      ISSUE_NUM=$(jq -r '.issue_number // "${issueNumber}"' "$close_file")
      REASON=$(jq -r '.reason // "completed"' "$close_file")
      COMMENT=$(jq -r '.comment' "$close_file")

      # Add comment if provided
      if [ -n "$COMMENT" ] && [ "$COMMENT" != "null" ]; then
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUM/comments" -f body="$COMMENT" || {
          echo "- **close-issue**: Failed to add comment before closing issue #$ISSUE_NUM" >> /tmp/validation-errors/close-issue.txt
        }
      fi

      # Close issue
      gh api -X PATCH "repos/${runtime.repository}/issues/$ISSUE_NUM" \\
        -f state="closed" -f state_reason="$REASON" || {
        echo "- **close-issue**: Failed to close issue #$ISSUE_NUM from $close_file" >> /tmp/validation-errors/close-issue.txt
      }
    done
  else
    echo "✗ close-issue validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new CloseIssueHandler();

