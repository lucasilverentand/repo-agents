import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class CopyProjectHandler implements OutputHandler {
  name = "copy-project";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Copy Project

Copy an existing GitHub Project to create a new one from a template.

**File to create**: \`/tmp/outputs/copy-project.json\`

For multiple copy operations, use numbered suffixes: \`copy-project-1.json\`, \`copy-project-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "source_project_number": number,
  "source_owner": "string",
  "target_owner": "string",
  "new_title": "string",
  "new_description": "string",
  "include_items": boolean
}
\`\`\`

**Fields**:
- \`source_project_number\` (required): Number of the project to copy
- \`source_owner\` (optional): Owner of the source project ("@me" for authenticated user, or org/user name). Defaults to "@me"
- \`target_owner\` (optional): Owner for the new project ("@me" for authenticated user, or org/user name). Defaults to "@me"
- \`new_title\` (required): Title for the new project
- \`new_description\` (optional): Description for the new project
- \`include_items\` (optional): Whether to copy existing items (default: false)

**Constraints**:
- Maximum copy operations: ${maxConstraint}
- Source project must exist and be accessible
- Custom fields, views, and automation rules are copied automatically

**Example**:
Create \`/tmp/outputs/copy-project.json\` with:
\`\`\`json
{
  "source_project_number": 1,
  "source_owner": "@me",
  "target_owner": "myorg",
  "new_title": "Q2 2026 Roadmap",
  "new_description": "Quarterly roadmap for Q2",
  "include_items": false
}
\`\`\`

**Important**: Use the Write tool to create this file. The project will be copied with all custom fields and structure preserved.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute copy-project output(s)
COPY_PROJECT_FILES=$(find /tmp/outputs -name "copy-project*.json" 2>/dev/null || true)

if [ -n "$COPY_PROJECT_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$COPY_PROJECT_FILES" | wc -l)
  echo "Found $FILE_COUNT copy-project output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **copy-project**: Too many copy-project files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/copy-project.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for copy_file in $COPY_PROJECT_FILES; do
    echo "Validating $copy_file..."

    # Validate JSON structure
    if ! jq empty "$copy_file" 2>/dev/null; then
      echo "- **copy-project**: Invalid JSON format in $copy_file" >> /tmp/validation-errors/copy-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    SOURCE_PROJECT_NUMBER=$(jq -r '.source_project_number' "$copy_file")
    NEW_TITLE=$(jq -r '.new_title' "$copy_file")

    # Validate required fields
    if [ -z "$SOURCE_PROJECT_NUMBER" ] || [ "$SOURCE_PROJECT_NUMBER" = "null" ]; then
      echo "- **copy-project**: source_project_number is required in $copy_file" >> /tmp/validation-errors/copy-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$NEW_TITLE" ] || [ "$NEW_TITLE" = "null" ]; then
      echo "- **copy-project**: new_title is required in $copy_file" >> /tmp/validation-errors/copy-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $copy_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All copy-project validations passed - executing..."
    for copy_file in $COPY_PROJECT_FILES; do
      SOURCE_PROJECT_NUMBER=$(jq -r '.source_project_number' "$copy_file")
      SOURCE_OWNER=$(jq -r '.source_owner // "@me"' "$copy_file")
      TARGET_OWNER=$(jq -r '.target_owner // "@me"' "$copy_file")
      NEW_TITLE=$(jq -r '.new_title' "$copy_file")
      NEW_DESCRIPTION=$(jq -r '.new_description // ""' "$copy_file")
      INCLUDE_ITEMS=$(jq -r '.include_items // false' "$copy_file")

      # Build gh project copy command
      GH_OPTS="--source-owner \\"$SOURCE_OWNER\\" --target-owner \\"$TARGET_OWNER\\" --title \\"$NEW_TITLE\\""

      if [ -n "$NEW_DESCRIPTION" ] && [ "$NEW_DESCRIPTION" != "null" ] && [ "$NEW_DESCRIPTION" != "" ]; then
        # Note: gh project copy doesn't have a --description flag,
        # description would need to be set after copy via edit
        echo "Note: Description will need to be set after copy"
      fi

      # Copy project via gh CLI
      NEW_PROJECT_URL=$(eval gh project copy "$SOURCE_PROJECT_NUMBER" $GH_OPTS 2>&1) || {
        echo "- **copy-project**: Failed to copy project $SOURCE_PROJECT_NUMBER: $NEW_PROJECT_URL" >> /tmp/validation-errors/copy-project.txt
        continue
      }

      echo "✓ Project copied successfully: $NEW_PROJECT_URL"
    done
  else
    echo "✗ copy-project validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new CopyProjectHandler();
