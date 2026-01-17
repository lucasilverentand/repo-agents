import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class AssignIssueHandler implements OutputHandler {
  name = "assign-issue";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for assign-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Assign Issue

Assign users to an issue or pull request.

**File to create**: \`/tmp/outputs/assign-issue.json\`

For multiple assignments, use numbered suffixes: \`assign-issue-1.json\`, \`assign-issue-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "assignees": ["string"]
}
\`\`\`

**Fields**:
- \`issue_number\` (required): Issue or PR number to assign
- \`assignees\` (required): Array of GitHub usernames to assign (max 10)

**Constraints**:
- Maximum assignments: ${maxConstraint}
- Maximum 10 assignees per issue/PR (GitHub limit)
- Users must have write access to the repository

**Example**:
Create \`/tmp/outputs/assign-issue.json\` with:
\`\`\`json
{
  "issue_number": 123,
  "assignees": ["user1", "user2"]
}
\`\`\`

**Important**: Use the Write tool to create this file. Only assignees with repository access can be assigned.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute assign-issue output(s)
ASSIGN_FILES=$(find /tmp/outputs -name "assign-issue*.json" 2>/dev/null || true)

if [ -n "$ASSIGN_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$ASSIGN_FILES" | wc -l)
  echo "Found $FILE_COUNT assign-issue output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **assign-issue**: Too many assignment files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/assign-issue.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for assign_file in $ASSIGN_FILES; do
    echo "Validating $assign_file..."

    # Validate JSON structure
    if ! jq empty "$assign_file" 2>/dev/null; then
      echo "- **assign-issue**: Invalid JSON format in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ISSUE_NUMBER=$(jq -r '.issue_number' "$assign_file")
    ASSIGNEES=$(jq -r '.assignees' "$assign_file")

    # Validate required fields
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
      echo "- **assign-issue**: issue_number is required in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$ISSUE_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **assign-issue**: issue_number must be a number in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    elif [ "$ASSIGNEES" = "null" ] || ! echo "$ASSIGNEES" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **assign-issue**: assignees must be an array in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Check assignees array length
    ASSIGNEE_COUNT=$(echo "$ASSIGNEES" | jq 'length')
    if [ "$ASSIGNEE_COUNT" -eq 0 ]; then
      echo "- **assign-issue**: assignees array cannot be empty in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    elif [ "$ASSIGNEE_COUNT" -gt 10 ]; then
      echo "- **assign-issue**: Maximum 10 assignees allowed (found $ASSIGNEE_COUNT) in $assign_file" >> /tmp/validation-errors/assign-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $assign_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All assign-issue validations passed - executing..."
    for assign_file in $ASSIGN_FILES; do
      ISSUE_NUMBER=$(jq -r '.issue_number' "$assign_file")
      ASSIGNEES_JSON=$(jq -c '.assignees' "$assign_file")

      # Add assignees via GitHub API
      gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/assignees" \\
        -X POST \\
        -f assignees="$ASSIGNEES_JSON" || {
        echo "- **assign-issue**: Failed to assign users to issue #$ISSUE_NUMBER" >> /tmp/validation-errors/assign-issue.txt
      }
    done
  else
    echo "✗ assign-issue validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new AssignIssueHandler();
