import type {
  InputConfig,
  IssuesInputConfig,
  PullRequestsInputConfig,
  DiscussionsInputConfig,
  CommitsInputConfig,
  ReleasesInputConfig,
  WorkflowRunsInputConfig,
} from '../types';

export class InputCollector {
  /**
   * Generates a bash script that collects inputs from GitHub
   * Returns empty result if no data found (to prevent agent execution)
   */
  generateCollectionScript(config: InputConfig): string {
    const since = config.since || 'last-run';
    const minItems = config.min_items ?? 1;

    const scriptParts: string[] = [
      '#!/bin/bash',
      'set -e',
      '',
      '# Input Collection Script',
      '# Collects configured inputs from GitHub and formats them for Claude',
      '',
      'COLLECTED_DATA=""',
      'TOTAL_ITEMS=0',
      '',
      '# Determine time filter',
      this.generateTimeFilterScript(since),
      '',
    ];

    // Add collection for each configured input type
    if (config.issues) {
      scriptParts.push(this.generateIssuesScript(config.issues));
      scriptParts.push('');
    }

    if (config.pull_requests) {
      scriptParts.push(this.generatePullRequestsScript(config.pull_requests));
      scriptParts.push('');
    }

    if (config.discussions) {
      scriptParts.push(this.generateDiscussionsScript(config.discussions));
      scriptParts.push('');
    }

    if (config.commits) {
      scriptParts.push(this.generateCommitsScript(config.commits));
      scriptParts.push('');
    }

    if (config.releases) {
      scriptParts.push(this.generateReleasesScript(config.releases));
      scriptParts.push('');
    }

    if (config.workflow_runs) {
      scriptParts.push(this.generateWorkflowRunsScript(config.workflow_runs));
      scriptParts.push('');
    }

    if (config.stars) {
      scriptParts.push(this.generateStarsScript());
      scriptParts.push('');
    }

    if (config.forks) {
      scriptParts.push(this.generateForksScript());
      scriptParts.push('');
    }

    // Check minimum items threshold
    scriptParts.push(`# Check if we have minimum items`);
    scriptParts.push(`if [ "$TOTAL_ITEMS" -lt "${minItems}" ]; then`);
    scriptParts.push(
      `  echo "⚠️  Only found $TOTAL_ITEMS items (minimum: ${minItems}). Skipping agent execution."`
    );
    scriptParts.push(`  echo "has-inputs=false" >> $GITHUB_OUTPUT`);
    scriptParts.push(`  exit 0`);
    scriptParts.push(`fi`);
    scriptParts.push(``);
    scriptParts.push(`echo "✓ Collected $TOTAL_ITEMS items"`);
    scriptParts.push(`echo "has-inputs=true" >> $GITHUB_OUTPUT`);
    scriptParts.push(``);
    scriptParts.push(`# Save collected data to file for next job`);
    scriptParts.push(`echo "$COLLECTED_DATA" > /tmp/inputs.md`);
    scriptParts.push(``);
    scriptParts.push(`# Output as GitHub output (truncated if too long)`);
    scriptParts.push(`TRUNCATED_DATA=$(echo "$COLLECTED_DATA" | head -c 100000)`);
    scriptParts.push(`echo "inputs-data<<EOF" >> $GITHUB_OUTPUT`);
    scriptParts.push(`echo "$TRUNCATED_DATA" >> $GITHUB_OUTPUT`);
    scriptParts.push(`echo "EOF" >> $GITHUB_OUTPUT`);

    return scriptParts.join('\n');
  }

  /**
   * Normalizes state array to a single valid GitHub API state value.
   * GitHub API only accepts 'open', 'closed', or 'all' - not comma-separated values.
   */
  private normalizeState(states?: string[]): string {
    if (!states || states.length === 0) {
      return 'all';
    }
    if (states.includes('all')) {
      return 'all';
    }
    // If multiple states are requested, use 'all' and filter client-side if needed
    if (states.length > 1) {
      return 'all';
    }
    // For 'merged', we need to use 'closed' state and filter for merged_at
    if (states[0] === 'merged') {
      return 'closed';
    }
    return states[0];
  }

  private generateTimeFilterScript(since: string): string {
    return `# Calculate time filter based on 'since' configuration
if [ "${since}" = "last-run" ]; then
  # Get timestamp of last successful run
  # Note: Using repo-level runs endpoint and filtering by workflow name to avoid URL encoding issues
  LAST_RUN=$(gh api "repos/\${{ github.repository }}/actions/runs" \\
    --jq '[.workflow_runs[] | select(.name == "\${{ github.workflow }}" and .status == "completed" and .conclusion == "success")] | .[0].created_at' 2>/dev/null || echo "")

  if [ -n "$LAST_RUN" ]; then
    SINCE_DATE="$LAST_RUN"
    echo "ℹ️  Collecting data since last run: $SINCE_DATE"
  else
    # No previous run, default to 24 hours
    SINCE_DATE=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
    echo "ℹ️  No previous run found, collecting data from last 24 hours"
  fi
else
  # Parse time duration (e.g., "1h", "24h", "7d")
  DURATION="${since}"
  if [[ "$DURATION" =~ ^([0-9]+)h$ ]]; then
    HOURS="\${BASH_REMATCH[1]}"
    SINCE_DATE=$(date -u -d "$HOURS hours ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-\${HOURS}H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
  elif [[ "$DURATION" =~ ^([0-9]+)d$ ]]; then
    DAYS="\${BASH_REMATCH[1]}"
    SINCE_DATE=$(date -u -d "$DAYS days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-\${DAYS}d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
  else
    # Default to 24 hours if invalid format
    SINCE_DATE=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)
  fi
  echo "ℹ️  Collecting data since: $SINCE_DATE (duration: $DURATION)"
fi`;
  }

  private generateIssuesScript(config: IssuesInputConfig): string {
    const limit = config.limit || 100;
    // GitHub API only accepts 'open', 'closed', or 'all' - not comma-separated values
    const state = this.normalizeState(config.states);
    const labels = config.labels?.join(',') || '';
    const excludeLabels = config.exclude_labels?.join(',') || '';

    return `# Collect Issues
echo "## 📋 Issues" >> /tmp/issues_section.md
echo "" >> /tmp/issues_section.md

ISSUES_COUNT=0
ISSUES_JSON=$(gh api "repos/\${{ github.repository }}/issues?state=${state}&per_page=${limit}" \\
  --paginate \\
  --jq '[.[] | select(.pull_request == null and (.updated_at >= "'$SINCE_DATE'"))]' 2>/dev/null || echo "[]")

# Filter by labels if specified
${labels ? `ISSUES_JSON=$(echo "$ISSUES_JSON" | jq '[.[] | select((.labels | type) == "array" and (.labels | map(.name) | any(IN("${labels.split(',').join('","')}"))))]')` : ''}
${excludeLabels ? `ISSUES_JSON=$(echo "$ISSUES_JSON" | jq '[.[] | select((.labels | type) != "array" or (.labels | map(.name) | any(IN("${excludeLabels.split(',').join('","')}")) | not))]')` : ''}

ISSUES_COUNT=$(echo "$ISSUES_JSON" | jq 'length')
TOTAL_ITEMS=$((TOTAL_ITEMS + ISSUES_COUNT))

if [ "$ISSUES_COUNT" -gt 0 ]; then
  echo "Found $ISSUES_COUNT issue(s)"

  echo "$ISSUES_JSON" | jq -r '.[] |
    "### [#" + (.number|tostring) + "] " + .title + "\\n" +
    "**State:** " + .state + " | **Author:** @" + .user.login + " | **Updated:** " + .updated_at + "\\n" +
    "**Labels:** " + ([.labels[].name] | join(", ")) + "\\n" +
    "**URL:** " + .html_url + "\\n" +
    (if .body then "\\n" + .body + "\\n" else "" end) +
    "---\\n"
  ' >> /tmp/issues_section.md

  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/issues_section.md)"
else
  echo "No issues found"
fi`;
  }

  private generatePullRequestsScript(config: PullRequestsInputConfig): string {
    const limit = config.limit || 100;
    // GitHub API only accepts 'open', 'closed', or 'all' - not comma-separated values
    const state = this.normalizeState(config.states);
    const labels = config.labels?.join(',') || '';
    const excludeLabels = config.exclude_labels?.join(',') || '';

    return `# Collect Pull Requests
echo "## 🔀 Pull Requests" >> /tmp/prs_section.md
echo "" >> /tmp/prs_section.md

PRS_COUNT=0
PRS_JSON=$(gh api "repos/\${{ github.repository }}/pulls?state=${state}&per_page=${limit}" \\
  --paginate \\
  --jq '[.[] | select(.updated_at >= "'$SINCE_DATE'")]' 2>/dev/null || echo "[]")

# Filter by labels if specified
${labels ? `PRS_JSON=$(echo "$PRS_JSON" | jq '[.[] | select((.labels | type) == "array" and (.labels | map(.name) | any(IN("${labels.split(',').join('","')}"))))]')` : ''}
${excludeLabels ? `PRS_JSON=$(echo "$PRS_JSON" | jq '[.[] | select((.labels | type) != "array" or (.labels | map(.name) | any(IN("${excludeLabels.split(',').join('","')}")) | not))]')` : ''}

# Filter merged PRs if only merged is requested
${
  config.states?.length === 1 && config.states[0] === 'merged'
    ? `PRS_JSON=$(echo "$PRS_JSON" | jq '[.[] | select(.merged_at != null)]')`
    : ''
}

PRS_COUNT=$(echo "$PRS_JSON" | jq 'length')
TOTAL_ITEMS=$((TOTAL_ITEMS + PRS_COUNT))

if [ "$PRS_COUNT" -gt 0 ]; then
  echo "Found $PRS_COUNT pull request(s)"

  echo "$PRS_JSON" | jq -r '.[] |
    "### [#" + (.number|tostring) + "] " + .title + "\\n" +
    "**State:** " + .state + (if .merged_at then " (merged)" else "" end) + " | **Author:** @" + .user.login + " | **Updated:** " + .updated_at + "\\n" +
    "**Branch:** " + .head.ref + " → " + .base.ref + "\\n" +
    "**Labels:** " + ([.labels[].name] | join(", ")) + "\\n" +
    "**URL:** " + .html_url + "\\n" +
    (if .body then "\\n" + .body + "\\n" else "" end) +
    "---\\n"
  ' >> /tmp/prs_section.md

  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/prs_section.md)"
else
  echo "No pull requests found"
fi`;
  }

  private generateDiscussionsScript(config: DiscussionsInputConfig): string {
    const limit = config.limit || 100;
    const categories = config.categories?.map((c: string) => `"${c}"`).join(',') || '';

    return `# Collect Discussions
echo "## 💬 Discussions" >> /tmp/discussions_section.md
echo "" >> /tmp/discussions_section.md

DISCUSSIONS_COUNT=0

# Note: Discussions require GraphQL API
DISCUSSIONS_QUERY='query($owner: String!, $repo: String!, $limit: Int!) {
  repository(owner: $owner, name: $repo) {
    discussions(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        author { login }
        url
        createdAt
        updatedAt
        category { name }
        answer { isAnswer }
        labels(first: 10) { nodes { name } }
        body
      }
    }
  }
}'

OWNER=$(echo "\${{ github.repository }}" | cut -d'/' -f1)
REPO=$(echo "\${{ github.repository }}" | cut -d'/' -f2)

DISCUSSIONS_JSON=$(gh api graphql \\
  -f query="$DISCUSSIONS_QUERY" \\
  -f owner="$OWNER" \\
  -f repo="$REPO" \\
  -F limit="${limit}" \\
  --jq '.data.repository.discussions.nodes' 2>/dev/null || echo "[]")

# Filter by updated date
DISCUSSIONS_JSON=$(echo "$DISCUSSIONS_JSON" | jq '[.[] | select(.updatedAt >= "'$SINCE_DATE'")]')

${categories ? `# Filter by categories\nDISCUSSIONS_JSON=$(echo "$DISCUSSIONS_JSON" | jq '[.[] | select(.category.name | IN(${categories}))]')` : ''}
${config.answered ? `# Filter answered discussions\nDISCUSSIONS_JSON=$(echo "$DISCUSSIONS_JSON" | jq '[.[] | select(.answer.isAnswer == true)]')` : ''}
${config.unanswered ? `# Filter unanswered discussions\nDISCUSSIONS_JSON=$(echo "$DISCUSSIONS_JSON" | jq '[.[] | select(.answer.isAnswer != true)]')` : ''}

DISCUSSIONS_COUNT=$(echo "$DISCUSSIONS_JSON" | jq 'length')
TOTAL_ITEMS=$((TOTAL_ITEMS + DISCUSSIONS_COUNT))

if [ "$DISCUSSIONS_COUNT" -gt 0 ]; then
  echo "Found $DISCUSSIONS_COUNT discussion(s)"

  echo "$DISCUSSIONS_JSON" | jq -r '.[] |
    "### [#" + (.number|tostring) + "] " + .title + "\\n" +
    "**Category:** " + .category.name + " | **Author:** @" + .author.login + " | **Updated:** " + .updatedAt + "\\n" +
    (if .answer.isAnswer then "**Status:** Answered\\n" else "**Status:** Unanswered\\n" end) +
    "**URL:** " + .url + "\\n" +
    (if .body then "\\n" + .body + "\\n" else "" end) +
    "---\\n"
  ' >> /tmp/discussions_section.md

  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/discussions_section.md)"
else
  echo "No discussions found"
fi`;
  }

  private generateCommitsScript(config: CommitsInputConfig): string {
    const branches = config.branches || ['main', 'master'];
    const limit = config.limit || 100;

    return `# Collect Commits
echo "## 📝 Commits" >> /tmp/commits_section.md
echo "" >> /tmp/commits_section.md

COMMITS_COUNT=0
BRANCHES=(${branches.map((b: string) => `"${b}"`).join(' ')})

for BRANCH in "\${BRANCHES[@]}"; do
  # Check if branch exists
  if ! gh api "repos/\${{ github.repository }}/branches/$BRANCH" >/dev/null 2>&1; then
    continue
  fi

  BRANCH_COMMITS=$(gh api "repos/\${{ github.repository }}/commits" \\
    -f sha="$BRANCH" \\
    -f since="$SINCE_DATE" \\
    -f per_page="${limit}" \\
    --jq '.[] | {
      sha: .sha[0:7],
      message: .commit.message | split("\\n")[0],
      author: .commit.author.name,
      date: .commit.author.date,
      url: .html_url
    }' 2>/dev/null || echo "")

  if [ -n "$BRANCH_COMMITS" ]; then
    echo "Found commits on branch: $BRANCH"
    echo "$BRANCH_COMMITS" | jq -r '
      "- [\`" + .sha + "\`](" + .url + ") " + .message + " - @" + .author + " (" + .date + ")\\n"
    ' >> /tmp/commits_section.md

    BRANCH_COUNT=$(echo "$BRANCH_COMMITS" | jq -s 'length')
    COMMITS_COUNT=$((COMMITS_COUNT + BRANCH_COUNT))
  fi
done

TOTAL_ITEMS=$((TOTAL_ITEMS + COMMITS_COUNT))

if [ "$COMMITS_COUNT" -gt 0 ]; then
  echo "Found $COMMITS_COUNT commit(s)"
  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/commits_section.md)"
else
  echo "No commits found"
fi`;
  }

  private generateReleasesScript(config: ReleasesInputConfig): string {
    const limit = config.limit || 20;

    return `# Collect Releases
echo "## 🚀 Releases" >> /tmp/releases_section.md
echo "" >> /tmp/releases_section.md

RELEASES_COUNT=0
RELEASES_JSON=$(gh api "repos/\${{ github.repository }}/releases?per_page=${limit}" \\
  --jq '[.[] | select(.created_at >= "'$SINCE_DATE'")]' 2>/dev/null || echo "[]")

${!config.prerelease ? `# Exclude prereleases\nRELEASES_JSON=$(echo "$RELEASES_JSON" | jq '[.[] | select(.prerelease == false)]')` : ''}
${!config.draft ? `# Exclude drafts\nRELEASES_JSON=$(echo "$RELEASES_JSON" | jq '[.[] | select(.draft == false)]')` : ''}

RELEASES_COUNT=$(echo "$RELEASES_JSON" | jq 'length')
TOTAL_ITEMS=$((TOTAL_ITEMS + RELEASES_COUNT))

if [ "$RELEASES_COUNT" -gt 0 ]; then
  echo "Found $RELEASES_COUNT release(s)"

  echo "$RELEASES_JSON" | jq -r '.[] |
    "### " + .tag_name + " - " + .name + "\\n" +
    "**Author:** @" + .author.login + " | **Published:** " + .published_at + "\\n" +
    (if .prerelease then "**Type:** Pre-release\\n" else "**Type:** Release\\n" end) +
    "**URL:** " + .html_url + "\\n" +
    (if .body then "\\n" + .body + "\\n" else "" end) +
    "---\\n"
  ' >> /tmp/releases_section.md

  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/releases_section.md)"
else
  echo "No releases found"
fi`;
  }

  private generateWorkflowRunsScript(config: WorkflowRunsInputConfig): string {
    const limit = config.limit || 50;
    const statuses = config.status?.join(',') || 'failure';

    return `# Collect Workflow Runs
echo "## ⚙️ Workflow Runs" >> /tmp/workflows_section.md
echo "" >> /tmp/workflows_section.md

WORKFLOWS_COUNT=0
RUNS_JSON=$(gh api "repos/\${{ github.repository }}/actions/runs?per_page=${limit}" \\
  --jq '[.workflow_runs[] | select(.created_at >= "'$SINCE_DATE'")]' 2>/dev/null || echo "[]")

# Filter by status
RUNS_JSON=$(echo "$RUNS_JSON" | jq '[.[] | select(.conclusion | IN("${statuses.split(',').join('","')}"))]')

WORKFLOWS_COUNT=$(echo "$RUNS_JSON" | jq 'length')
TOTAL_ITEMS=$((TOTAL_ITEMS + WORKFLOWS_COUNT))

if [ "$WORKFLOWS_COUNT" -gt 0 ]; then
  echo "Found $WORKFLOWS_COUNT workflow run(s)"

  echo "$RUNS_JSON" | jq -r '.[] |
    "### " + .name + " - Run #" + (.run_number|tostring) + "\\n" +
    "**Status:** " + .conclusion + " | **Branch:** " + .head_branch + " | **Author:** @" + .actor.login + "\\n" +
    "**Created:** " + .created_at + "\\n" +
    "**URL:** " + .html_url + "\\n" +
    "---\\n"
  ' >> /tmp/workflows_section.md

  COLLECTED_DATA="$COLLECTED_DATA$(cat /tmp/workflows_section.md)"
else
  echo "No workflow runs found"
fi`;
  }

  private generateStarsScript(): string {
    return `# Collect Stars (growth since last check)
CURRENT_STARS=$(gh api "repos/\${{ github.repository }}" --jq '.stargazers_count' 2>/dev/null || echo "0")
echo "Current stars: $CURRENT_STARS"
# Note: Would need to track previous value to show growth
COLLECTED_DATA="$COLLECTED_DATA## ⭐ Stars: $CURRENT_STARS\\n\\n"
TOTAL_ITEMS=$((TOTAL_ITEMS + 1))`;
  }

  private generateForksScript(): string {
    return `# Collect Forks (growth since last check)
CURRENT_FORKS=$(gh api "repos/\${{ github.repository }}" --jq '.forks_count' 2>/dev/null || echo "0")
echo "Current forks: $CURRENT_FORKS"
# Note: Would need to track previous value to show growth
COLLECTED_DATA="$COLLECTED_DATA## 🍴 Forks: $CURRENT_FORKS\\n\\n"
TOTAL_ITEMS=$((TOTAL_ITEMS + 1))`;
  }
}

export const inputCollector = new InputCollector();
