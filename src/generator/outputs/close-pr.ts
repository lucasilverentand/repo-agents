import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class ClosePrHandler implements OutputHandler {
  readonly name = 'close-pr';

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for close-pr
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Close Pull Request

Close the current pull request or a specific PR by number.

**File to create**: \`/tmp/outputs/close-pr.json\`

**JSON Schema**:
\`\`\`json
{
  "pr_number": number (optional),
  "comment": "string" (optional)
}
\`\`\`

**Fields**:
- \`pr_number\` (optional): PR number to close. If not provided, closes the current PR.
- \`comment\` (optional): Comment to add when closing the PR.

**Constraints**:
- Maximum operations: ${maxConstraint}

**Example**:
Create \`/tmp/outputs/close-pr.json\` with:
\`\`\`json
{
  "comment": "Closing this PR as it's superseded by #123."
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const prNumber = runtime.prNumber;
    const maxConstraint = config.max;

    return `
# Validate and execute close-pr output(s)
CLOSE_PR_FILES=$(find /tmp/outputs -name "close-pr*.json" 2>/dev/null || true)

if [ -n "$CLOSE_PR_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$CLOSE_PR_FILES" | wc -l)
  echo "Found $FILE_COUNT close-pr output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **close-pr**: Too many files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/close-pr.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for close_file in $CLOSE_PR_FILES; do
    echo "Validating $close_file..."

    # Validate JSON structure
    if ! jq empty "$close_file" 2>/dev/null; then
      echo "- **close-pr**: Invalid JSON format in $close_file" >> /tmp/validation-errors/close-pr.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $close_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All close-pr validations passed - executing..."
    for close_file in $CLOSE_PR_FILES; do
      PR_NUM=$(jq -r '.pr_number // "${prNumber}"' "$close_file")
      COMMENT=$(jq -r '.comment' "$close_file")

      # Add comment if provided
      if [ -n "$COMMENT" ] && [ "$COMMENT" != "null" ]; then
        gh api "repos/${runtime.repository}/issues/$PR_NUM/comments" -f body="$COMMENT" || {
          echo "- **close-pr**: Failed to add comment before closing PR #$PR_NUM" >> /tmp/validation-errors/close-pr.txt
        }
      fi

      # Close PR
      gh pr close "$PR_NUM" || {
        echo "- **close-pr**: Failed to close PR #$PR_NUM from $close_file" >> /tmp/validation-errors/close-pr.txt
      }
    done
  else
    echo "✗ close-pr validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new ClosePrHandler();

