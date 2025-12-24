import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CloseIssueHandler implements OutputHandler {
  name = 'close-issue' as const;

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for close-issue
    return null;
  }

  generateSkill(_config: OutputConfig): string {
    return `## Skill: Close Issue

Close the current issue.

**File to create**: \`/tmp/outputs/close-issue.json\`

**JSON Schema**:
\`\`\`json
{
  "state_reason": "completed" | "not_planned"
}
\`\`\`

**Fields**:
- \`state_reason\` (optional): Reason for closing. Either "completed" or "not_planned". Defaults to "completed".

**Example**:
Create \`/tmp/outputs/close-issue.json\` with:
\`\`\`json
{
  "state_reason": "completed"
}
\`\`\`

**Important**:
- Use this sparingly - only close issues when you're certain they should be closed
- Consider adding a comment explaining why before closing
- Use the Write tool to create this file`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    return `
# Validate and execute close-issue output
if [ -f "/tmp/outputs/close-issue.json" ]; then
  echo "Validating close-issue output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/close-issue.json 2>/dev/null; then
    echo "- **close-issue**: Invalid JSON format" > /tmp/validation-errors/close-issue.txt
  else
    # Extract state_reason (optional, defaults to completed)
    STATE_REASON=$(jq -r '.state_reason // "completed"' /tmp/outputs/close-issue.json)

    # Validate state_reason
    if [ "$STATE_REASON" != "completed" ] && [ "$STATE_REASON" != "not_planned" ]; then
      echo "- **close-issue**: state_reason must be 'completed' or 'not_planned', got: $STATE_REASON" > /tmp/validation-errors/close-issue.txt
    else
      # Validation passed - execute
      echo "✓ close-issue validation passed"

      # Check if we have an issue number
      ISSUE_NUMBER="${runtime.issueNumber || ''}"
      if [ -z "$ISSUE_NUMBER" ]; then
        echo "- **close-issue**: No issue number available" > /tmp/validation-errors/close-issue.txt
      else
        # Close issue via GitHub API
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" \\
          -X PATCH \\
          -f state="closed" \\
          -f state_reason="$STATE_REASON" || {
          echo "- **close-issue**: Failed to close issue via GitHub API" > /tmp/validation-errors/close-issue.txt
        }
      fi
    fi
  fi
fi
`;
  }
}

// Register the handler
export const handler = new CloseIssueHandler();

export default handler;
