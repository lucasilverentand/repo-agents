import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreateIssueHandler implements OutputHandler {
  readonly name = 'create-issue';

  getContextScript(runtime: RuntimeContext): string | null {
    return `
# Fetch available repository labels for new issues
echo "" >> /tmp/context.txt
echo "## Available Repository Labels" >> /tmp/context.txt
echo "" >> /tmp/context.txt
echo "The following labels are available in this repository:" >> /tmp/context.txt

LABELS_LIST=$(gh api "repos/${runtime.repository}/labels?per_page=100" --jq '.[] | "- \\`" + .name + "\\`: " + .description' || echo "Failed to fetch labels")
echo "$LABELS_LIST" >> /tmp/context.txt

if [ "$LABELS_LIST" = "Failed to fetch labels" ]; then
  echo "" >> /tmp/context.txt
  echo "**Note**: Could not fetch labels. Labels are optional for new issues." >> /tmp/context.txt
else
  echo "" >> /tmp/context.txt
  echo "**Important**: Only use labels that already exist." >> /tmp/context.txt
fi

# Save labels list for validation
gh api "repos/${runtime.repository}/labels?per_page=100" --jq '.[].name' > /tmp/available-labels.txt 2>/dev/null || true
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Create Issue

Create a new GitHub issue.

**File to create**: \`/tmp/outputs/create-issue.json\`

For multiple issues, use numbered suffixes: \`create-issue-1.json\`, \`create-issue-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "title": "string",
  "body": "string",
  "labels": ["string"],
  "assignees": ["string"]
}
\`\`\`

**Fields**:
- \`title\` (required): Issue title
- \`body\` (required): Issue description in markdown
- \`labels\` (optional): Array of label names to add
- \`assignees\` (optional): Array of GitHub usernames to assign

**Constraints**:
- Maximum issues: ${maxConstraint}
- Title must be non-empty
- Labels must exist in repository (see available labels above)

**Example**:
Create \`/tmp/outputs/create-issue.json\` with:
\`\`\`json
{
  "title": "Bug: Application crashes on startup",
  "body": "## Description\n\nThe application crashes when starting up on macOS 14.\n\n## Steps to Reproduce\n\n1. Launch app\n2. Crash occurs immediately",
  "labels": ["bug", "priority: high"],
  "assignees": ["maintainer"]
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
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
  for issue_file in $ISSUE_FILES; do
    echo "Validating $issue_file..."

    # Validate JSON structure
    if ! jq empty "$issue_file" 2>/dev/null; then
      echo "- **create-issue**: Invalid JSON format in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    TITLE=$(jq -r '.title' "$issue_file")
    BODY=$(jq -r '.body' "$issue_file")

    # Validate required fields
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-issue**: Title is missing in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-issue**: Body is missing in $issue_file" >> /tmp/validation-errors/create-issue.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate labels if provided
    LABELS=$(jq -r '.labels[]' "$issue_file" 2>/dev/null)
    if [ -n "$LABELS" ] && [ -f /tmp/available-labels.txt ]; then
      while IFS= read -r label; do
        if ! grep -Fxq "$label" /tmp/available-labels.txt; then
          echo "- **create-issue**: Label '$label' does not exist in repository (from $issue_file)" >> /tmp/validation-errors/create-issue.txt
          VALIDATION_FAILED=true
        fi
      done <<< "$LABELS"
    fi

    echo "✓ Validation passed for $issue_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-issue validations passed - executing..."
    for issue_file in $ISSUE_FILES; do
      TITLE=$(jq -r '.title' "$issue_file")
      BODY=$(jq -r '.body' "$issue_file")
      LABELS=$(jq -r '.labels[]' "$issue_file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
      ASSIGNEES=$(jq -r '.assignees[]' "$issue_file" 2>/dev/null | tr '\n' ',' | sed 's/,$//')

      # Create issue via GitHub API
      GH_CMD="gh api repos/${runtime.repository}/issues -f title=\"$TITLE\" -f body=\"$BODY\""
      [ -n "$LABELS" ] && GH_CMD="$GH_CMD -f labels=\"$LABELS\""
      [ -n "$ASSIGNEES" ] && GH_CMD="$GH_CMD -f assignees=\"$ASSIGNEES\""

      eval "$GH_CMD" || {
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

// Export handler for registration
export const handler = new CreateIssueHandler();

