import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface UpdateProjectFieldConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
  allowed_fields?: string[];
}

class UpdateProjectFieldHandler implements OutputHandler {
  name = "update-project-field";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const fieldConfig = config as UpdateProjectFieldConfig;
    const projectNumber = fieldConfig.project_number;
    const owner = fieldConfig.owner ?? "@me";
    const allowedFields = fieldConfig.allowed_fields ?? [];

    const projectNote = projectNumber ? `\n- Default project number: ${projectNumber}` : "";
    const ownerNote = `\n- Default owner: ${owner}`;
    const fieldsNote =
      allowedFields.length > 0
        ? `\n- **Allowed fields**: ${allowedFields.map((f) => `\`${f}\``).join(", ")}`
        : "";

    return `## Skill: Update Project Field

Update custom field values on project items.

**File to create**: \`/tmp/outputs/update-project-field.json\`

For multiple update operations, use numbered suffixes: \`update-project-field-1.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "updates": [
    {
      "item_id": "string",
      "fields": {
        "FieldName": "value"
      }
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`updates\` (required): Array of field updates
  - \`item_id\` (required): Project item ID (format: PVTI_...)
  - \`fields\` (required): Object mapping field names to new values
    - For single-select fields (Status, Priority): use the option name (e.g., "In Progress")
    - For text fields: use string value
    - For number fields: use numeric value
    - For date fields: use ISO 8601 date string (e.g., "2026-02-01")
- \`project_number\` (required): Project number${projectNote}
- \`owner\` (optional): Project owner${ownerNote}${fieldsNote}

**Example**:
Create \`/tmp/outputs/update-project-field.json\` with:
\`\`\`json
{
  "updates": [
    {
      "item_id": "PVTI_lADOAE...",
      "fields": {
        "Status": "In Progress",
        "Priority": "High",
        "Due Date": "2026-02-01"
      }
    }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file. Field names are case-sensitive.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const fieldConfig = config as UpdateProjectFieldConfig;
    const defaultProjectNumber = fieldConfig.project_number || "";
    const defaultOwner = fieldConfig.owner || "@me";
    const allowedFields = fieldConfig.allowed_fields ?? [];
    const allowedFieldsJson = JSON.stringify(allowedFields);

    return `
# Validate and execute update-project-field output(s)
UPDATE_FIELD_FILES=$(find /tmp/outputs -name "update-project-field*.json" 2>/dev/null || true)

if [ -n "$UPDATE_FIELD_FILES" ]; then
  FILE_COUNT=$(echo "$UPDATE_FIELD_FILES" | wc -l)
  echo "Found $FILE_COUNT update-project-field output file(s)"

  ALLOWED_FIELDS='${allowedFieldsJson}'

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for update_file in $UPDATE_FIELD_FILES; do
    echo "Validating $update_file..."

    # Validate JSON structure
    if ! jq empty "$update_file" 2>/dev/null; then
      echo "- **update-project-field**: Invalid JSON format in $update_file" >> /tmp/validation-errors/update-project-field.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    UPDATES=$(jq -r '.updates' "$update_file")
    PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$update_file")

    # Validate updates array
    if [ "$UPDATES" = "null" ] || ! echo "$UPDATES" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **update-project-field**: updates must be an array in $update_file" >> /tmp/validation-errors/update-project-field.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate project number
    if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
      echo "- **update-project-field**: project_number is required in $update_file" >> /tmp/validation-errors/update-project-field.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate each update
    UPDATE_COUNT=$(echo "$UPDATES" | jq 'length')
    for i in $(seq 0 $((UPDATE_COUNT - 1))); do
      UPDATE=$(echo "$UPDATES" | jq ".[$i]")
      ITEM_ID=$(echo "$UPDATE" | jq -r '.item_id')
      FIELDS=$(echo "$UPDATE" | jq -r '.fields')

      if [ -z "$ITEM_ID" ] || [ "$ITEM_ID" = "null" ]; then
        echo "- **update-project-field**: item_id is required for each update" >> /tmp/validation-errors/update-project-field.txt
        VALIDATION_FAILED=true
      fi

      if [ "$FIELDS" = "null" ] || ! echo "$FIELDS" | jq -e 'type == "object"' >/dev/null 2>&1; then
        echo "- **update-project-field**: fields must be an object" >> /tmp/validation-errors/update-project-field.txt
        VALIDATION_FAILED=true
      fi

      # Check allowed fields if configured
      ${
        allowedFields.length > 0
          ? `
      FIELD_NAMES=$(echo "$FIELDS" | jq -r 'keys[]')
      for field_name in $FIELD_NAMES; do
        if ! echo "$ALLOWED_FIELDS" | jq -e --arg name "$field_name" 'index($name) != null' >/dev/null 2>&1; then
          echo "- **update-project-field**: field '$field_name' is not in the allowed list" >> /tmp/validation-errors/update-project-field.txt
          VALIDATION_FAILED=true
        fi
      done`
          : ""
      }
    done

    echo "✓ Validation passed for $update_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All update-project-field validations passed - executing..."

    for update_file in $UPDATE_FIELD_FILES; do
      UPDATES=$(jq -r '.updates' "$update_file")
      PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$update_file")
      OWNER=$(jq -r '.owner // "${defaultOwner}"' "$update_file")

      # Get project fields to map names to IDs
      echo "Fetching project field definitions..."
      PROJECT_FIELDS=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json 2>/dev/null || echo '{"fields":[]}')

      UPDATE_COUNT=$(echo "$UPDATES" | jq 'length')
      for i in $(seq 0 $((UPDATE_COUNT - 1))); do
        UPDATE=$(echo "$UPDATES" | jq ".[$i]")
        ITEM_ID=$(echo "$UPDATE" | jq -r '.item_id')
        FIELDS=$(echo "$UPDATE" | jq -r '.fields')

        # Process each field
        FIELD_NAMES=$(echo "$FIELDS" | jq -r 'keys[]')
        for field_name in $FIELD_NAMES; do
          FIELD_VALUE=$(echo "$FIELDS" | jq -r --arg name "$field_name" '.[$name]')

          echo "Updating field '$field_name' to '$FIELD_VALUE' for item $ITEM_ID..."

          # Get field ID and type
          FIELD_INFO=$(echo "$PROJECT_FIELDS" | jq --arg name "$field_name" '.fields[] | select(.name == $name)')
          FIELD_ID=$(echo "$FIELD_INFO" | jq -r '.id')

          if [ -z "$FIELD_ID" ] || [ "$FIELD_ID" = "null" ]; then
            echo "- **update-project-field**: field '$field_name' not found in project" >> /tmp/validation-errors/update-project-field.txt
            continue
          fi

          # Update the field
          gh project item-edit --project-id "$PROJECT_NUMBER" --id "$ITEM_ID" --field-id "$FIELD_ID" --text "$FIELD_VALUE" 2>/dev/null || \
          gh project item-edit --project-id "$PROJECT_NUMBER" --id "$ITEM_ID" --field-id "$FIELD_ID" --single-select-option-id "$FIELD_VALUE" 2>/dev/null || \
          gh project item-edit --project-id "$PROJECT_NUMBER" --id "$ITEM_ID" --field-id "$FIELD_ID" --number "$FIELD_VALUE" 2>/dev/null || \
          gh project item-edit --project-id "$PROJECT_NUMBER" --id "$ITEM_ID" --field-id "$FIELD_ID" --date "$FIELD_VALUE" 2>/dev/null || {
            echo "- **update-project-field**: Failed to update field '$field_name' for item $ITEM_ID" >> /tmp/validation-errors/update-project-field.txt
          }
        done
      done
    done
  else
    echo "✗ update-project-field validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new UpdateProjectFieldHandler();
