import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class CreateDiscussionHandler implements OutputHandler {
  name = 'create-discussion' as const;

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-discussion
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Create Discussion

Create a new discussion in the repository.

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
- \`title\` (required): Clear, descriptive discussion title
- \`body\` (required): Detailed content with context
- \`category\` (required): Discussion category name (e.g., "Announcements", "General", "Q&A")

**Constraints**:
- Maximum discussions: ${maxConstraint}
- Title must be non-empty
- Body should provide sufficient context
- Category must exist in the repository

**Common Categories**:
- "Announcements" - For project announcements and updates
- "General" - General discussions
- "Ideas" - Feature ideas and suggestions
- "Q&A" - Questions and answers
- "Show and tell" - Share your work

**Example**:
Create \`/tmp/outputs/create-discussion.json\` with:
\`\`\`json
{
  "title": "Weekly Activity Report - 2025-01-15",
  "body": "## Summary\\n\\nHere's what happened this week...\\n\\n## Highlights\\n\\n- Feature X shipped\\n- 10 issues closed",
  "category": "Announcements"
}
\`\`\`

**Important**: Use the Write tool to create this file. Only create discussions when necessary.`;
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

  # Phase 1: Fetch repository discussion categories (needed for validation)
  echo "Fetching discussion categories..."
  REPO_OWNER=$(echo "${runtime.repository}" | cut -d'/' -f1)
  REPO_NAME=$(echo "${runtime.repository}" | cut -d'/' -f2)

  CATEGORIES_QUERY='query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      discussionCategories(first: 50) {
        nodes {
          id
          name
        }
      }
    }
  }'

  CATEGORIES_DATA=$(gh api graphql \\
    -f query="$CATEGORIES_QUERY" \\
    -f owner="$REPO_OWNER" \\
    -f repo="$REPO_NAME" \\
    --jq '.data.repository.discussionCategories.nodes' 2>/dev/null || echo '[]')

  # Phase 2: Validate all files
  VALIDATION_FAILED=false

  for discussion_file in $DISCUSSION_FILES; do
    echo "Validating $discussion_file..."

    # Validate JSON structure
    if ! jq empty "$discussion_file" 2>/dev/null; then
      echo "- **create-discussion**: Invalid JSON format in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    TITLE=$(jq -r '.title' "$discussion_file")
    BODY=$(jq -r '.body' "$discussion_file")
    CATEGORY=$(jq -r '.category' "$discussion_file")

    # Validate required fields
    if [ -z "$TITLE" ] || [ "$TITLE" = "null" ]; then
      echo "- **create-discussion**: title is required in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    elif [ -z "$BODY" ] || [ "$BODY" = "null" ]; then
      echo "- **create-discussion**: body is required in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    elif [ -z "$CATEGORY" ] || [ "$CATEGORY" = "null" ]; then
      echo "- **create-discussion**: category is required in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    elif [ \${#TITLE} -gt 256 ]; then
      echo "- **create-discussion**: title exceeds 256 characters in $discussion_file" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate category exists
    CATEGORY_ID=$(echo "$CATEGORIES_DATA" | jq -r --arg cat "$CATEGORY" '.[] | select(.name == $cat) | .id')

    if [ -z "$CATEGORY_ID" ] || [ "$CATEGORY_ID" = "null" ]; then
      echo "- **create-discussion**: Category '$CATEGORY' does not exist in repository (in $discussion_file)" >> /tmp/validation-errors/create-discussion.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $discussion_file"
  done

  # Phase 3: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-discussion validations passed - executing..."

    for discussion_file in $DISCUSSION_FILES; do
      TITLE=$(jq -r '.title' "$discussion_file")
      BODY=$(jq -r '.body' "$discussion_file")
      CATEGORY=$(jq -r '.category' "$discussion_file")

      # Append footer with workflow and job information
      FOOTER="\\n\\n---\\n\\n*Generated by workflow [\${{ github.workflow }}](\${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }})*"
      BODY_WITH_FOOTER="$BODY$FOOTER"

      # Get category ID
      CATEGORY_ID=$(echo "$CATEGORIES_DATA" | jq -r --arg cat "$CATEGORY" '.[] | select(.name == $cat) | .id')

      # Get repository ID (needed for GraphQL mutation)
      REPO_ID_QUERY='query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
        }
      }'

      REPO_ID=$(gh api graphql \\
        -f query="$REPO_ID_QUERY" \\
        -f owner="$REPO_OWNER" \\
        -f repo="$REPO_NAME" \\
        --jq '.data.repository.id' 2>/dev/null)

      # Create discussion via GraphQL API
      CREATE_MUTATION='mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
          discussion {
            url
          }
        }
      }'

      RESULT=$(gh api graphql \\
        -f query="$CREATE_MUTATION" \\
        -f repositoryId="$REPO_ID" \\
        -f categoryId="$CATEGORY_ID" \\
        -f title="$TITLE" \\
        -f body="$BODY_WITH_FOOTER" 2>/dev/null || echo "")

      if [ -n "$RESULT" ]; then
        DISCUSSION_URL=$(echo "$RESULT" | jq -r '.data.createDiscussion.discussion.url')
        echo "✓ Created discussion: $DISCUSSION_URL"
      else
        echo "- **create-discussion**: Failed to create discussion from $discussion_file via GitHub API" >> /tmp/validation-errors/create-discussion.txt
      fi
    done
  else
    echo "✗ create-discussion validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

// Register the handler
export const handler = new CreateDiscussionHandler();

export default handler;
