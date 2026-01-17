import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class SetMilestoneHandler implements OutputHandler {
  name = "set-milestone";

  getContextScript(runtime: RuntimeContext): string | null {
    // Fetch available milestones
    return `
# Fetch available milestones
MILESTONES_JSON=$(gh api "repos/${runtime.repository}/milestones?state=all&per_page=100" --jq '[.[] | {number: .number, title: .title, state: .state}]' 2>/dev/null || echo '[]')
MILESTONES_LIST=$(echo "$MILESTONES_JSON" | jq -r 'map("\\(.title) (\\(.state))") | join(", ")' 2>/dev/null || echo "No milestones available")

cat >> /tmp/context.txt << 'MILESTONES_EOF'

## Available Milestones

The following milestones are available in this repository:
$MILESTONES_LIST

**Important**: Use the exact milestone title when setting milestones.

MILESTONES_EOF
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Set Milestone

Assign a milestone to an issue or pull request.

**File to create**: \`/tmp/outputs/set-milestone.json\`

For multiple assignments, use numbered suffixes: \`set-milestone-1.json\`, \`set-milestone-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "issue_number": number,
  "milestone": "string"
}
\`\`\`

**Fields**:
- \`issue_number\` (required): Issue or PR number
- \`milestone\` (required): Milestone title (must match exactly)

**Constraints**:
- Maximum assignments: ${maxConstraint}
- Milestone must exist in the repository

**Example**:
Create \`/tmp/outputs/set-milestone.json\` with:
\`\`\`json
{
  "issue_number": 123,
  "milestone": "v2.0"
}
\`\`\`

**Important**: Use the Write tool to create this file. Check available milestones in the context above.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute set-milestone output(s)
MILESTONE_FILES=$(find /tmp/outputs -name "set-milestone*.json" 2>/dev/null || true)

if [ -n "$MILESTONE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$MILESTONE_FILES" | wc -l)
  echo "Found $FILE_COUNT set-milestone output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **set-milestone**: Too many milestone files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/set-milestone.txt
    exit 0
  fi`
      : ""
  }

  # Fetch available milestones
  MILESTONES_JSON=$(gh api "repos/${runtime.repository}/milestones?state=all&per_page=100" 2>/dev/null || echo '[]')

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for milestone_file in $MILESTONE_FILES; do
    echo "Validating $milestone_file..."

    # Validate JSON structure
    if ! jq empty "$milestone_file" 2>/dev/null; then
      echo "- **set-milestone**: Invalid JSON format in $milestone_file" >> /tmp/validation-errors/set-milestone.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    ISSUE_NUMBER=$(jq -r '.issue_number' "$milestone_file")
    MILESTONE=$(jq -r '.milestone' "$milestone_file")

    # Validate required fields
    if [ -z "$ISSUE_NUMBER" ] || [ "$ISSUE_NUMBER" = "null" ]; then
      echo "- **set-milestone**: issue_number is required in $milestone_file" >> /tmp/validation-errors/set-milestone.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$ISSUE_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **set-milestone**: issue_number must be a number in $milestone_file" >> /tmp/validation-errors/set-milestone.txt
      VALIDATION_FAILED=true
      continue
    elif [ -z "$MILESTONE" ] || [ "$MILESTONE" = "null" ]; then
      echo "- **set-milestone**: milestone is required in $milestone_file" >> /tmp/validation-errors/set-milestone.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $milestone_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All set-milestone validations passed - executing..."
    for milestone_file in $MILESTONE_FILES; do
      ISSUE_NUMBER=$(jq -r '.issue_number' "$milestone_file")
      MILESTONE=$(jq -r '.milestone' "$milestone_file")

      # Find milestone number by title
      MILESTONE_NUMBER=$(echo "$MILESTONES_JSON" | jq -r ".[] | select(.title == \\"$MILESTONE\\") | .number" 2>/dev/null)

      if [ -z "$MILESTONE_NUMBER" ] || [ "$MILESTONE_NUMBER" = "null" ]; then
        echo "- **set-milestone**: Milestone '$MILESTONE' not found in repository" >> /tmp/validation-errors/set-milestone.txt
        continue
      fi

      # Set milestone via GitHub API
      gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER" \\
        -X PATCH \\
        -F milestone="$MILESTONE_NUMBER" || {
        echo "- **set-milestone**: Failed to set milestone for issue #$ISSUE_NUMBER" >> /tmp/validation-errors/set-milestone.txt
      }
    done
  else
    echo "✗ set-milestone validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new SetMilestoneHandler();
