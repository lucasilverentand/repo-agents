import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';
import { registry } from './index';

class CreateIssueHandler implements OutputHandler {
  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Create Issue

Create a new issue in the repository.

**File to create**: \`/tmp/outputs/create-issue.json\`

**JSON Schema**:
\`\`\`json
{
  "title": "string",
  "body": "string",
  "labels": ["string"] (optional),
  "assignees": ["string"] (optional)
}
\`\`\`

**Fields**:
- \`title\` (required): Clear, descriptive issue title
- \`body\` (required): Detailed description with context
- \`labels\` (optional): Array of label names (must exist in repository)
- \`assignees\` (optional): Array of GitHub usernames to assign

**Constraints**:
- Maximum issues: ${maxConstraint}
- Title must be non-empty
- Body should provide sufficient context

**Example**:
Create \`/tmp/outputs/create-issue.json\` with:
\`\`\`json
{
  "title": "Add support for custom configurations",
  "body": "## Description\\n\\nThis issue tracks the work to add custom configuration support...\\n\\n## Acceptance Criteria\\n\\n- [ ] Configuration file parsing\\n- [ ] Validation logic\\n- [ ] Documentation",
  "labels": ["enhancement", "good first issue"]
}
\`\`\`

**Important**: Use the Write tool to create this file. Only create issues when necessary.`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    return `
# Validate and execute create-issue output
if [ -f "/tmp/outputs/create-issue.json" ]; then
  echo "Validating create-issue output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/create-issue.json 2>/dev/null; then
    echo "- **create-issue**: Invalid JSON format" > /tmp/validation-errors/create-issue.txt
  else
    # Extract fields
    TITLE=$(jq -r '.title' /tmp/outputs/create-issue.json)
    BODY=$(jq -r '.body' /tmp/outputs/create-issue.json)
    LABELS=$(jq -r '.labels // [] | @json' /tmp/outputs/create-issue.json)
    ASSIGNEES=$(jq -r '.assignees // [] | @json' /tmp/outputs/create-issue.json)

    # Validate required fields
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-issue**: title is required" > /tmp/validation-errors/create-issue.txt
    elif [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-issue**: body is required" > /tmp/validation-errors/create-issue.txt
    elif [ \${#TITLE} -gt 256 ]; then
      echo "- **create-issue**: title exceeds 256 characters" > /tmp/validation-errors/create-issue.txt
    else
      # Validate labels if provided
      if [ "$LABELS" != "[]" ]; then
        EXISTING_LABELS=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')
        for label in $(echo "$LABELS" | jq -r '.[]'); do
          if ! echo "$EXISTING_LABELS" | jq -e --arg label "$label" 'index($label)' >/dev/null 2>&1; then
            echo "- **create-issue**: Label '$label' does not exist in repository" >> /tmp/validation-errors/create-issue.txt
          fi
        done

        # If errors exist, skip execution
        if [ -f "/tmp/validation-errors/create-issue.txt" ]; then
          exit 0
        fi
      fi

      # Validation passed - execute
      echo "✓ create-issue validation passed"

      # Build API payload
      PAYLOAD=$(jq -n \\
        --arg title "$TITLE" \\
        --arg body "$BODY" \\
        --argjson labels "$LABELS" \\
        --argjson assignees "$ASSIGNEES" \\
        '{title: $title, body: $body, labels: $labels, assignees: $assignees}')

      # Create issue via GitHub API
      gh api "repos/${runtime.repository}/issues" \\
        --input - <<< "$PAYLOAD" || {
        echo "- **create-issue**: Failed to create issue via GitHub API" > /tmp/validation-errors/create-issue.txt
      }
    fi
  fi
fi
`;
  }
}

// Register the handler
const handler = new CreateIssueHandler();
registry.register('create-issue', handler);

export default handler;
