import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface ManageProjectConfig extends OutputConfig {
  allow_create?: boolean;
  allow_delete?: boolean;
  allow_edit?: boolean;
  allow_close?: boolean;
  owner?: string;
}

class ManageProjectHandler implements OutputHandler {
  name = "manage-project";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const projectConfig = config as ManageProjectConfig;
    const allowCreate = projectConfig.allow_create !== false;
    const allowDelete = projectConfig.allow_delete !== false;
    const allowEdit = projectConfig.allow_edit !== false;
    const allowClose = projectConfig.allow_close !== false;
    const owner = projectConfig.owner ?? "@me";

    const allowedOperations: string[] = [];
    if (allowCreate) allowedOperations.push('"create"');
    if (allowEdit) allowedOperations.push('"edit"');
    if (allowClose) allowedOperations.push('"close"');
    if (allowDelete) allowedOperations.push('"delete"');

    return `## Skill: Manage Project

Manage GitHub Projects - create, edit, close, or delete projects.

**File to create**: \`/tmp/outputs/manage-project.json\`

**JSON Schema**:
\`\`\`json
{
  "operations": [
    {
      "action": "create" | "edit" | "close" | "delete",
      "project_number": number,
      "title": "string",
      "description": "string",
      "owner": "string",
      "reason": "string"
    }
  ]
}
\`\`\`

**Fields**:
- \`operations\` (required): Array of project operations
- \`action\` (required): One of ${allowedOperations.join(", ")}
- \`project_number\` (required for edit/close/delete): Project number
- \`title\` (required for create, optional for edit): Project title
- \`description\` (optional): Project description
- \`owner\` (optional): Project owner ("@me" for user, or org name). Default: ${owner}
- \`reason\` (optional): Why this operation is being performed

**Constraints**:
- Allowed operations: ${allowedOperations.join(", ")}

**Example**:
Create \`/tmp/outputs/manage-project.json\` with:
\`\`\`json
{
  "operations": [
    {
      "action": "create",
      "title": "Q2 2026 Roadmap",
      "description": "Quarterly roadmap for Q2",
      "owner": "@me"
    },
    {
      "action": "edit",
      "project_number": 1,
      "title": "Updated Title",
      "description": "Updated description"
    },
    {
      "action": "close",
      "project_number": 2,
      "reason": "Quarter completed"
    }
  ]
}
\`\`\`

**Important**: Use the Write tool to create this file. Delete operations cannot be undone.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const projectConfig = config as ManageProjectConfig;
    const allowCreate = projectConfig.allow_create !== false;
    const allowDelete = projectConfig.allow_delete !== false;
    const allowEdit = projectConfig.allow_edit !== false;
    const allowClose = projectConfig.allow_close !== false;
    const defaultOwner = projectConfig.owner || "@me";

    return `
# Validate and execute manage-project output
MANAGE_PROJECT_FILE="/tmp/outputs/manage-project.json"

if [ -f "$MANAGE_PROJECT_FILE" ]; then
  echo "Found manage-project output file"

  # Validate JSON structure
  if ! jq empty "$MANAGE_PROJECT_FILE" 2>/dev/null; then
    echo "- **manage-project**: Invalid JSON format" >> /tmp/validation-errors/manage-project.txt
    exit 0
  fi

  # Extract operations
  OPERATIONS=$(jq -r '.operations' "$MANAGE_PROJECT_FILE")
  if [ "$OPERATIONS" = "null" ] || ! echo "$OPERATIONS" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "- **manage-project**: operations must be an array" >> /tmp/validation-errors/manage-project.txt
    exit 0
  fi

  VALIDATION_FAILED=false

  # Phase 1: Validate all operations
  OP_COUNT=$(echo "$OPERATIONS" | jq 'length')
  for i in $(seq 0 $((OP_COUNT - 1))); do
    OP=$(echo "$OPERATIONS" | jq ".[$i]")
    ACTION=$(echo "$OP" | jq -r '.action')
    PROJECT_NUMBER=$(echo "$OP" | jq -r '.project_number // empty')
    TITLE=$(echo "$OP" | jq -r '.title // empty')

    echo "Validating operation $((i + 1)): $ACTION"

    case "$ACTION" in
      create)
        ${
          allowCreate
            ? `
        if [ -z "$TITLE" ]; then
          echo "- **manage-project**: title is required for create action" >> /tmp/validation-errors/manage-project.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-project**: create action is not allowed" >> /tmp/validation-errors/manage-project.txt
        VALIDATION_FAILED=true`
        }
        ;;
      edit)
        ${
          allowEdit
            ? `
        if [ -z "$PROJECT_NUMBER" ]; then
          echo "- **manage-project**: project_number is required for edit action" >> /tmp/validation-errors/manage-project.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-project**: edit action is not allowed" >> /tmp/validation-errors/manage-project.txt
        VALIDATION_FAILED=true`
        }
        ;;
      close)
        ${
          allowClose
            ? `
        if [ -z "$PROJECT_NUMBER" ]; then
          echo "- **manage-project**: project_number is required for close action" >> /tmp/validation-errors/manage-project.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-project**: close action is not allowed" >> /tmp/validation-errors/manage-project.txt
        VALIDATION_FAILED=true`
        }
        ;;
      delete)
        ${
          allowDelete
            ? `
        if [ -z "$PROJECT_NUMBER" ]; then
          echo "- **manage-project**: project_number is required for delete action" >> /tmp/validation-errors/manage-project.txt
          VALIDATION_FAILED=true
        fi`
            : `
        echo "- **manage-project**: delete action is not allowed" >> /tmp/validation-errors/manage-project.txt
        VALIDATION_FAILED=true`
        }
        ;;
      *)
        echo "- **manage-project**: unknown action '$ACTION'" >> /tmp/validation-errors/manage-project.txt
        VALIDATION_FAILED=true
        ;;
    esac
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All manage-project validations passed - executing..."

    for i in $(seq 0 $((OP_COUNT - 1))); do
      OP=$(echo "$OPERATIONS" | jq ".[$i]")
      ACTION=$(echo "$OP" | jq -r '.action')
      PROJECT_NUMBER=$(echo "$OP" | jq -r '.project_number // empty')
      TITLE=$(echo "$OP" | jq -r '.title // empty')
      DESCRIPTION=$(echo "$OP" | jq -r '.description // empty')
      OWNER=$(echo "$OP" | jq -r '.owner // "${defaultOwner}"')

      case "$ACTION" in
        create)
          echo "Creating project '$TITLE'..."
          GH_OPTS="--owner \\"$OWNER\\" --title \\"$TITLE\\""
          eval gh project create $GH_OPTS || {
            echo "- **manage-project**: Failed to create project '$TITLE'" >> /tmp/validation-errors/manage-project.txt
          }
          ;;
        edit)
          echo "Editing project $PROJECT_NUMBER..."
          GH_OPTS=""
          if [ -n "$TITLE" ]; then
            GH_OPTS="$GH_OPTS --title \\"$TITLE\\""
          fi
          # Note: gh project edit doesn't support description directly
          eval gh project edit "$PROJECT_NUMBER" --owner "$OWNER" $GH_OPTS || {
            echo "- **manage-project**: Failed to edit project $PROJECT_NUMBER" >> /tmp/validation-errors/manage-project.txt
          }
          ;;
        close)
          echo "Closing project $PROJECT_NUMBER..."
          gh project close "$PROJECT_NUMBER" --owner "$OWNER" || {
            echo "- **manage-project**: Failed to close project $PROJECT_NUMBER" >> /tmp/validation-errors/manage-project.txt
          }
          ;;
        delete)
          echo "Deleting project $PROJECT_NUMBER..."
          gh project delete "$PROJECT_NUMBER" --owner "$OWNER" || {
            echo "- **manage-project**: Failed to delete project $PROJECT_NUMBER" >> /tmp/validation-errors/manage-project.txt
          }
          ;;
      esac
    done
  else
    echo "✗ manage-project validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new ManageProjectHandler();
