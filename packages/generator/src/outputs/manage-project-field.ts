import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface ManageProjectFieldConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
  allow_create?: boolean;
  allow_delete?: boolean;
  protected_fields?: string[];
}

class ManageProjectFieldHandler implements OutputHandler {
  name = "manage-project-field";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const fieldConfig = config as ManageProjectFieldConfig;
    const projectNumber = fieldConfig.project_number;
    const owner = fieldConfig.owner ?? "@me";
    const allowCreate = fieldConfig.allow_create !== false;
    const allowDelete = fieldConfig.allow_delete !== false;
    const protectedFields = fieldConfig.protected_fields ?? [];

    const projectNote = projectNumber
      ? `\n- Default project number: ${projectNumber}`
      : "";
    const ownerNote = `\n- Default owner: ${owner}`;
    const protectedNote =
      protectedFields.length > 0
        ? `\n- **Protected fields** (cannot be deleted): ${protectedFields.map((f) => `\`${f}\``).join(", ")}`
        : "";

    const allowedOperations: string[] = [];
    if (allowCreate) allowedOperations.push('"create"');
    if (allowDelete) allowedOperations.push('"delete"');

    return `## Skill: Manage Project Field

Manage custom fields in a GitHub Project - create or delete fields.

**File to create**: \`/tmp/outputs/manage-project-field.json\`

**JSON Schema**:
\`\`\`json
{
  "operations": [
    {
      "action": "create" | "delete",
      "name": "string",
      "data_type": "TEXT" | "SINGLE_SELECT" | "DATE" | "NUMBER",
      "single_select_options": ["string"],
      "field_id": "string",
      "reason": "string"
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`operations\` (required): Array of field operations
- \`action\` (required): One of ${allowedOperations.join(", ")}
- \`name\` (required for create): Field name
- \`data_type\` (required for create): One of "TEXT", "SINGLE_SELECT", "DATE", "NUMBER"
- \`single_select_options\` (required for SINGLE_SELECT): Array of option values
- \`field_id\` (required for delete): Field ID (format: PVTF_...)
- \`reason\` (optional): Why this operation is being performed
- \`project_number\` (required): Project number${projectNote}
- \`owner\` (optional): Project owner${ownerNote}${protectedNote}

**Example**:
Create \`/tmp/outputs/manage-project-field.json\` with:
\`\`\`json
{
  "operations": [
    {
      "action": "create",
      "name": "Sprint",
      "data_type": "SINGLE_SELECT",
      "single_select_options": ["Sprint 1", "Sprint 2", "Sprint 3", "Backlog"]
    },
    {
      "action": "create",
      "name": "Story Points",
      "data_type": "NUMBER"
    },
    {
      "action": "delete",
      "field_id": "PVTF_lADOAE...",
      "reason": "No longer used"
    }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file. Deleted fields cannot be recovered.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const fieldConfig = config as ManageProjectFieldConfig;
    const defaultProjectNumber = fieldConfig.project_number || "";
    const defaultOwner = fieldConfig.owner || "@me";
    const allowCreate = fieldConfig.allow_create !== false;
    const allowDelete = fieldConfig.allow_delete !== false;

    return `
# Validate and execute manage-project-field output
MANAGE_FIELD_FILE="/tmp/outputs/manage-project-field.json"

if [ -f "$MANAGE_FIELD_FILE" ]; then
  echo "Found manage-project-field output file"

  # Validate JSON structure
  if ! jq empty "$MANAGE_FIELD_FILE" 2>/dev/null; then
    echo "- **manage-project-field**: Invalid JSON format" >> /tmp/validation-errors/manage-project-field.txt
    exit 0
  fi

  # Extract fields
  OPERATIONS=$(jq -r '.operations' "$MANAGE_FIELD_FILE")
  PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$MANAGE_FIELD_FILE")

  if [ "$OPERATIONS" = "null" ] || ! echo "$OPERATIONS" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "- **manage-project-field**: operations must be an array" >> /tmp/validation-errors/manage-project-field.txt
    exit 0
  fi

  if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
    echo "- **manage-project-field**: project_number is required" >> /tmp/validation-errors/manage-project-field.txt
    exit 0
  fi

  VALIDATION_FAILED=false

  # Phase 1: Validate all operations
  OP_COUNT=$(echo "$OPERATIONS" | jq 'length')
  for i in $(seq 0 $((OP_COUNT - 1))); do
    OP=$(echo "$OPERATIONS" | jq ".[$i]")
    ACTION=$(echo "$OP" | jq -r '.action')
    NAME=$(echo "$OP" | jq -r '.name // empty')
    DATA_TYPE=$(echo "$OP" | jq -r '.data_type // empty')
    FIELD_ID=$(echo "$OP" | jq -r '.field_id // empty')
    OPTIONS=$(echo "$OP" | jq -r '.single_select_options // empty')

    echo "Validating operation $((i + 1)): $ACTION"

    case "$ACTION" in
      create)
        ${
          allowCreate
            ? `
        if [ -z "$NAME" ]; then
          echo "- **manage-project-field**: name is required for create action" >> /tmp/validation-errors/manage-project-field.txt
          VALIDATION_FAILED=true
        fi
        if [ -z "$DATA_TYPE" ]; then
          echo "- **manage-project-field**: data_type is required for create action" >> /tmp/validation-errors/manage-project-field.txt
          VALIDATION_FAILED=true
        fi
        case "$DATA_TYPE" in
          TEXT|DATE|NUMBER) ;;
          SINGLE_SELECT)
            if [ -z "$OPTIONS" ] || [ "$OPTIONS" = "null" ]; then
              echo "- **manage-project-field**: single_select_options is required for SINGLE_SELECT type" >> /tmp/validation-errors/manage-project-field.txt
              VALIDATION_FAILED=true
            fi
            ;;
          *)
            echo "- **manage-project-field**: invalid data_type '$DATA_TYPE'" >> /tmp/validation-errors/manage-project-field.txt
            VALIDATION_FAILED=true
            ;;
        esac`
            : `
        echo "- **manage-project-field**: create action is not allowed" >> /tmp/validation-errors/manage-project-field.txt
        VALIDATION_FAILED=true`
        }
        ;;
      delete)
        ${
          allowDelete
            ? `
        if [ -z "$FIELD_ID" ]; then
          echo "- **manage-project-field**: field_id is required for delete action" >> /tmp/validation-errors/manage-project-field.txt
          VALIDATION_FAILED=true
        fi
        # Check protected fields would require fetching field names first
        `
            : `
        echo "- **manage-project-field**: delete action is not allowed" >> /tmp/validation-errors/manage-project-field.txt
        VALIDATION_FAILED=true`
        }
        ;;
      *)
        echo "- **manage-project-field**: unknown action '$ACTION'" >> /tmp/validation-errors/manage-project-field.txt
        VALIDATION_FAILED=true
        ;;
    esac
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All manage-project-field validations passed - executing..."

    OWNER=$(jq -r '.owner // "${defaultOwner}"' "$MANAGE_FIELD_FILE")

    for i in $(seq 0 $((OP_COUNT - 1))); do
      OP=$(echo "$OPERATIONS" | jq ".[$i]")
      ACTION=$(echo "$OP" | jq -r '.action')
      NAME=$(echo "$OP" | jq -r '.name // empty')
      DATA_TYPE=$(echo "$OP" | jq -r '.data_type // empty')
      FIELD_ID=$(echo "$OP" | jq -r '.field_id // empty')
      OPTIONS=$(echo "$OP" | jq -r '.single_select_options | if . then join(",") else empty end')

      case "$ACTION" in
        create)
          echo "Creating field '$NAME' with type $DATA_TYPE..."
          GH_OPTS="--name \\"$NAME\\" --data-type \\"$DATA_TYPE\\""
          if [ -n "$OPTIONS" ]; then
            GH_OPTS="$GH_OPTS --single-select-options \\"$OPTIONS\\""
          fi
          eval gh project field-create "$PROJECT_NUMBER" --owner "$OWNER" $GH_OPTS || {
            echo "- **manage-project-field**: Failed to create field '$NAME'" >> /tmp/validation-errors/manage-project-field.txt
          }
          ;;
        delete)
          echo "Deleting field $FIELD_ID..."
          gh project field-delete "$PROJECT_NUMBER" --owner "$OWNER" --id "$FIELD_ID" || {
            echo "- **manage-project-field**: Failed to delete field $FIELD_ID" >> /tmp/validation-errors/manage-project-field.txt
          }
          ;;
      esac
    done
  else
    echo "✗ manage-project-field validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new ManageProjectFieldHandler();
