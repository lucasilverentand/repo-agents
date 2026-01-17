import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class EditIssueHandler implements OutputHandler {
  name = "edit-issue";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for edit-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Edit Issue

Update the title and/or body of an existing issue or pull request.

**File to create**: \`/tmp/outputs/edit-issue.json\`

For multiple edits, use numbered suffixes: \`edit-issue-1.json\`, \`edit-issue-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "title": "string",
  "body": "string"
}
\`\`\`

**Fields**:
- \`issue_number\` (required): Issue or PR number to edit
- \`title\` (optional): New title for the issue/PR
- \`body\` (optional): New body content for the issue/PR

**Constraints**:
- Maximum edits: ${maxConstraint}
- At least one of \`title\` or \`body\` must be specified

**Example**:
Create \`/tmp/outputs/edit-issue.json\` with:
\`\`\`json
{
  "issue_number": 123,
  "title": "[Bug] Updated issue title",
  "body": "## Description\\n\\nUpdated issue description with more details."
}
\`\`\`

**Important**: Use the Write tool to create this file. This will replace the existing title/body.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute edit-issue output(s)
EDIT_FILES=$(find /tmp/outputs -name "edit-issue*.json" 2>/dev/null || true)

if [ -n "$EDIT_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$EDIT_FILES" | wc -l)
  echo "Found $FILE_COUNT edit-issue output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **edit-issue**: Too many edit files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/edit-issue.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for edit_file in $EDIT_FILES; do
    echo "Validating $edit_file..."

    # Validate JSON structure
    if ! jq empty "$edit_file" 2>/dev/null; then
      echo "- **edit-issue**: Invalid JSON format in $edit_file" >> /tmp/validation-errors/edit-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ISSUE_NUMBER=$(jq -r '.issue_number' "$edit_file")
    TITLE=$(jq -r '.title // empty' "$edit_file")
    BODY=$(jq -r '.body // empty' "$edit_file")

    # Validate issue number
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
      echo "- **edit-issue**: issue_number is required in $edit_file" >> /tmp/validation-errors/edit-issue.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$ISSUE_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **edit-issue**: issue_number must be a number in $edit_file" >> /tmp/validation-errors/edit-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # At least one of title or body must be specified
    if [ -z "$TITLE" ] && [ -z "$BODY" ]; then
      echo "- **edit-issue**: At least one of title or body must be specified in $edit_file" >> /tmp/validation-errors/edit-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $edit_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All edit-issue validations passed - executing..."
    for edit_file in $EDIT_FILES; do
      ISSUE_NUMBER=$(jq -r '.issue_number' "$edit_file")
      TITLE=$(jq -r '.title // empty' "$edit_file")
      BODY=$(jq -r '.body // empty' "$edit_file")

      # Build API request
      if [ -n "$TITLE" ] && [ -n "$BODY" ]; then
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" \\
          -X PATCH \\
          -f title="$TITLE" \\
          -f body="$BODY" || {
          echo "- **edit-issue**: Failed to edit issue #$ISSUE_NUMBER" >> /tmp/validation-errors/edit-issue.txt
        }
      elif [ -n "$TITLE" ]; then
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" \\
          -X PATCH \\
          -f title="$TITLE" || {
          echo "- **edit-issue**: Failed to edit issue #$ISSUE_NUMBER" >> /tmp/validation-errors/edit-issue.txt
        }
      else
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" \\
          -X PATCH \\
          -f body="$BODY" || {
          echo "- **edit-issue**: Failed to edit issue #$ISSUE_NUMBER" >> /tmp/validation-errors/edit-issue.txt
        }
      fi
    done
  else
    echo "✗ edit-issue validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new EditIssueHandler();
