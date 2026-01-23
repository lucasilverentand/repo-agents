import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

interface LinkProjectConfig extends OutputConfig {
  project_number?: number;
  owner?: string;
}

class LinkProjectHandler implements OutputHandler {
  name = "link-project";

  getContextScript(_runtime: RuntimeContext): string | null {
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const linkConfig = config as LinkProjectConfig;
    const projectNumber = linkConfig.project_number;
    const owner = linkConfig.owner ?? "@me";

    const projectNote = projectNumber ? `\n- Default project number: ${projectNumber}` : "";
    const ownerNote = `\n- Default owner: ${owner}`;

    return `## Skill: Link Project

Link or unlink a GitHub Project to repositories or teams.

**File to create**: \`/tmp/outputs/link-project.json\`

**JSON Schema**:
\`\`\`json
{
  "operations": [
    {
      "action": "link" | "unlink",
      "target_type": "repository" | "team",
      "target": "string",
      "reason": "string"
    }
  ],
  "project_number": number,
  "owner": "string"
}
\`\`\`

**Fields**:
- \`operations\` (required): Array of link/unlink operations
  - \`action\` (required): "link" or "unlink"
  - \`target_type\` (required): "repository" or "team"
  - \`target\` (required): Repository (owner/repo) or team (org/team-name)
  - \`reason\` (optional): Why this link is being created/removed
- \`project_number\` (required): Project number${projectNote}
- \`owner\` (optional): Project owner${ownerNote}

**Example**:
Create \`/tmp/outputs/link-project.json\` with:
\`\`\`json
{
  "operations": [
    {
      "action": "link",
      "target_type": "repository",
      "target": "owner/repo-name",
      "reason": "Link main repo to roadmap project"
    },
    {
      "action": "link",
      "target_type": "team",
      "target": "myorg/engineering",
      "reason": "Give engineering team access"
    },
    {
      "action": "unlink",
      "target_type": "repository",
      "target": "owner/old-repo",
      "reason": "Repository archived"
    }
  ],
  "project_number": 1,
  "owner": "@me"
}
\`\`\`

**Important**: Use the Write tool to create this file. Team linking requires org-level permissions.`;
  }

  generateValidationScript(config: OutputConfig, _runtime: RuntimeContext): string {
    const linkConfig = config as LinkProjectConfig;
    const defaultProjectNumber = linkConfig.project_number || "";
    const defaultOwner = linkConfig.owner || "@me";

    return `
# Validate and execute link-project output
LINK_PROJECT_FILE="/tmp/outputs/link-project.json"

if [ -f "$LINK_PROJECT_FILE" ]; then
  echo "Found link-project output file"

  # Validate JSON structure
  if ! jq empty "$LINK_PROJECT_FILE" 2>/dev/null; then
    echo "- **link-project**: Invalid JSON format" >> /tmp/validation-errors/link-project.txt
    exit 0
  fi

  # Extract fields
  OPERATIONS=$(jq -r '.operations' "$LINK_PROJECT_FILE")
  PROJECT_NUMBER=$(jq -r '.project_number // "${defaultProjectNumber}"' "$LINK_PROJECT_FILE")

  if [ "$OPERATIONS" = "null" ] || ! echo "$OPERATIONS" | jq -e 'type == "array"' >/dev/null 2>&1; then
    echo "- **link-project**: operations must be an array" >> /tmp/validation-errors/link-project.txt
    exit 0
  fi

  if [ -z "$PROJECT_NUMBER" ] || [ "$PROJECT_NUMBER" = "null" ]; then
    echo "- **link-project**: project_number is required" >> /tmp/validation-errors/link-project.txt
    exit 0
  fi

  VALIDATION_FAILED=false

  # Phase 1: Validate all operations
  OP_COUNT=$(echo "$OPERATIONS" | jq 'length')
  for i in $(seq 0 $((OP_COUNT - 1))); do
    OP=$(echo "$OPERATIONS" | jq ".[$i]")
    ACTION=$(echo "$OP" | jq -r '.action')
    TARGET_TYPE=$(echo "$OP" | jq -r '.target_type')
    TARGET=$(echo "$OP" | jq -r '.target')

    echo "Validating operation $((i + 1)): $ACTION $TARGET_TYPE"

    # Validate action
    if [ "$ACTION" != "link" ] && [ "$ACTION" != "unlink" ]; then
      echo "- **link-project**: action must be 'link' or 'unlink', got '$ACTION'" >> /tmp/validation-errors/link-project.txt
      VALIDATION_FAILED=true
    fi

    # Validate target_type
    if [ "$TARGET_TYPE" != "repository" ] && [ "$TARGET_TYPE" != "team" ]; then
      echo "- **link-project**: target_type must be 'repository' or 'team', got '$TARGET_TYPE'" >> /tmp/validation-errors/link-project.txt
      VALIDATION_FAILED=true
    fi

    # Validate target
    if [ -z "$TARGET" ] || [ "$TARGET" = "null" ]; then
      echo "- **link-project**: target is required" >> /tmp/validation-errors/link-project.txt
      VALIDATION_FAILED=true
    fi
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All link-project validations passed - executing..."

    OWNER=$(jq -r '.owner // "${defaultOwner}"' "$LINK_PROJECT_FILE")

    for i in $(seq 0 $((OP_COUNT - 1))); do
      OP=$(echo "$OPERATIONS" | jq ".[$i]")
      ACTION=$(echo "$OP" | jq -r '.action')
      TARGET_TYPE=$(echo "$OP" | jq -r '.target_type')
      TARGET=$(echo "$OP" | jq -r '.target')

      if [ "$ACTION" = "link" ]; then
        if [ "$TARGET_TYPE" = "repository" ]; then
          echo "Linking repository $TARGET to project $PROJECT_NUMBER..."
          gh project link "$PROJECT_NUMBER" --owner "$OWNER" --repo "$TARGET" || {
            echo "- **link-project**: Failed to link repository $TARGET" >> /tmp/validation-errors/link-project.txt
          }
        else
          echo "Linking team $TARGET to project $PROJECT_NUMBER..."
          gh project link "$PROJECT_NUMBER" --owner "$OWNER" --team "$TARGET" || {
            echo "- **link-project**: Failed to link team $TARGET" >> /tmp/validation-errors/link-project.txt
          }
        fi
      else
        if [ "$TARGET_TYPE" = "repository" ]; then
          echo "Unlinking repository $TARGET from project $PROJECT_NUMBER..."
          gh project unlink "$PROJECT_NUMBER" --owner "$OWNER" --repo "$TARGET" || {
            echo "- **link-project**: Failed to unlink repository $TARGET" >> /tmp/validation-errors/link-project.txt
          }
        else
          echo "Unlinking team $TARGET from project $PROJECT_NUMBER..."
          gh project unlink "$PROJECT_NUMBER" --owner "$OWNER" --team "$TARGET" || {
            echo "- **link-project**: Failed to unlink team $TARGET" >> /tmp/validation-errors/link-project.txt
          }
        fi
      fi
    done
  else
    echo "✗ link-project validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new LinkProjectHandler();
