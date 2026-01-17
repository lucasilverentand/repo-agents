import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class TriggerWorkflowHandler implements OutputHandler {
  name = "trigger-workflow";

  getContextScript(runtime: RuntimeContext): string | null {
    // Fetch available workflows
    return `
# Fetch available workflows
WORKFLOWS_JSON=$(gh api "repos/${runtime.repository}/actions/workflows" --jq '.workflows[] | {id: .id, name: .name, path: .path}' 2>/dev/null || echo '{}')
WORKFLOWS_LIST=$(echo "$WORKFLOWS_JSON" | jq -s 'map("\\(.name) (\\(.path))") | join(", ")' 2>/dev/null || echo "No workflows available")

cat >> /tmp/context.txt << 'WORKFLOWS_EOF'

## Available Workflows

The following workflows can be triggered in this repository:
$WORKFLOWS_LIST

**Important**: Use the workflow filename (e.g., "deploy.yml") when triggering workflows.

WORKFLOWS_EOF
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Trigger Workflow

Dispatch a GitHub Actions workflow.

**File to create**: \`/tmp/outputs/trigger-workflow.json\`

For multiple dispatches, use numbered suffixes: \`trigger-workflow-1.json\`, \`trigger-workflow-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "workflow": "string",
  "ref": "string",
  "inputs": {
    "key": "value"
  }
}
\`\`\`

**Fields**:
- \`workflow\` (required): Workflow filename (e.g., "deploy.yml") or workflow ID
- \`ref\` (optional): Git ref to run workflow on (default: "main")
- \`inputs\` (optional): Object of input key-value pairs for the workflow

**Constraints**:
- Maximum dispatches: ${maxConstraint}
- Workflow must have \`workflow_dispatch\` trigger
- Inputs must match workflow's input schema

**Example**:
Create \`/tmp/outputs/trigger-workflow.json\` with:
\`\`\`json
{
  "workflow": "deploy.yml",
  "ref": "main",
  "inputs": {
    "environment": "staging",
    "version": "1.2.3"
  }
}
\`\`\`

**Important**: Use the Write tool to create this file. Check available workflows in the context above.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute trigger-workflow output(s)
TRIGGER_FILES=$(find /tmp/outputs -name "trigger-workflow*.json" 2>/dev/null || true)

if [ -n "$TRIGGER_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$TRIGGER_FILES" | wc -l)
  echo "Found $FILE_COUNT trigger-workflow output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **trigger-workflow**: Too many trigger files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/trigger-workflow.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for trigger_file in $TRIGGER_FILES; do
    echo "Validating $trigger_file..."

    # Validate JSON structure
    if ! jq empty "$trigger_file" 2>/dev/null; then
      echo "- **trigger-workflow**: Invalid JSON format in $trigger_file" >> /tmp/validation-errors/trigger-workflow.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    WORKFLOW=$(jq -r '.workflow' "$trigger_file")

    # Validate required fields
    if [ -z "$WORKFLOW" ] || [ "$WORKFLOW" = "null" ]; then
      echo "- **trigger-workflow**: workflow is required in $trigger_file" >> /tmp/validation-errors/trigger-workflow.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $trigger_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All trigger-workflow validations passed - executing..."
    for trigger_file in $TRIGGER_FILES; do
      WORKFLOW=$(jq -r '.workflow' "$trigger_file")
      REF=$(jq -r '.ref // "main"' "$trigger_file")
      INPUTS=$(jq -c '.inputs // {}' "$trigger_file")

      # Build dispatch request
      REQUEST_BODY=$(jq -n --arg ref "$REF" --argjson inputs "$INPUTS" '{ref: $ref, inputs: $inputs}')

      # Trigger workflow via GitHub API
      gh api "repos/${runtime.repository}/actions/workflows/$WORKFLOW/dispatches" \\
        -X POST \\
        --input - <<< "$REQUEST_BODY" || {
        echo "- **trigger-workflow**: Failed to trigger workflow '$WORKFLOW'" >> /tmp/validation-errors/trigger-workflow.txt
      }
    done
  else
    echo "✗ trigger-workflow validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new TriggerWorkflowHandler();
