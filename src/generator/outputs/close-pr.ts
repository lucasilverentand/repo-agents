import type { OutputConfig } from '../../types/index';
import type { OutputHandler, RuntimeContext } from './base';

class ClosePRHandler implements OutputHandler {
  name = 'close-pr' as const;

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for close-pr
    return null;
  }

  generateSkill(_config: OutputConfig): string {
    return `## Skill: Close Pull Request

Close the current pull request without merging.

**File to create**: \`/tmp/outputs/close-pr.json\`

**JSON Schema**:
\`\`\`json
{
  "merge": false
}
\`\`\`

**Fields**:
- \`merge\` (optional): Set to true to merge instead of just closing. Defaults to false.

**Example**:
Create \`/tmp/outputs/close-pr.json\` with:
\`\`\`json
{
  "merge": false
}
\`\`\`

**Important**:
- Use this sparingly - only close PRs when you're certain they should be closed
- Consider adding a comment explaining why before closing
- Set merge: true only if the PR should be merged
- Use the Write tool to create this file`;
  }

  generateValidationScript(_config: OutputConfig, runtime: RuntimeContext): string {
    return `
# Validate and execute close-pr output
if [ -f "/tmp/outputs/close-pr.json" ]; then
  echo "Validating close-pr output..."

  # Validate JSON structure
  if ! jq empty /tmp/outputs/close-pr.json 2>/dev/null; then
    echo "- **close-pr**: Invalid JSON format" > /tmp/validation-errors/close-pr.txt
  else
    # Extract merge flag (optional, defaults to false)
    SHOULD_MERGE=$(jq -r '.merge // false' /tmp/outputs/close-pr.json)

    # Validation passed - execute
    echo "✓ close-pr validation passed"

    # Check if we have a PR number
    PR_NUMBER="${runtime.prNumber || ''}"
    if [ -z "$PR_NUMBER" ]; then
      echo "- **close-pr**: No pull request number available" > /tmp/validation-errors/close-pr.txt
    else
      if [ "$SHOULD_MERGE" = "true" ]; then
        # Merge the PR
        gh api "repos/${runtime.repository}/pulls/$PR_NUMBER/merge" \\
          -X PUT || {
          echo "- **close-pr**: Failed to merge pull request via GitHub API" > /tmp/validation-errors/close-pr.txt
        }
      else
        # Close the PR without merging
        gh api "repos/${runtime.repository}/pulls/$PR_NUMBER" \\
          -X PATCH \\
          -f state="closed" || {
          echo "- **close-pr**: Failed to close pull request via GitHub API" > /tmp/validation-errors/close-pr.txt
        }
      fi
    fi
  fi
fi
`;
  }
}

// Register the handler
export const handler = new ClosePRHandler();

export default handler;
