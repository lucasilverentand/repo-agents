import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface RemoveFromProjectConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
}

class RemoveFromProjectHandler implements OutputHandler {
  name = "remove-from-project";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const projectConfig = config as RemoveFromProjectConfig;
    const projectNumber = projectConfig.project_number;
    const owner = projectConfig.owner ?? "@me";

    const projectNote = projectNumber
      ? `\n- Default project number: ${projectNumber}`
      : "";
    const ownerNote = `\n- Default owner: ${owner}`;

    return `## Skill: Remove from Project

Remove items from a GitHub Project.

**File to create**: \`/tmp/outputs/remove-from-project.json\`

For multiple remove operations, use numbered suffixes: \`remove-from-project-1.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "items": [
    {
      "item_id": "string",
      "reason": "string"
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`items\` (required): Array of items to remove
  - \`item_id\` (required): Project item ID (format: PVTI_...)
  - \`reason\` (optional): Why the item is being removed
- \`project_number\` (required): Project number${projectNote}
- \`owner\` (optional): Project owner${ownerNote}

**Note**: To get item IDs, you can query the project with:
\`gh project item-list <project-number> --owner <owner> --format json\`

**Example**:
Create \`/tmp/outputs/remove-from-project.json\` with:
\`\`\`json
{
  "items": [
    {
      "item_id": "PVTI_lADOAE...",
      "reason": "Moved to different project"
    }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file. Items are removed permanently from the project.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const projectConfig = config as RemoveFromProjectConfig;
    const defaultProjectNumber = projectConfig.project_number || "";
    const defaultOwner = projectConfig.owner || "@me";

    return `
# Validate and execute remove-from-project output(s)
REMOVE_PROJECT_FILES=$(find /tmp/outputs -name "remove-from-project*.json" 2>/dev/null || true)

if [ -n "$REMOVE_PROJECT_FILES" ]; then
  FILE_COUNT=$(echo "$REMOVE_PROJECT_FILES" | wc -l)
  echo "Found $FILE_COUNT remove-from-project output file(s)"

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for remove_file in $REMOVE_PROJECT_FILES; do
    echo "Validating $remove_file..."

    # Validate JSON structure
    if ! jq empty "$remove_file" 2>/dev/null; then
      echo "- **remove-from-project**: Invalid JSON format in $remove_file" >> /tmp/validation-errors/remove-from-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ITEMS=$(jq -r '.items' "$remove_file")
    PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$remove_file")

    # Validate items array
    if [ "$ITEMS" = "null" ] || ! echo "$ITEMS" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **remove-from-project**: items must be an array in $remove_file" >> /tmp/validation-errors/remove-from-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate project number
    if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
      echo "- **remove-from-project**: project_number is required in $remove_file" >> /tmp/validation-errors/remove-from-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate each item has item_id
    ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
    for i in $(seq 0 $((ITEM_COUNT - 1))); do
      ITEM=$(echo "$ITEMS" | jq ".[$i]")
      ITEM_ID=$(echo "$ITEM" | jq -r '.item_id')

      if [ -z "$ITEM_ID" ] || [ "$ITEM_ID" = "null" ]; then
        echo "- **remove-from-project**: item_id is required for each item" >> /tmp/validation-errors/remove-from-project.txt
        VALIDATION_FAILED=true
      fi
    done

    echo "✓ Validation passed for $remove_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All remove-from-project validations passed - executing..."

    for remove_file in $REMOVE_PROJECT_FILES; do
      ITEMS=$(jq -r '.items' "$remove_file")
      PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$remove_file")
      OWNER=$(jq -r '.owner // "${defaultOwner}"' "$remove_file")

      ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
      for i in $(seq 0 $((ITEM_COUNT - 1))); do
        ITEM=$(echo "$ITEMS" | jq ".[$i]")
        ITEM_ID=$(echo "$ITEM" | jq -r '.item_id')

        echo "Removing item $ITEM_ID from project $PROJECT_NUMBER..."
        gh project item-delete "$PROJECT_NUMBER" --owner "$OWNER" --id "$ITEM_ID" || {
          echo "- **remove-from-project**: Failed to remove item $ITEM_ID" >> /tmp/validation-errors/remove-from-project.txt
        }
      done
    done
  else
    echo "✗ remove-from-project validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new RemoveFromProjectHandler();
