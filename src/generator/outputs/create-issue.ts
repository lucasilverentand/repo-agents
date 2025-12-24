import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreateIssueHandler implements OutputHandler {
  name = 'create-issue' as const;

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-issue
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Create Issue

Create a new issue in the repository.

**File to create**: \`/tmp/outputs/create-issue.json\`

For multiple issues, use numbered suffixes: \`create-issue-1.json\`, \`create-issue-2.json\`, etc.

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

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute create-issue output(s)
ISSUE_FILES=$(find /tmp/outputs -name "create-issue*.json" 2>/dev/null || true)

if [ -n "$ISSUE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$ISSUE_FILES" | wc -l)
  echo "Found $FILE_COUNT create-issue output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **create-issue**: Too many issue files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/create-issue.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  EXISTING_LABELS=""

  for issue_file in $ISSUE_FILES; do
    echo "Validating $issue_file..."

    # Validate JSON structure
    if ! jq empty "$issue_file" 2>/dev/null; then
      echo "- **create-issue**: Invalid JSON format in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    TITLE=$(jq -r '.title' "$issue_file")
    BODY=$(jq -r '.body' "$issue_file")
    LABELS=$(jq -r '.labels // [] | @json' "$issue_file")

    # Validate required fields
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-issue**: title is required in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    elif [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-issue**: body is required in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    elif [ \${#TITLE} -gt 256 ]; then
      echo "- **create-issue**: title exceeds 256 characters in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate labels if provided
    if [ "$LABELS" != "[]" ]; then
      # Fetch existing labels only once
      if [ -z "$EXISTING_LABELS" ]; then
        EXISTING_LABELS=$(gh api "repos/${runtime.repository}/labels" --jq '[.[].name]' 2>/dev/null || echo '[]')
      fi

      for label in $(echo "$LABELS" | jq -r '.[]'); do
        if ! echo "$EXISTING_LABELS" | jq -e --arg label "$label" 'index($label)' >/dev/null 2>&1; then
          echo "- **create-issue**: Label '$label' does not exist in repository (in $issue_file)" >> /tmp/validation-errors/create-issue.txt
          VALIDATION_FAILED=true
        fi
      done
    fi

    echo "✓ Validation passed for $issue_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-issue validations passed - executing..."

    for issue_file in $ISSUE_FILES; do
      TITLE=$(jq -r '.title' "$issue_file")
      BODY=$(jq -r '.body' "$issue_file")
      LABELS=$(jq -r '.labels // [] | @json' "$issue_file")
      ASSIGNEES=$(jq -r '.assignees // [] | @json' "$issue_file")

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
        echo "- **create-issue**: Failed to create issue from $issue_file via GitHub API" >> /tmp/validation-errors/create-issue.txt
      }
    done
  else
    echo "✗ create-issue validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Register the handler
export const handler = new CreateIssueHandler();

export default handler;
