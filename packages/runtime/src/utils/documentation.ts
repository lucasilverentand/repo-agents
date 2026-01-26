import type {
  ApiDocumentationConfig,
  ChangelogConfig,
  DocumentationConfig,
  DriftDetectionConfig,
  DriftDetectionPair,
} from "@repo-agents/types";

/**
 * Result of documentation generation or analysis
 */
export interface DocumentationResult {
  success: boolean;
  files_updated: string[];
  files_created: string[];
  errors: string[];
  drift_detected?: DriftReport[];
}

/**
 * Report of documentation drift
 */
export interface DriftReport {
  code_file: string;
  doc_file: string;
  code_last_modified: string;
  doc_last_modified: string;
  days_since_code_change: number;
  threshold: number;
  message: string;
}

/**
 * Extracted API documentation entry
 */
export interface ApiDocEntry {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "constant";
  description?: string;
  parameters?: ApiDocParameter[];
  returns?: string;
  examples?: string[];
  tags?: Record<string, string>;
  file: string;
  line: number;
}

/**
 * API documentation parameter
 */
export interface ApiDocParameter {
  name: string;
  type: string;
  description?: string;
  optional?: boolean;
  default?: string;
}

/**
 * Changelog entry
 */
export interface ChangelogEntry {
  version?: string;
  date: string;
  category: "Added" | "Changed" | "Deprecated" | "Removed" | "Fixed" | "Security";
  description: string;
  pr_number?: number;
  commit_sha?: string;
  author?: string;
}

/**
 * Generate shell script for extracting API documentation from source files.
 */
export function generateApiDocExtractionScript(config: ApiDocumentationConfig): string {
  const sources = config.sources.join(" ");
  const includePrivate = config.include_private ? "true" : "false";
  const includeInternal = config.include_internal ? "true" : "false";

  return `
# API Documentation Extraction
# Sources: ${sources}
# Output: ${config.output}
# Format: ${config.format || "markdown"}

mkdir -p "${config.output}"

API_DOCS_JSON=""
API_ENTRY_COUNT=0

# Process each source pattern
for pattern in ${sources}; do
  for file in $pattern; do
    if [ -f "$file" ]; then
      # Extract JSDoc/TSDoc comments and function signatures
      FILE_CONTENT=$(cat "$file")

      # Simple extraction of exported functions and interfaces
      # In production, would use a proper parser like ts-morph

      while IFS= read -r line; do
        # Match export function/const/interface/class/type
        if echo "$line" | grep -qE "^export (function|const|interface|class|type)"; then
          NAME=$(echo "$line" | sed -E 's/^export (function|const|interface|class|type) ([a-zA-Z_][a-zA-Z0-9_]*).*/\\2/')
          TYPE=$(echo "$line" | sed -E 's/^export (function|const|interface|class|type).*/\\1/')

          # Skip private members unless configured
          if [ "${includePrivate}" = "false" ] && echo "$NAME" | grep -qE "^_"; then
            continue
          fi

          # Skip @internal members unless configured
          if [ "${includeInternal}" = "false" ]; then
            # Check previous lines for @internal tag
            PREV_LINES=$(head -$(($(grep -n "$line" "$file" | head -1 | cut -d: -f1) - 1)) "$file" | tail -5)
            if echo "$PREV_LINES" | grep -qE "@internal"; then
              continue
            fi
          fi

          API_ENTRY_COUNT=$((API_ENTRY_COUNT + 1))
          echo "Found: $TYPE $NAME in $file"
        fi
      done < "$file"
    fi
  done
done

echo "Total API entries found: $API_ENTRY_COUNT"
echo "API_DOC_ENTRIES=$API_ENTRY_COUNT" >> "$GITHUB_OUTPUT"
`;
}

/**
 * Generate shell script for checking documentation drift.
 */
export function generateDriftDetectionScript(config: DriftDetectionConfig): string {
  if (!config.enabled || config.pairs.length === 0) {
    return "echo 'Drift detection disabled'";
  }

  const pairChecks = config.pairs
    .map((pair, index) => generateDriftCheckForPair(pair, index))
    .join("\n\n");

  return `
# Documentation Drift Detection
DRIFT_DETECTED=false
DRIFT_REPORTS=""

${pairChecks}

if [ "$DRIFT_DETECTED" = "true" ]; then
  echo "Documentation drift detected!"
  echo "DRIFT_DETECTED=true" >> "$GITHUB_OUTPUT"
  echo "DRIFT_REPORTS<<EOF" >> "$GITHUB_OUTPUT"
  echo "$DRIFT_REPORTS" >> "$GITHUB_OUTPUT"
  echo "EOF" >> "$GITHUB_OUTPUT"
else
  echo "No documentation drift detected"
  echo "DRIFT_DETECTED=false" >> "$GITHUB_OUTPUT"
fi
`;
}

function generateDriftCheckForPair(pair: DriftDetectionPair, index: number): string {
  const threshold = pair.threshold || 7;

  return `
# Drift check pair ${index + 1}: ${pair.code} -> ${pair.docs}
echo "Checking drift: ${pair.code} -> ${pair.docs}"

NEWEST_CODE_FILE=""
NEWEST_CODE_TIME=0

for code_file in ${pair.code}; do
  if [ -f "$code_file" ]; then
    # Get file modification time (works on Linux and macOS)
    if [ "$(uname)" = "Darwin" ]; then
      FILE_TIME=$(stat -f %m "$code_file" 2>/dev/null || echo "0")
    else
      FILE_TIME=$(stat -c %Y "$code_file" 2>/dev/null || echo "0")
    fi

    if [ "$FILE_TIME" -gt "$NEWEST_CODE_TIME" ]; then
      NEWEST_CODE_TIME=$FILE_TIME
      NEWEST_CODE_FILE=$code_file
    fi
  fi
done

NEWEST_DOC_FILE=""
NEWEST_DOC_TIME=0

for doc_file in ${pair.docs}; do
  if [ -f "$doc_file" ]; then
    if [ "$(uname)" = "Darwin" ]; then
      FILE_TIME=$(stat -f %m "$doc_file" 2>/dev/null || echo "0")
    else
      FILE_TIME=$(stat -c %Y "$doc_file" 2>/dev/null || echo "0")
    fi

    if [ "$FILE_TIME" -gt "$NEWEST_DOC_TIME" ]; then
      NEWEST_DOC_TIME=$FILE_TIME
      NEWEST_DOC_FILE=$doc_file
    fi
  fi
done

if [ -n "$NEWEST_CODE_FILE" ] && [ -n "$NEWEST_DOC_FILE" ]; then
  CURRENT_TIME=$(date +%s)
  CODE_AGE_DAYS=$(( (CURRENT_TIME - NEWEST_CODE_TIME) / 86400 ))
  DOC_AGE_DAYS=$(( (CURRENT_TIME - NEWEST_DOC_TIME) / 86400 ))

  # Check if docs are older than code by more than threshold
  if [ "$NEWEST_CODE_TIME" -gt "$NEWEST_DOC_TIME" ]; then
    DRIFT_DAYS=$(( (NEWEST_CODE_TIME - NEWEST_DOC_TIME) / 86400 ))
    if [ "$DRIFT_DAYS" -gt "${threshold}" ]; then
      DRIFT_DETECTED=true
      DRIFT_MSG="Code '$NEWEST_CODE_FILE' updated $DRIFT_DAYS days after docs '$NEWEST_DOC_FILE' (threshold: ${threshold} days)"
      echo "DRIFT: $DRIFT_MSG"
      DRIFT_REPORTS="$DRIFT_REPORTS
- $DRIFT_MSG"
    fi
  fi
fi
`;
}

/**
 * Generate shell script for changelog generation from PRs and commits.
 */
export function generateChangelogScript(config: ChangelogConfig, since?: string): string {
  const format = config.format || "keep-a-changelog";
  const includePRs = config.include_prs !== false;
  const includeCommits = config.include_commits === true;
  const excludeLabels = config.exclude_labels || [];
  const changelogPath = config.path || "CHANGELOG.md";

  const excludeLabelsFilter =
    excludeLabels.length > 0 ? excludeLabels.map((l) => `-label:-${l}`).join(" ") : "";

  return `
# Changelog Generation
# Format: ${format}
# Path: ${changelogPath}

CHANGELOG_ENTRIES=""
TODAY=$(date +%Y-%m-%d)

${
  includePRs
    ? `
# Fetch merged PRs since last release
echo "Fetching merged PRs..."
MERGED_PRS=$(gh pr list --state merged --json number,title,labels,author,body ${since ? `--search "merged:>${since}"` : ""} ${excludeLabelsFilter} --limit 100)

# Process PRs into changelog entries
for row in $(echo "$MERGED_PRS" | jq -c '.[]'); do
  PR_NUMBER=$(echo "$row" | jq -r '.number')
  PR_TITLE=$(echo "$row" | jq -r '.title')
  PR_AUTHOR=$(echo "$row" | jq -r '.author.login')

  # Detect category from PR title prefix
  CATEGORY="Changed"
  if echo "$PR_TITLE" | grep -qiE "^(feat|add|new):"; then
    CATEGORY="Added"
  elif echo "$PR_TITLE" | grep -qiE "^(fix|bug):"; then
    CATEGORY="Fixed"
  elif echo "$PR_TITLE" | grep -qiE "^(deprecat):"; then
    CATEGORY="Deprecated"
  elif echo "$PR_TITLE" | grep -qiE "^(remove|delete):"; then
    CATEGORY="Removed"
  elif echo "$PR_TITLE" | grep -qiE "^(security|vuln):"; then
    CATEGORY="Security"
  fi

  CHANGELOG_ENTRIES="$CHANGELOG_ENTRIES
### $CATEGORY
- $PR_TITLE (#$PR_NUMBER) @$PR_AUTHOR"
done
`
    : ""
}

${
  includeCommits
    ? `
# Fetch commits since last release
echo "Fetching commits..."
COMMITS=$(git log --oneline ${since ? `--since="${since}"` : ""} --format="%h %s (%an)")

for commit in $COMMITS; do
  SHA=$(echo "$commit" | cut -d' ' -f1)
  MESSAGE=$(echo "$commit" | cut -d' ' -f2-)

  CHANGELOG_ENTRIES="$CHANGELOG_ENTRIES
- $MESSAGE ($SHA)"
done
`
    : ""
}

# Output changelog entries
echo "CHANGELOG_ENTRIES<<EOF" >> "$GITHUB_OUTPUT"
echo "$CHANGELOG_ENTRIES" >> "$GITHUB_OUTPUT"
echo "EOF" >> "$GITHUB_OUTPUT"
`;
}

/**
 * Generate markdown content for README section updating.
 */
export function generateReadmeSectionContent(section: string, source?: string): string {
  switch (section.toLowerCase()) {
    case "installation":
      return `
# Read from package.json
if [ -f "package.json" ]; then
  PKG_NAME=$(jq -r '.name' package.json)
  PKG_MANAGER="npm"

  # Detect package manager from lockfiles
  if [ -f "bun.lockb" ]; then
    PKG_MANAGER="bun add"
  elif [ -f "pnpm-lock.yaml" ]; then
    PKG_MANAGER="pnpm add"
  elif [ -f "yarn.lock" ]; then
    PKG_MANAGER="yarn add"
  else
    PKG_MANAGER="npm install"
  fi

  echo "## Installation"
  echo ""
  echo "\\\`\\\`\\\`bash"
  echo "$PKG_MANAGER $PKG_NAME"
  echo "\\\`\\\`\\\`"
fi
`;

    case "usage":
      return `
# Generate usage from examples directory
if [ -d "examples" ] || [ -d "${source || "examples"}" ]; then
  EXAMPLES_DIR="${source || "examples"}"
  echo "## Usage"
  echo ""
  for example in "$EXAMPLES_DIR"/*.{js,ts,md}; do
    if [ -f "$example" ]; then
      EXAMPLE_NAME=$(basename "$example" | sed 's/\\.[^.]*$//')
      echo "### $EXAMPLE_NAME"
      echo ""
      echo "\\\`\\\`\\\`$(basename "$example" | sed 's/.*\\.//')"
      head -50 "$example"
      echo "\\\`\\\`\\\`"
      echo ""
    fi
  done
fi
`;

    case "api":
      return `
# Generate API section from JSDoc
echo "## API"
echo ""
echo "See [API Documentation](./docs/api/README.md) for detailed API reference."
`;

    case "license":
      return `
# Read license from LICENSE file
if [ -f "LICENSE" ]; then
  LICENSE_TYPE=$(head -1 LICENSE | grep -oE "(MIT|Apache|GPL|BSD|ISC)" || echo "See LICENSE file")
  echo "## License"
  echo ""
  echo "$LICENSE_TYPE - See [LICENSE](./LICENSE) for details."
fi
`;

    default:
      return `echo "Unknown section: ${section}"`;
  }
}

/**
 * Format changelog entries in keep-a-changelog format.
 */
export function formatKeepAChangelog(
  entries: ChangelogEntry[],
  version?: string,
  date?: string,
): string {
  const categories = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"] as const;
  const grouped: Record<string, ChangelogEntry[]> = {};

  for (const entry of entries) {
    if (!grouped[entry.category]) {
      grouped[entry.category] = [];
    }
    grouped[entry.category].push(entry);
  }

  let output = `## [${version || "Unreleased"}]`;
  if (date) {
    output += ` - ${date}`;
  }
  output += "\n\n";

  for (const category of categories) {
    const categoryEntries = grouped[category];
    if (categoryEntries && categoryEntries.length > 0) {
      output += `### ${category}\n\n`;
      for (const entry of categoryEntries) {
        output += `- ${entry.description}`;
        if (entry.pr_number) {
          output += ` (#${entry.pr_number})`;
        }
        if (entry.author) {
          output += ` @${entry.author}`;
        }
        output += "\n";
      }
      output += "\n";
    }
  }

  return output;
}

/**
 * Generate comprehensive documentation context for an agent.
 */
export function generateDocumentationContext(config: DocumentationConfig): string {
  const sections: string[] = [];

  sections.push("# Documentation Context\n");

  if (config.api) {
    sections.push("## API Documentation Config");
    sections.push(`- Sources: ${config.api.sources.join(", ")}`);
    sections.push(`- Output: ${config.api.output}`);
    sections.push(`- Format: ${config.api.format || "markdown"}`);
    sections.push("");
  }

  if (config.readme) {
    sections.push("## README Maintenance Config");
    sections.push(`- Path: ${config.readme.path || "README.md"}`);
    sections.push(`- Sections: ${config.readme.sections.map((s) => s.section).join(", ")}`);
    sections.push("");
  }

  if (config.changelog) {
    sections.push("## Changelog Config");
    sections.push(`- Path: ${config.changelog.path || "CHANGELOG.md"}`);
    sections.push(`- Format: ${config.changelog.format || "keep-a-changelog"}`);
    sections.push(`- Include PRs: ${config.changelog.include_prs !== false}`);
    sections.push(`- Include Commits: ${config.changelog.include_commits === true}`);
    sections.push("");
  }

  if (config.drift_detection) {
    sections.push("## Drift Detection Config");
    sections.push(`- Enabled: ${config.drift_detection.enabled}`);
    sections.push(`- Pairs: ${config.drift_detection.pairs.length}`);
    for (const pair of config.drift_detection.pairs) {
      sections.push(`  - ${pair.code} -> ${pair.docs} (threshold: ${pair.threshold || 7} days)`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

/**
 * Check if a file has been modified since a given date.
 */
export function checkFileModifiedSince(filePath: string, since: Date): string {
  const sinceTimestamp = Math.floor(since.getTime() / 1000);
  return `
# Check if ${filePath} was modified since ${since.toISOString()}
if [ -f "${filePath}" ]; then
  if [ "$(uname)" = "Darwin" ]; then
    FILE_TIME=$(stat -f %m "${filePath}" 2>/dev/null || echo "0")
  else
    FILE_TIME=$(stat -c %Y "${filePath}" 2>/dev/null || echo "0")
  fi

  if [ "$FILE_TIME" -gt "${sinceTimestamp}" ]; then
    echo "true"
  else
    echo "false"
  fi
else
  echo "false"
fi
`;
}
