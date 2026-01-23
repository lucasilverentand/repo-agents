import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface AddToProjectConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
}

class AddToProjectHandler implements OutputHandler {
  name = "add-to-project";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const projectConfig = config as AddToProjectConfig;
    const projectNumber = projectConfig.project_number;
    const owner = projectConfig.owner ?? "@me";

    const projectNote = projectNumber ? `\n- Default project number: ${projectNumber}` : "";
    const ownerNote = `\n- Default owner: ${owner}`;

    return `## Skill: Add to Project

Add issues or pull requests to a GitHub Project.

**File to create**: \`/tmp/outputs/add-to-project.json\`

For multiple add operations, use numbered suffixes: \`add-to-project-1.json\`, \`add-to-project-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "items": [
    {
      "type": "issue" | "pull_request" | "draft",
      "number": number,
      "title": "string",
      "body": "string"
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`items\` (required): Array of items to add
  - \`type\` (required): "issue", "pull_request", or "draft"
  - \`number\` (required for issue/pull_request): Issue or PR number
  - \`title\` (required for draft): Title for draft item
  - \`body\` (optional for draft): Body content for draft item
- \`project_number\` (optional): Project number to add to${projectNote}
- \`owner\` (optional): Project owner ("@me" for user, or org name)${ownerNote}

**Example**:
Create \`/tmp/outputs/add-to-project.json\` with:
\`\`\`json
{
  "items": [
    { "type": "issue", "number": 123 },
    { "type": "pull_request", "number": 456 },
    { "type": "draft", "title": "New task", "body": "Task description" }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const projectConfig = config as AddToProjectConfig;
    const defaultProjectNumber = projectConfig.project_number || "";
    const defaultOwner = projectConfig.owner || "@me";

    return `
# Validate and execute add-to-project output(s)
ADD_PROJECT_FILES=$(find /tmp/outputs -name "add-to-project*.json" 2>/dev/null || true)

if [ -n "$ADD_PROJECT_FILES" ]; then
  FILE_COUNT=$(echo "$ADD_PROJECT_FILES" | wc -l)
  echo "Found $FILE_COUNT add-to-project output file(s)"

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for add_file in $ADD_PROJECT_FILES; do
    echo "Validating $add_file..."

    # Validate JSON structure
    if ! jq empty "$add_file" 2>/dev/null; then
      echo "- **add-to-project**: Invalid JSON format in $add_file" >> /tmp/validation-errors/add-to-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ITEMS=$(jq -r '.items' "$add_file")
    PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$add_file")

    # Validate items array
    if [ "$ITEMS" = "null" ] || ! echo "$ITEMS" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **add-to-project**: items must be an array in $add_file" >> /tmp/validation-errors/add-to-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate project number
    if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
      echo "- **add-to-project**: project_number is required in $add_file" >> /tmp/validation-errors/add-to-project.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate each item
    ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
    for i in $(seq 0 $((ITEM_COUNT - 1))); do
      ITEM=$(echo "$ITEMS" | jq ".[$i]")
      ITEM_TYPE=$(echo "$ITEM" | jq -r '.type')

      case "$ITEM_TYPE" in
        issue|pull_request)
          NUMBER=$(echo "$ITEM" | jq -r '.number')
          if [ -z "$NUMBER" ] || [ "$NUMBER" = "null" ]; then
            echo "- **add-to-project**: number is required for $ITEM_TYPE type" >> /tmp/validation-errors/add-to-project.txt
            VALIDATION_FAILED=true
          fi
          ;;
        draft)
          TITLE=$(echo "$ITEM" | jq -r '.title')
          if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
            echo "- **add-to-project**: title is required for draft type" >> /tmp/validation-errors/add-to-project.txt
            VALIDATION_FAILED=true
          fi
          ;;
        *)
          echo "- **add-to-project**: unknown item type '$ITEM_TYPE'" >> /tmp/validation-errors/add-to-project.txt
          VALIDATION_FAILED=true
          ;;
      esac
    done

    echo "✓ Validation passed for $add_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All add-to-project validations passed - executing..."

    for add_file in $ADD_PROJECT_FILES; do
      ITEMS=$(jq -r '.items' "$add_file")
      PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$add_file")
      OWNER=$(jq -r '.owner // "${defaultOwner}"' "$add_file")

      ITEM_COUNT=$(echo "$ITEMS" | jq 'length')
      for i in $(seq 0 $((ITEM_COUNT - 1))); do
        ITEM=$(echo "$ITEMS" | jq ".[$i]")
        ITEM_TYPE=$(echo "$ITEM" | jq -r '.type')

        case "$ITEM_TYPE" in
          issue)
            NUMBER=$(echo "$ITEM" | jq -r '.number')
            echo "Adding issue #$NUMBER to project $PROJECT_NUMBER..."
            ISSUE_URL=$(gh issue view "$NUMBER" --repo "${runtime.repository}" --json url --jq '.url')
            gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL" || {
              echo "- **add-to-project**: Failed to add issue #$NUMBER" >> /tmp/validation-errors/add-to-project.txt
            }
            ;;
          pull_request)
            NUMBER=$(echo "$ITEM" | jq -r '.number')
            echo "Adding PR #$NUMBER to project $PROJECT_NUMBER..."
            PR_URL=$(gh pr view "$NUMBER" --repo "${runtime.repository}" --json url --jq '.url')
            gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$PR_URL" || {
              echo "- **add-to-project**: Failed to add PR #$NUMBER" >> /tmp/validation-errors/add-to-project.txt
            }
            ;;
          draft)
            TITLE=$(echo "$ITEM" | jq -r '.title')
            BODY=$(echo "$ITEM" | jq -r '.body // ""')
            echo "Creating draft item '$TITLE' in project $PROJECT_NUMBER..."
            GH_OPTS="--title \\"$TITLE\\""
            if [ -n "$BODY" ] && [ "$BODY" != "null" ]; then
              GH_OPTS="$GH_OPTS --body \\"$BODY\\""
            fi
            eval gh project item-create "$PROJECT_NUMBER" --owner "$OWNER" $GH_OPTS || {
              echo "- **add-to-project**: Failed to create draft item '$TITLE'" >> /tmp/validation-errors/add-to-project.txt
            }
            ;;
        esac
      done
    done
  else
    echo "✗ add-to-project validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new AddToProjectHandler();
