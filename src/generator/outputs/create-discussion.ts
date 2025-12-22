import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreateDiscussionHandler implements OutputHandler {
  readonly name = 'create-discussion';

  getContextScript(runtime: RuntimeContext): string | null {
    return `
# Fetch available discussion categories
echo "" >> /tmp/context.txt
echo "## Available Discussion Categories" >> /tmp/context.txt
echo "" >> /tmp/context.txt
echo "The following discussion categories are available:" >> /tmp/context.txt

CATEGORIES=$(gh api graphql -f query='query { repository(owner: "${runtime.repository.split('/')[0]}", name: "${runtime.repository.split('/')[1]}") { discussionCategories(first: 20) { nodes { id name slug description } } } }' --jq '.data.repository.discussionCategories.nodes[] | "- \\`" + .slug + "\\` (" + .name + "): " + (.description // "No description")' || echo "Failed to fetch categories")
echo "$CATEGORIES" >> /tmp/context.txt

# Save category IDs for validation
gh api graphql -f query='query { repository(owner: "${runtime.repository.split('/')[0]}", name: "${runtime.repository.split('/')[1]}") { discussionCategories(first: 20) { nodes { id slug } } } }' --jq '.data.repository.discussionCategories.nodes[] | .slug + ":" + .id' > /tmp/discussion-categories.txt 2>/dev/null || true
`;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Create Discussion

Create a new GitHub discussion.

**File to create**: \`/tmp/outputs/create-discussion.json\`

For multiple discussions, use numbered suffixes: \`create-discussion-1.json\`, \`create-discussion-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "title": "string",
  "body": "string",
  "category": "string"
}
\`\`\`

**Fields**:
- \`title\` (required): Discussion title
- \`body\` (required): Discussion body in markdown
- \`category\` (required): Category slug (see available categories above)

**Constraints**:
- Maximum discussions: ${maxConstraint}
- Title must be non-empty
- Category must exist in repository

**Example**:
Create \`/tmp/outputs/create-discussion.json\` with:
\`\`\`json
{
  "title": "Ideas for improving documentation",
  "body": "## Proposal\n\nI think we should add more examples to the API documentation.\n\n## Benefits\n\n- Easier onboarding\n- Fewer support questions",
  "category": "ideas"
}
\`\`\`

**Important**: Use the Write tool to create this file.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute create-discussion output(s)
DISCUSSION_FILES=$(find /tmp/outputs -name "create-discussion*.json" 2>/dev/null || true)

if [ -n "$DISCUSSION_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$DISCUSSION_FILES" | wc -l)
  echo "Found $FILE_COUNT create-discussion output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **create-discussion**: Too many discussion files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/create-discussion.txt
    exit 0
  fi`
      : ''
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for discussion_file in $DISCUSSION_FILES; do
    echo "Validating $discussion_file..."

    # Validate JSON structure
    if ! jq empty "$discussion_file" 2>/dev/null; then
      echo "- **create-discussion**: Invalid JSON format in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract required fields
    TITLE=$(jq -r '.title' "$discussion_file")
    BODY=$(jq -r '.body' "$discussion_file")
    CATEGORY=$(jq -r '.category' "$discussion_file")

    # Validate required fields
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-discussion**: Title is missing in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-discussion**: Body is missing in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    if [ -z "$CATEGORY" ] || [ "$CATEGORY" = "null" ]; then
      echo "- **create-discussion**: Category is missing in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $discussion_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-discussion validations passed - executing..."
    for discussion_file in $DISCUSSION_FILES; do
      TITLE=$(jq -r '.title' "$discussion_file")
      BODY=$(jq -r '.body' "$discussion_file")
      CATEGORY=$(jq -r '.category' "$discussion_file")

      # Get category ID from slug
      CATEGORY_ID=$(grep "^$CATEGORY:" /tmp/discussion-categories.txt | cut -d: -f2)

      if [ -z "$CATEGORY_ID" ]; then
        echo "- **create-discussion**: Category '$CATEGORY' not found in repository" >> /tmp/validation-errors/create-discussion.txt
        continue
      fi

      # Create discussion via GraphQL API
      gh api graphql -f query="mutation { createDiscussion(input: { repositoryId: \"${runtime.repository}\", categoryId: \"$CATEGORY_ID\", title: \"$TITLE\", body: \"$BODY\" }) { discussion { id } } }" || {
        echo "- **create-discussion**: Failed to create discussion from $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      }
    done
  else
    echo "✗ create-discussion validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Export handler for registration
export const handler = new CreateDiscussionHandler();

