import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class LockConversationHandler implements OutputHandler {
  name = "lock-conversation";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for lock-conversation
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Lock Conversation

Lock an issue or pull request conversation.

**File to create**: \`/tmp/outputs/lock-conversation.json\`

For multiple locks, use numbered suffixes: \`lock-conversation-1.json\`, \`lock-conversation-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "lock_reason": "off-topic" | "too heated" | "resolved" | "spam"
}
\`\`\`

**Fields**:
- \`issue_number\` (required): Issue or PR number to lock
- \`lock_reason\` (optional): Reason for locking - "off-topic", "too heated", "resolved", or "spam"

**Constraints**:
- Maximum locks: ${maxConstraint}
- Only these lock reasons are supported by GitHub

**Example**:
Create \`/tmp/outputs/lock-conversation.json\` with:
\`\`\`json
{
  "issue_number": 123,
  "lock_reason": "resolved"
}
\`\`\`

**Important**: Use the Write tool to create this file. Locking prevents new comments.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute lock-conversation output(s)
LOCK_FILES=$(find /tmp/outputs -name "lock-conversation*.json" 2>/dev/null || true)

if [ -n "$LOCK_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$LOCK_FILES" | wc -l)
  echo "Found $FILE_COUNT lock-conversation output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **lock-conversation**: Too many lock files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/lock-conversation.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for lock_file in $LOCK_FILES; do
    echo "Validating $lock_file..."

    # Validate JSON structure
    if ! jq empty "$lock_file" 2>/dev/null; then
      echo "- **lock-conversation**: Invalid JSON format in $lock_file" >> /tmp/validation-errors/lock-conversation.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ISSUE_NUMBER=$(jq -r '.issue_number' "$lock_file")
    LOCK_REASON=$(jq -r '.lock_reason // "resolved"' "$lock_file")

    # Validate issue number
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
      echo "- **lock-conversation**: issue_number is required in $lock_file" >> /tmp/validation-errors/lock-conversation.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$ISSUE_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **lock-conversation**: issue_number must be a number in $lock_file" >> /tmp/validation-errors/lock-conversation.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate lock reason
    if [[ ! "$LOCK_REASON" =~ ^(off-topic|too heated|resolved|spam)$ ]]; then
      echo "- **lock-conversation**: lock_reason must be one of: off-topic, too heated, resolved, spam in $lock_file" >> /tmp/validation-errors/lock-conversation.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $lock_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All lock-conversation validations passed - executing..."
    for lock_file in $LOCK_FILES; do
      ISSUE_NUMBER=$(jq -r '.issue_number' "$lock_file")
      LOCK_REASON=$(jq -r '.lock_reason // "resolved"' "$lock_file")

      # Lock conversation via GitHub API
      gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/lock" \\
        -X PUT \\
        -f lock_reason="$LOCK_REASON" || {
        echo "- **lock-conversation**: Failed to lock issue #$ISSUE_NUMBER" >> /tmp/validation-errors/lock-conversation.txt
      }
    done
  else
    echo "✗ lock-conversation validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new LockConversationHandler();
