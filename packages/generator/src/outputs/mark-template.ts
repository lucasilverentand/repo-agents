import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class MarkTemplateHandler implements OutputHandler {
  name = "mark-template";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Mark Template

Mark or unmark a GitHub Project as a template for reuse.

**File to create**: \`/tmp/outputs/mark-template.json\`

For multiple operations, use numbered suffixes: \`mark-template-1.json\`, \`mark-template-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "project_number": number,
  "owner": "string",
  "action": "mark" | "unmark",
  "reason": "string"
}
\`\`\`

**Fields**:
- \`project_number\` (required): Number of the project to modify
- \`owner\` (optional): Owner of the project ("@me" for authenticated user, or org/user name). Defaults to "@me"
- \`action\` (required): "mark" to make it a template, "unmark" to remove template status
- \`reason\` (optional): Reason for marking/unmarking as template (for documentation)

**Constraints**:
- Maximum operations: ${maxConstraint}
- Project must exist and be accessible
- User must have admin access to the project

**Example**:
Create \`/tmp/outputs/mark-template.json\` with:
\`\`\`json
{
  "project_number": 1,
  "owner": "@me",
  "action": "mark",
  "reason": "Standard sprint board template"
}
\`\`\`

**Important**: Use the Write tool to create this file. Template projects can be easily copied to create new projects with the same structure.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute mark-template output(s)
MARK_TEMPLATE_FILES=$(find /tmp/outputs -name "mark-template*.json" 2>/dev/null || true)

if [ -n "$MARK_TEMPLATE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$MARK_TEMPLATE_FILES" | wc -l)
  echo "Found $FILE_COUNT mark-template output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **mark-template**: Too many mark-template files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/mark-template.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for template_file in $MARK_TEMPLATE_FILES; do
    echo "Validating $template_file..."

    # Validate JSON structure
    if ! jq empty "$template_file" 2>/dev/null; then
      echo "- **mark-template**: Invalid JSON format in $template_file" >> /tmp/validation-errors/mark-template.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    PROJECT_NUMBER=$(jq -r '.project_number' "$template_file")
    ACTION=$(jq -r '.action' "$template_file")

    # Validate required fields
    if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
      echo "- **mark-template**: project_number is required in $template_file" >> /tmp/validation-errors/mark-template.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$ACTION" ] || [ "$ACTION" = "null" ]; then
      echo "- **mark-template**: action is required in $template_file" >> /tmp/validation-errors/mark-template.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate action value
    if [ "$ACTION" != "mark" ] && [ "$ACTION" != "unmark" ]; then
      echo "- **mark-template**: action must be 'mark' or 'unmark' in $template_file" >> /tmp/validation-errors/mark-template.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $template_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All mark-template validations passed - executing..."
    for template_file in $MARK_TEMPLATE_FILES; do
      PROJECT_NUMBER=$(jq -r '.project_number' "$template_file")
      OWNER=$(jq -r '.owner // "@me"' "$template_file")
      ACTION=$(jq -r '.action' "$template_file")
      REASON=$(jq -r '.reason // ""' "$template_file")

      # Build gh project mark-template command
      GH_OPTS="--owner \\"$OWNER\\""

      if [ "$ACTION" = "unmark" ]; then
        GH_OPTS="$GH_OPTS --undo"
      fi

      # Mark/unmark project as template via gh CLI
      RESULT=$(eval gh project mark-template "$PROJECT_NUMBER" $GH_OPTS 2>&1) || {
        echo "- **mark-template**: Failed to $ACTION project $PROJECT_NUMBER as template: $RESULT" >> /tmp/validation-errors/mark-template.txt
        continue
      }

      if [ -n "$REASON" ] && [ "$REASON" != "null" ] && [ "$REASON" != "" ]; then
        echo "✓ Project $PROJECT_NUMBER \${ACTION}ed as template. Reason: $REASON"
      else
        echo "✓ Project $PROJECT_NUMBER \${ACTION}ed as template"
      fi
    done
  else
    echo "✗ mark-template validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new MarkTemplateHandler();
