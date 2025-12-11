import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';
import { registry } from './index';

class AddCommentHandler implements OutputHandler {
  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for add-comment
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || 'unlimited';

    return `## Skill: Add Comment

Add a comment to the current issue or pull request.

**File to create**: \`/tmp/outputs/add-comment.json\`

**JSON Schema**:
\`\`\`json
{
  "body": "string"
}
\`\`\`

**Fields**:
- \`body\` (required): Markdown-formatted comment text

**Constraints**:
- Maximum comments: ${maxConstraint}
- Body must be non-empty

**Example**:
Create \`/tmp/outputs/add-comment.json\` with:
\`\`\`json
{
  "body": "Thank you for reporting this issue! I've analyzed it and added appropriate labels."
}
\`\`\`

**Important**: Use the Write tool to create this file. Only create the file when you're ready to post the comment.`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    const issueOrPrNumber = runtime.issueNumber || runtime.prNumber;

    return `
# Validate and execute add-comment output
if [ -f "/tmp/outputs/add-comment.json" ]; then
  echo "Validating add-comment output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/add-comment.json 2>/dev/null; then
    echo "- **add-comment**: Invalid JSON format" > /tmp/validation-errors/add-comment.txt
  else
    # Extract body
    COMMENT_BODY=$(jq -r '.body' /tmp/outputs/add-comment.json)

    # Validate body is non-empty
    if [ -z "$COMMENT_BODY" ] || [ "$COMMENT_BODY" = "null" ]; then
      echo "- **add-comment**: Comment body is empty or missing" > /tmp/validation-errors/add-comment.txt
    elif [ \${#COMMENT_BODY} -gt 65536 ]; then
      echo "- **add-comment**: Comment body exceeds 65536 characters" > /tmp/validation-errors/add-comment.txt
    else
      # Validation passed - execute
      echo "✓ add-comment validation passed"

      # Check if we have an issue/PR number
      ISSUE_NUMBER="${issueOrPrNumber}"
      if [ -z "$ISSUE_NUMBER" ]; then
        echo "- **add-comment**: No issue or PR number available" > /tmp/validation-errors/add-comment.txt
      else
        # Add comment via GitHub API
        gh api "repos/${runtime.repository}/issues/$ISSUE_NUMBER/comments" \\
          -f body="$COMMENT_BODY" || {
          echo "- **add-comment**: Failed to post comment via GitHub API" > /tmp/validation-errors/add-comment.txt
        }
      fi
    fi
  fi
fi
`;
  }
}

// Register the handler
const handler = new AddCommentHandler();
registry.register('add-comment', handler);

export default handler;
