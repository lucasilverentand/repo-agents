import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface ManageLabelsConfig extends OutputConfig {
  allow_create?: boolean;
  allow_delete?: boolean;
  allow_edit?: boolean;
  protected_labels?: string[];
}

class ManageLabelsHandler implements OutputHandler {
  name = "manage-labels";

  getContextScript(runtime: RuntimeContext): string | null {
    // Fetch current repository labels for context
    return `
# Fetch current labels for manage-labels context
CURRENT_LABELS_JSON=$(gh api "repos/${runtime.repository}/labels" --jq '[.[] | {name: .name, color: .color, description: .description}]' 2>/dev/null || echo '[]')

cat >> /tmp/context.txt << 'MANAGE_LABELS_EOF'

## Current Repository Labels

The following labels currently exist in this repository:

MANAGE_LABELS_EOF

echo "$CURRENT_LABELS_JSON" | jq -r '.[] | "- **\\(.name)** (#\\(.color)): \\(.description // "No description")"' >> /tmp/context.txt

cat >> /tmp/context.txt << 'MANAGE_LABELS_EOF2'

**Note**: You can create, edit, or delete these labels based on the configured permissions.

MANAGE_LABELS_EOF2
`;
  }

  generateSkill(config: OutputConfig): string {
    const labelConfig = config as ManageLabelsConfig;
    const allowCreate = labelConfig.allow_create !== false;
    const allowDelete = labelConfig.allow_delete !== false;
    const allowEdit = labelConfig.allow_edit !== false;
    const protectedLabels = labelConfig.protected_labels ?? [];

    const allowedOperations: string[] = [];
    if (allowCreate) allowedOperations.push('"create"');
    if (allowEdit) allowedOperations.push('"edit"');
    if (allowDelete) allowedOperations.push('"delete"');

    const protectedNote =
      protectedLabels.length > 0
        ? `\n- **Protected labels** (cannot be deleted): ${protectedLabels.map((l) => `\`${l}\``).join(", ")}`
        : "";

    return `## Skill: Manage Labels

Manage repository labels - create, edit, or delete labels.

**File to create**: \`/tmp/outputs/manage-labels.json\`

**JSON Schema**:
\`\`\`json
{
  "operations": [
    {
      "action": "create" | "edit" | "delete",
      "name": "string",
      "new_name": "string",
      "color": "string",
      "description": "string",
      "reason": "string"
    }
  ]
}
\`\`\`

**Fields**:
- \`operations\` (required): Array of label operations to perform
- \`action\` (required): One of ${allowedOperations.join(", ")}
- \`name\` (required): Current label name (for edit/delete) or new label name (for create)
- \`new_name\` (optional): New name when renaming a label (edit action only)
- \`color\` (optional): Hex color without # (e.g., "d73a4a" for red). Required for create
- \`description\` (optional): Label description
- \`reason\` (optional): Why this operation is being performed

**Constraints**:
- Allowed operations: ${allowedOperations.join(", ")}${protectedNote}
- Color must be a valid 6-character hex code (without #)
- Label names must be unique

**Example**:
Create \`/tmp/outputs/manage-labels.json\` with:
\`\`\`json
{
  "operations": [
    {
      "action": "create",
      "name": "priority: critical",
      "color": "b60205",
      "description": "Critical priority requiring immediate attention"
    },
    {
      "action": "edit",
      "name": "bug",
      "new_name": "bug: confirmed",
      "color": "fc2929",
      "description": "Confirmed bug"
    },
    {
      "action": "delete",
      "name": "wontfix",
      "reason": "Replaced by 'not-planned' label"
    }
  ]
}
\`\`\`

**Important**: Use the Write tool to create this file. Operations are executed in order.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const labelConfig = config as ManageLabelsConfig;
    const allowCreate = labelConfig.allow_create !== false;
    const allowDelete = labelConfig.allow_delete !== false;
    const allowEdit = labelConfig.allow_edit !== false;
    const protectedLabels = labelConfig.protected_labels ?? [];
    const protectedLabelsJson = JSON.stringify(protectedLabels);

    return `
# Validate and execute manage-labels output
MANAGE_LABELS_FILE="/tmp/outputs/manage-labels.json"

if [ -f "$MANAGE_LABELS_FILE" ]; then
  echo "Found manage-labels output file"

  # Validate JSON structure
  if ! jq empty "$MANAGE_LABELS_FILE" 2>/dev/null; then
    echo "- **manage-labels**: Invalid JSON format" >> /tmp/validation-errors/manage-labels.txt
    exit 0
  fi

  # Extract operations
  OPERATIONS=$(jq -r '.operations' "$MANAGE_LABELS_FILE")
  if [ "$OPERATIONS" = "null" ] || ! echo "$OPERATIONS" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "- **manage-labels**: operations must be an array" >> /tmp/validation-errors/manage-labels.txt
    exit 0
  fi

  PROTECTED_LABELS='${protectedLabelsJson}'
  VALIDATION_FAILED=false

  # Phase 1: Validate all operations
  OP_COUNT=$(echo "$OPERATIONS" | jq 'length')
  for i in $(seq 0 $((OP_COUNT - 1))); do
    OP=$(echo "$OPERATIONS" | jq ".[$i]")
    ACTION=$(echo "$OP" | jq -r '.action')
    NAME=$(echo "$OP" | jq -r '.name')

    echo "Validating operation $((i + 1)): $ACTION on '$NAME'"

    # Validate action
    case "$ACTION" in
      create)
        ${
          allowCreate
            ? `
        COLOR=$(echo "$OP" | jq -r '.color')
        if [ -z "$COLOR" ] || [ "$COLOR" = "null" ]; then
          echo "- **manage-labels**: color is required for create action" >> /tmp/validation-errors/manage-labels.txt
          VALIDATION_FAILED=true
        elif ! echo "$COLOR" | grep -qE '^[0-9a-fA-F]{6}$'; then
          echo "- **manage-labels**: color must be a valid 6-character hex code (got: $COLOR)" >> /tmp/validation-errors/manage-labels.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-labels**: create action is not allowed" >> /tmp/validation-errors/manage-labels.txt
        VALIDATION_FAILED=true`
        }
        ;;
      edit)
        ${
          allowEdit
            ? `
        # Edit is allowed`
            : `
        echo "- **manage-labels**: edit action is not allowed" >> /tmp/validation-errors/manage-labels.txt
        VALIDATION_FAILED=true`
        }
        ;;
      delete)
        ${
          allowDelete
            ? `
        # Check if label is protected
        if echo "$PROTECTED_LABELS" | jq -e --arg name "$NAME" 'index($name) != null' >/dev/null 2>&1; then
          echo "- **manage-labels**: cannot delete protected label '$NAME'" >> /tmp/validation-errors/manage-labels.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-labels**: delete action is not allowed" >> /tmp/validation-errors/manage-labels.txt
        VALIDATION_FAILED=true`
        }
        ;;
      *)
        echo "- **manage-labels**: unknown action '$ACTION'" >> /tmp/validation-errors/manage-labels.txt
        VALIDATION_FAILED=true
        ;;
    esac

    # Validate name is present
    if [ -z "$NAME" ] || [ "$NAME" = "null" ]; then
      echo "- **manage-labels**: name is required for all operations" >> /tmp/validation-errors/manage-labels.txt
      VALIDATION_FAILED=true
    fi
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All manage-labels validations passed - executing..."

    for i in $(seq 0 $((OP_COUNT - 1))); do
      OP=$(echo "$OPERATIONS" | jq ".[$i]")
      ACTION=$(echo "$OP" | jq -r '.action')
      NAME=$(echo "$OP" | jq -r '.name')
      NEW_NAME=$(echo "$OP" | jq -r '.new_name // empty')
      COLOR=$(echo "$OP" | jq -r '.color // empty')
      DESCRIPTION=$(echo "$OP" | jq -r '.description // empty')

      case "$ACTION" in
        create)
          echo "Creating label '$NAME'..."
          GH_OPTS="--color \\"$COLOR\\""
          if [ -n "$DESCRIPTION" ]; then
            GH_OPTS="$GH_OPTS --description \\"$DESCRIPTION\\""
          fi
          eval gh label create "\\"$NAME\\"" $GH_OPTS || {
            echo "- **manage-labels**: Failed to create label '$NAME'" >> /tmp/validation-errors/manage-labels.txt
          }
          ;;
        edit)
          echo "Editing label '$NAME'..."
          GH_OPTS=""
          if [ -n "$NEW_NAME" ]; then
            GH_OPTS="$GH_OPTS --name \\"$NEW_NAME\\""
          fi
          if [ -n "$COLOR" ]; then
            GH_OPTS="$GH_OPTS --color \\"$COLOR\\""
          fi
          if [ -n "$DESCRIPTION" ]; then
            GH_OPTS="$GH_OPTS --description \\"$DESCRIPTION\\""
          fi
          eval gh label edit "\\"$NAME\\"" $GH_OPTS || {
            echo "- **manage-labels**: Failed to edit label '$NAME'" >> /tmp/validation-errors/manage-labels.txt
          }
          ;;
        delete)
          echo "Deleting label '$NAME'..."
          gh label delete "$NAME" --yes || {
            echo "- **manage-labels**: Failed to delete label '$NAME'" >> /tmp/validation-errors/manage-labels.txt
          }
          ;;
      esac
    done
  else
    echo "✗ manage-labels validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new ManageLabelsHandler();
