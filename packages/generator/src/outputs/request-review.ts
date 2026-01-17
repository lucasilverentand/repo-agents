import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class RequestReviewHandler implements OutputHandler {
  name = "request-review";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for request-review
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Request Review

Request reviewers for a pull request.

**File to create**: \`/tmp/outputs/request-review.json\`

For multiple review requests, use numbered suffixes: \`request-review-1.json\`, \`request-review-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "pr_number": number,
  "reviewers": ["string"],
  "team_reviewers": ["string"]
}
\`\`\`

**Fields**:
- \`pr_number\` (required): Pull request number
- \`reviewers\` (optional): Array of GitHub usernames to request review from
- \`team_reviewers\` (optional): Array of team slugs to request review from (e.g., "team-name")

**Constraints**:
- Maximum review requests: ${maxConstraint}
- At least one of \`reviewers\` or \`team_reviewers\` must be specified
- Maximum 15 total reviewers per PR (GitHub limit)

**Example**:
Create \`/tmp/outputs/request-review.json\` with:
\`\`\`json
{
  "pr_number": 123,
  "reviewers": ["user1", "user2"],
  "team_reviewers": ["core-team"]
}
\`\`\`

**Important**: Use the Write tool to create this file. Reviewers must have repository access.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute request-review output(s)
REVIEW_FILES=$(find /tmp/outputs -name "request-review*.json" 2>/dev/null || true)

if [ -n "$REVIEW_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$REVIEW_FILES" | wc -l)
  echo "Found $FILE_COUNT request-review output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **request-review**: Too many review request files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/request-review.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for review_file in $REVIEW_FILES; do
    echo "Validating $review_file..."

    # Validate JSON structure
    if ! jq empty "$review_file" 2>/dev/null; then
      echo "- **request-review**: Invalid JSON format in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    PR_NUMBER=$(jq -r '.pr_number' "$review_file")
    REVIEWERS=$(jq -r '.reviewers // []' "$review_file")
    TEAM_REVIEWERS=$(jq -r '.team_reviewers // []' "$review_file")

    # Validate PR number
    if [ -z "$PR_NUMBER" ] || [ "$PR_NUMBER" = "null" ]; then
      echo "- **request-review**: pr_number is required in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    elif ! echo "$PR_NUMBER" | grep -qE '^[0-9]+$'; then
      echo "- **request-review**: pr_number must be a number in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Validate reviewers arrays
    if ! echo "$REVIEWERS" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **request-review**: reviewers must be an array in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    fi

    if ! echo "$TEAM_REVIEWERS" | jq -e 'type == "array"' >/dev/null 2>&1; then
      echo "- **request-review**: team_reviewers must be an array in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Check at least one reviewer is specified
    REVIEWER_COUNT=$(echo "$REVIEWERS" | jq 'length')
    TEAM_REVIEWER_COUNT=$(echo "$TEAM_REVIEWERS" | jq 'length')
    TOTAL_REVIEWERS=$((REVIEWER_COUNT + TEAM_REVIEWER_COUNT))

    if [ "$TOTAL_REVIEWERS" -eq 0 ]; then
      echo "- **request-review**: At least one reviewer or team_reviewer must be specified in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    elif [ "$TOTAL_REVIEWERS" -gt 15 ]; then
      echo "- **request-review**: Maximum 15 total reviewers allowed (found $TOTAL_REVIEWERS) in $review_file" >> /tmp/validation-errors/request-review.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $review_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All request-review validations passed - executing..."
    for review_file in $REVIEW_FILES; do
      PR_NUMBER=$(jq -r '.pr_number' "$review_file")

      # Build API request body
      REQUEST_BODY=$(jq -c '{reviewers: (.reviewers // []), team_reviewers: (.team_reviewers // [])}' "$review_file")

      # Request reviewers via GitHub API
      gh api "repos/${runtime.repository}/pulls/$PR_NUMBER/requested_reviewers" \\
        -X POST \\
        --input - <<< "$REQUEST_BODY" || {
        echo "- **request-review**: Failed to request reviewers for PR #$PR_NUMBER" >> /tmp/validation-errors/request-review.txt
      }
    done
  else
    echo "✗ request-review validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new RequestReviewHandler();
