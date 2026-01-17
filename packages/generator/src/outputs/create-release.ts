import type { OutputConfig } from "@repo-agents/types";
import type { OutputHandler, RuntimeContext } from "./base";

class CreateReleaseHandler implements OutputHandler {
  name = "create-release";

  getContextScript(_runtime: RuntimeContext): string | null {
    // No dynamic context needed for create-release
    return null;
  }

  generateSkill(config: OutputConfig): string {
    const maxConstraint = config.max || "unlimited";

    return `## Skill: Create Release

Create a GitHub release.

**File to create**: \`/tmp/outputs/create-release.json\`

For multiple releases, use numbered suffixes: \`create-release-1.json\`, \`create-release-2.json\`, etc.

**JSON Schema**:
\`\`\`json
{
  "tag_name": "string",
  "name": "string",
  "body": "string",
  "draft": boolean,
  "prerelease": boolean,
  "generate_release_notes": boolean,
  "target_commitish": "string"
}
\`\`\`

**Fields**:
- \`tag_name\` (required): Git tag for the release (e.g., "v1.2.3")
- \`name\` (optional): Release title (defaults to tag_name)
- \`body\` (optional): Release description/notes
- \`draft\` (optional): Create as draft (default: false)
- \`prerelease\` (optional): Mark as prerelease (default: false)
- \`generate_release_notes\` (optional): Auto-generate release notes (default: false)
- \`target_commitish\` (optional): Branch/commit to tag (default: main)

**Constraints**:
- Maximum releases: ${maxConstraint}
- Tag must not already exist (unless it's a draft update)

**Example**:
Create \`/tmp/outputs/create-release.json\` with:
\`\`\`json
{
  "tag_name": "v1.2.3",
  "name": "Release v1.2.3",
  "body": "## What's Changed\\n- Feature A\\n- Bug fix B",
  "draft": false,
  "prerelease": false,
  "generate_release_notes": true,
  "target_commitish": "main"
}
\`\`\`

**Important**: Use the Write tool to create this file. The release will be created immediately unless draft is true.`;
  }

  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string {
    const maxConstraint = config.max;

    return `
# Validate and execute create-release output(s)
RELEASE_FILES=$(find /tmp/outputs -name "create-release*.json" 2>/dev/null || true)

if [ -n "$RELEASE_FILES" ]; then
  # Count files
  FILE_COUNT=$(echo "$RELEASE_FILES" | wc -l)
  echo "Found $FILE_COUNT create-release output file(s)"

  # Check max constraint
  ${
    maxConstraint
      ? `
  if [ "$FILE_COUNT" -gt ${maxConstraint} ]; then
    echo "- **create-release**: Too many release files ($FILE_COUNT). Maximum allowed: ${maxConstraint}" > /tmp/validation-errors/create-release.txt
    exit 0
  fi`
      : ""
  }

  # Phase 1: Validate all files
  VALIDATION_FAILED=false
  for release_file in $RELEASE_FILES; do
    echo "Validating $release_file..."

    # Validate JSON structure
    if ! jq empty "$release_file" 2>/dev/null; then
      echo "- **create-release**: Invalid JSON format in $release_file" >> /tmp/validation-errors/create-release.txt
      VALIDATION_FAILED=true
      continue
    fi

    # Extract fields
    TAG_NAME=$(jq -r '.tag_name' "$release_file")

    # Validate required fields
    if [ -z "$TAG_NAME" ] || [ "$TAG_NAME" = "null" ]; then
      echo "- **create-release**: tag_name is required in $release_file" >> /tmp/validation-errors/create-release.txt
      VALIDATION_FAILED=true
      continue
    fi

    echo "✓ Validation passed for $release_file"
  done

  # Phase 2: Execute only if all validations passed
  if [ "$VALIDATION_FAILED" = false ]; then
    echo "✓ All create-release validations passed - executing..."
    for release_file in $RELEASE_FILES; do
      TAG_NAME=$(jq -r '.tag_name' "$release_file")
      NAME=$(jq -r '.name // .tag_name' "$release_file")
      BODY=$(jq -r '.body // ""' "$release_file")
      DRAFT=$(jq -r '.draft // false' "$release_file")
      PRERELEASE=$(jq -r '.prerelease // false' "$release_file")
      GENERATE_NOTES=$(jq -r '.generate_release_notes // false' "$release_file")
      TARGET=$(jq -r '.target_commitish // "main"' "$release_file")

      # Build gh release create command
      GH_OPTS="--title "$NAME" --target "$TARGET""

      if [ "$DRAFT" = "true" ]; then
        GH_OPTS="$GH_OPTS --draft"
      fi

      if [ "$PRERELEASE" = "true" ]; then
        GH_OPTS="$GH_OPTS --prerelease"
      fi

      if [ "$GENERATE_NOTES" = "true" ]; then
        GH_OPTS="$GH_OPTS --generate-notes"
      fi

      if [ -n "$BODY" ] && [ "$BODY" != "null" ]; then
        GH_OPTS="$GH_OPTS --notes "$BODY""
      fi

      # Create release via gh CLI
      eval gh release create "$TAG_NAME" $GH_OPTS || {
        echo "- **create-release**: Failed to create release $TAG_NAME" >> /tmp/validation-errors/create-release.txt
      }
    done
  else
    echo "✗ create-release validation failed - skipping execution (atomic operation)"
  fi
fi
`;
  }
}

export const handler = new CreateReleaseHandler();
