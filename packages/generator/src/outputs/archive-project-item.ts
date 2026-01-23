import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface ArchiveProjectItemConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
}

class ArchiveProjectItemHandler implements OutputHandler {
  name = "archive-project-item";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const archiveConfig = config as ArchiveProjectItemConfig;
    const projectNumber = archiveConfig.project_number;
    const owner = archiveConfig.owner ?? "@me";

    const projectNote = projectNumber ? `\n- Default project number: ${projectNumber}` : "";
    const ownerNote = `\n- Default owner: ${owner}`;

    return `## Skill: Archive Project Item

Archive or unarchive items in a GitHub Project.

**File to create**: \`/tmp/outputs/archive-project-item.json\`

For multiple archive operations, use numbered suffixes: \`archive-project-item-1.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "items": [
    {
      "item_id": "string",
      "action": "archive" | "unarchive",
      "reason": "string"
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`items\` (required): Array of items to archive/unarchive
  - \`item_id\` (required): Project item ID (format: PVTI_...)
  - \`action\` (required): "archive" or "unarchive"
  - \`reason\` (optional): Why the item is being archived/unarchived
- \`project_number\` (required): Project number${projectNote}
- \`owner\` (optional): Project owner${ownerNote}

**Note**: Archiving removes items from the active view while preserving them in the project.

**Example**:
Create \`/tmp/outputs/archive-project-item.json\` with:
\`\`\`json
{
  "items": [
    {
      "item_id": "PVTI_lADOAE...",
      "action": "archive",
      "reason": "Completed and no longer needed in active view"
    },
    {
      "item_id": "PVTI_lADOAE...",
      "action": "unarchive",
      "reason": "Reopening for further work"
    }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const archiveConfig = config as ArchiveProjectItemConfig;
    const defaultProjectNumber = archiveConfig.project_number || "";
    const defaultOwner = archiveConfig.owner || "@me";

    return `
# Validate and execute archive-project-item output(s)
ARCHIVE_FILES=$(find /tmp/outputs -name "archive-project-item*.json" 2>/dev/null || true)

if [ -n "$ARCHIVE_FILES" ]; then
  FILE_COUNT=$(echo "$ARCHIVE_FILES" | wc -l)
  echo "Found $FILE_COUNT archive-project-item output file(s)"

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for archive_file in $ARCHIVE_FILES; do
    echo "Validating $archive_file..."

    # Validate JSON structure
    if ! jq empty "$archive_file" 2>/dev/null; then
      echo "- **archive-project-item**: Invalid JSON format in $archive_file" >> /tmp/validation-errors/archive-project-item.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ITEMS=$(jq -r '.items' "$archive_file")
    PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$archive_file")

    # Validate items array
    if [ "$ITEMS" = "null" ] || ! echo "$ITEMS" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **archive-project-item**: items must be an array in $archive_file" >> /tmp/validation-errors/archive-project-item.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate project number
    if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
      echo "- **archive-project-item**: project_number is required in $archive_file" >> /tmp/validation-errors/archive-project-item.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate each item
    ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
    for i in $(seq 0 $((ITEM_COUNT - 1))); do
      ITEM=$(echo "$ITEMS" | jq ".[$i]")
      ITEM_ID=$(echo "$ITEM" | jq -r '.item_id')
      ACTION=$(echo "$ITEM" | jq -r '.action')

      if [ -z "$ITEM_ID" ] || [ "$ITEM_ID" = "null" ]; then
        echo "- **archive-project-item**: item_id is required for each item" >> /tmp/validation-errors/archive-project-item.txt
        VALIDATION_FAILED=true
      fi

      if [ "$ACTION" != "archive" ] && [ "$ACTION" != "unarchive" ]; then
        echo "- **archive-project-item**: action must be 'archive' or 'unarchive', got '$ACTION'" >> /tmp/validation-errors/archive-project-item.txt
        VALIDATION_FAILED=true
      fi
    done

    echo "✓ Validation passed for $archive_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All archive-project-item validations passed - executing..."

    for archive_file in $ARCHIVE_FILES; do
      ITEMS=$(jq -r '.items' "$archive_file")
      PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$archive_file")
      OWNER=$(jq -r '.owner // "${defaultOwner}"' "$archive_file")

      ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
      for i in $(seq 0 $((ITEM_COUNT - 1))); do
        ITEM=$(echo "$ITEMS" | jq ".[$i]")
        ITEM_ID=$(echo "$ITEM" | jq -r '.item_id')
        ACTION=$(echo "$ITEM" | jq -r '.action')

        if [ "$ACTION" = "archive" ]; then
          echo "Archiving item $ITEM_ID in project $PROJECT_NUMBER..."
          gh project item-archive "$PROJECT_NUMBER" --owner "$OWNER" --id "$ITEM_ID" || {
            echo "- **archive-project-item**: Failed to archive item $ITEM_ID" >> /tmp/validation-errors/archive-project-item.txt
          }
        else
          echo "Unarchiving item $ITEM_ID in project $PROJECT_NUMBER..."
          gh project item-archive "$PROJECT_NUMBER" --owner "$OWNER" --id "$ITEM_ID" --undo || {
            echo "- **archive-project-item**: Failed to unarchive item $ITEM_ID" >> /tmp/validation-errors/archive-project-item.txt
          }
        fi
      done
    done
  else
    echo "✗ archive-project-item validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new ArchiveProjectItemHandler();
