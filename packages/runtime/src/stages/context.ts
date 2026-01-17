import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AgentParser } from "@repo-agents/parser";
import type {
  CodeScanningAlertsContextConfig,
  CommitsContextConfig,
  DependabotPRsContextConfig,
  DiscussionsContextConfig,
  GitHubCommit,
  GitHubDiscussion,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubWorkflowRun,
  IssuesContextConfig,
  PullRequestsContextConfig,
  ReleasesContextConfig,
  SecurityAlertsContextConfig,
  WorkflowRunsContextConfig,
} from "@repo-agents/types";
import type { StageContext, StageResult } from "../types";
import { ghApi, parseRepository } from "../utils/index";

/**
 * Context collection stage - collects repository data based on agent configuration.
 * This stage runs before the agent execution to gather context for scheduled/batch agents.
 */
export async function runContext(ctx: StageContext): Promise<StageResult> {
  const parser = new AgentParser();

  // Load agent definition
  const { agent } = await parser.parseFile(ctx.agentPath);

  if (!agent) {
    return {
      success: false,
      outputs: { "has-context": "false", "total-items": "0" },
    };
  }

  // Check if context is configured
  if (!agent.context) {
    return {
      success: true,
      outputs: { "has-context": "false", "total-items": "0" },
      skipReason: "No context configuration in agent definition",
    };
  }

  const config = agent.context;
  const { owner, repo } = parseRepository(ctx.repository);

  // Calculate time filter
  const sinceDate = await calculateSinceDate(config.since || "last-run", ctx, owner, repo);
  console.log(`Collecting data since: ${sinceDate.toISOString()}`);

  // Collect all configured context types
  const collectedSections: string[] = [];
  let totalItems = 0;

  // Collect issues
  if (config.issues) {
    const { markdown, count } = await collectIssues(owner, repo, config.issues, sinceDate);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} issue(s)`);
  }

  // Collect pull requests
  if (config.pull_requests) {
    const { markdown, count } = await collectPullRequests(
      owner,
      repo,
      config.pull_requests,
      sinceDate,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} pull request(s)`);
  }

  // Collect discussions
  if (config.discussions) {
    const { markdown, count } = await collectDiscussions(
      owner,
      repo,
      config.discussions,
      sinceDate,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} discussion(s)`);
  }

  // Collect commits
  if (config.commits) {
    const { markdown, count } = await collectCommits(owner, repo, config.commits, sinceDate);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} commit(s)`);
  }

  // Collect releases
  if (config.releases) {
    const { markdown, count } = await collectReleases(owner, repo, config.releases, sinceDate);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} release(s)`);
  }

  // Collect workflow runs
  if (config.workflow_runs) {
    const { markdown, count } = await collectWorkflowRuns(
      owner,
      repo,
      config.workflow_runs,
      sinceDate,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} workflow run(s)`);
  }

  // Collect stars
  if (config.stars) {
    const { markdown, count } = await collectStars(owner, repo);
    collectedSections.push(markdown);
    totalItems += count;
  }

  // Collect forks
  if (config.forks) {
    const { markdown, count } = await collectForks(owner, repo);
    collectedSections.push(markdown);
    totalItems += count;
  }

  // Collect security alerts
  if (config.security_alerts) {
    const { markdown, count } = await collectSecurityAlerts(owner, repo, config.security_alerts);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} security alert(s)`);
  }

  // Collect dependabot PRs
  if (config.dependabot_prs) {
    const { markdown, count} = await collectDependabotPRs(owner, repo, config.dependabot_prs);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} Dependabot PR(s)`);
  }

  // Collect code scanning alerts
  if (config.code_scanning_alerts) {
    const { markdown, count } = await collectCodeScanningAlerts(
      owner,
      repo,
      config.code_scanning_alerts,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} code scanning alert(s)`);
  }

  // Check min_items threshold
  const minItems = config.min_items ?? 1;
  if (totalItems < minItems) {
    console.log(`Only found ${totalItems} items (minimum: ${minItems}). Skipping agent execution.`);
    return {
      success: true,
      outputs: { "has-context": "false", "total-items": String(totalItems) },
      skipReason: `Collected ${totalItems} items, but minimum is ${minItems}`,
    };
  }

  // Write context file
  const contextPath = "/tmp/context/collected.md";
  await mkdir(dirname(contextPath), { recursive: true });

  const contextContent = [
    "# Collected Context",
    "",
    `*Collected at: ${new Date().toISOString()}*`,
    `*Since: ${sinceDate.toISOString()}*`,
    `*Total items: ${totalItems}*`,
    "",
    ...collectedSections,
  ].join("\n");

  await writeFile(contextPath, contextContent, "utf-8");
  console.log(`Collected ${totalItems} items, saved to ${contextPath}`);

  return {
    success: true,
    outputs: {
      "has-context": "true",
      "total-items": String(totalItems),
    },
    artifacts: [{ name: "context", path: contextPath }],
  };
}

/**
 * Calculate the since date based on configuration
 */
async function calculateSinceDate(
  since: string,
  _ctx: StageContext,
  owner: string,
  repo: string,
): Promise<Date> {
  if (since === "last-run") {
    try {
      // Get the last successful workflow run
      const response = await ghApi<{
        workflow_runs: Array<{
          status: string;
          conclusion: string;
          created_at: string;
        }>;
      }>(`repos/${owner}/${repo}/actions/runs?per_page=50`);

      // Find the last successful run of this workflow
      const lastRun = response.workflow_runs.find(
        (run) => run.status === "completed" && run.conclusion === "success",
      );

      if (lastRun) {
        console.log(`Using last successful run timestamp: ${lastRun.created_at}`);
        return new Date(lastRun.created_at);
      }
    } catch {
      console.log("Could not find last run, defaulting to 24 hours");
    }

    // Default to 24 hours if no previous run found
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  // Parse duration format (e.g., "1h", "24h", "7d")
  const hourMatch = since.match(/^(\d+)h$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  const dayMatch = since.match(/^(\d+)d$/);
  if (dayMatch) {
    const days = parseInt(dayMatch[1], 10);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  // Default to 24 hours if invalid format
  console.log(`Invalid since format: ${since}, defaulting to 24 hours`);
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

/**
 * Normalize state array to a single valid GitHub API state value.
 */
function normalizeState(states?: string[]): "open" | "closed" | "all" {
  if (!states || states.length === 0 || states.includes("all") || states.length > 1) {
    return "all";
  }
  return states[0] === "merged" ? "closed" : (states[0] as "open" | "closed");
}

interface CollectionResult {
  markdown: string;
  count: number;
}

/**
 * Collect issues from GitHub
 */
async function collectIssues(
  owner: string,
  repo: string,
  config: IssuesContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 100;
  const state = normalizeState(config.states);

  interface IssueResponse {
    number: number;
    title: string;
    state: string;
    user: { login: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
    body: string | null;
    pull_request?: unknown;
  }

  const response = await ghApi<IssueResponse[]>(
    `repos/${owner}/${repo}/issues?state=${state}&per_page=${limit}`,
  );

  // Filter out pull requests (GitHub includes them in issues endpoint)
  // and filter by updated date
  let issues = response.filter(
    (issue) => !issue.pull_request && new Date(issue.updated_at) >= sinceDate,
  );

  // Filter by labels if specified
  if (config.labels && config.labels.length > 0) {
    issues = issues.filter((issue) =>
      issue.labels.some((label) => config.labels?.includes(label.name)),
    );
  }

  // Exclude by labels if specified
  if (config.exclude_labels && config.exclude_labels.length > 0) {
    issues = issues.filter(
      (issue) => !issue.labels.some((label) => config.exclude_labels?.includes(label.name)),
    );
  }

  // Filter by assignees if specified
  if (config.assignees && config.assignees.length > 0) {
    issues = issues.filter((issue) =>
      issue.assignees.some((assignee) => config.assignees?.includes(assignee.login)),
    );
  }

  // Format as markdown
  const formattedIssues: GitHubIssue[] = issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    author: issue.user.login,
    url: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels: issue.labels.map((l) => l.name),
    assignees: issue.assignees.map((a) => a.login),
    body: issue.body ?? undefined,
  }));

  const markdown = formatIssuesMarkdown(formattedIssues);
  return { markdown, count: formattedIssues.length };
}

function formatIssuesMarkdown(issues: GitHubIssue[]): string {
  if (issues.length === 0) return "";

  const lines = ["## Issues", ""];

  for (const issue of issues) {
    lines.push(`### [#${issue.number}] ${issue.title}`);
    lines.push(
      `**State:** ${issue.state} | **Author:** @${issue.author} | **Updated:** ${issue.updatedAt}`,
    );
    lines.push(`**Labels:** ${issue.labels.join(", ") || "none"}`);
    lines.push(`**URL:** ${issue.url}`);
    if (issue.body) {
      lines.push("", issue.body);
    }
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect pull requests from GitHub
 */
async function collectPullRequests(
  owner: string,
  repo: string,
  config: PullRequestsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 100;
  const state = normalizeState(config.states);

  interface PullRequestResponse {
    number: number;
    title: string;
    state: string;
    user: { login: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    labels: Array<{ name: string }>;
    assignees: Array<{ login: string }>;
    requested_reviewers: Array<{ login: string }>;
    base: { ref: string };
    head: { ref: string };
    body: string | null;
  }

  const response = await ghApi<PullRequestResponse[]>(
    `repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`,
  );

  // Filter by updated date
  let prs = response.filter((pr) => new Date(pr.updated_at) >= sinceDate);

  // Filter merged PRs if only merged is requested
  if (config.states?.length === 1 && config.states[0] === "merged") {
    prs = prs.filter((pr) => pr.merged_at !== null);
  }

  // Filter by labels if specified
  if (config.labels && config.labels.length > 0) {
    prs = prs.filter((pr) => pr.labels.some((label) => config.labels?.includes(label.name)));
  }

  // Exclude by labels if specified
  if (config.exclude_labels && config.exclude_labels.length > 0) {
    prs = prs.filter(
      (pr) => !pr.labels.some((label) => config.exclude_labels?.includes(label.name)),
    );
  }

  // Filter by reviewers if specified
  if (config.reviewers && config.reviewers.length > 0) {
    prs = prs.filter((pr) =>
      pr.requested_reviewers.some((reviewer) => config.reviewers?.includes(reviewer.login)),
    );
  }

  // Filter by base branch if specified
  if (config.base_branch) {
    prs = prs.filter((pr) => pr.base.ref === config.base_branch);
  }

  // Filter by head branch if specified
  if (config.head_branch) {
    prs = prs.filter((pr) => pr.head.ref === config.head_branch);
  }

  // Format as markdown
  const formattedPRs: GitHubPullRequest[] = prs.map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    author: pr.user.login,
    url: pr.html_url,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at ?? undefined,
    labels: pr.labels.map((l) => l.name),
    assignees: pr.assignees.map((a) => a.login),
    reviewers: pr.requested_reviewers.map((r) => r.login),
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    body: pr.body ?? undefined,
  }));

  const markdown = formatPullRequestsMarkdown(formattedPRs);
  return { markdown, count: formattedPRs.length };
}

function formatPullRequestsMarkdown(prs: GitHubPullRequest[]): string {
  if (prs.length === 0) return "";

  const lines = ["## Pull Requests", ""];

  for (const pr of prs) {
    lines.push(`### [#${pr.number}] ${pr.title}`);
    const stateDisplay = pr.mergedAt ? `${pr.state} (merged)` : pr.state;
    lines.push(
      `**State:** ${stateDisplay} | **Author:** @${pr.author} | **Updated:** ${pr.updatedAt}`,
    );
    lines.push(`**Branch:** ${pr.headBranch} -> ${pr.baseBranch}`);
    lines.push(`**Labels:** ${pr.labels.join(", ") || "none"}`);
    lines.push(`**URL:** ${pr.url}`);
    if (pr.body) {
      lines.push("", pr.body);
    }
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect discussions from GitHub using GraphQL
 */
async function collectDiscussions(
  owner: string,
  repo: string,
  config: DiscussionsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 100;

  interface DiscussionNode {
    number: number;
    title: string;
    author: { login: string };
    url: string;
    createdAt: string;
    updatedAt: string;
    category: { name: string };
    answer: { isAnswer: boolean } | null;
    labels: { nodes: Array<{ name: string }> };
    body: string;
  }

  interface GraphQLResponse {
    data: {
      repository: {
        discussions: {
          nodes: DiscussionNode[];
        };
      };
    };
  }

  const query = `
    query($owner: String!, $repo: String!, $limit: Int!) {
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
    }
  `;

  try {
    const response = await ghApi<GraphQLResponse>("graphql", {
      method: "POST",
      body: {
        query,
        variables: { owner, repo, limit },
      },
    });

    let discussions = response.data.repository.discussions.nodes;

    // Filter by updated date
    discussions = discussions.filter((d) => new Date(d.updatedAt) >= sinceDate);

    // Filter by categories if specified
    if (config.categories && config.categories.length > 0) {
      discussions = discussions.filter((d) => config.categories?.includes(d.category.name));
    }

    // Filter by answered status
    if (config.answered) {
      discussions = discussions.filter((d) => d.answer?.isAnswer === true);
    }

    if (config.unanswered) {
      discussions = discussions.filter((d) => d.answer?.isAnswer !== true);
    }

    // Format as markdown
    const formattedDiscussions: GitHubDiscussion[] = discussions.map((d) => ({
      number: d.number,
      title: d.title,
      author: d.author.login,
      url: d.url,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      category: d.category.name,
      answered: d.answer?.isAnswer === true,
      labels: d.labels.nodes.map((l) => l.name),
      body: d.body,
    }));

    const markdown = formatDiscussionsMarkdown(formattedDiscussions);
    return { markdown, count: formattedDiscussions.length };
  } catch {
    console.log("Failed to collect discussions (may not be enabled for this repository)");
    return { markdown: "", count: 0 };
  }
}

function formatDiscussionsMarkdown(discussions: GitHubDiscussion[]): string {
  if (discussions.length === 0) return "";

  const lines = ["## Discussions", ""];

  for (const discussion of discussions) {
    lines.push(`### [#${discussion.number}] ${discussion.title}`);
    lines.push(
      `**Category:** ${discussion.category} | **Author:** @${discussion.author} | **Updated:** ${discussion.updatedAt}`,
    );
    lines.push(`**Status:** ${discussion.answered ? "Answered" : "Unanswered"}`);
    lines.push(`**URL:** ${discussion.url}`);
    if (discussion.body) {
      lines.push("", discussion.body);
    }
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect commits from GitHub
 */
async function collectCommits(
  owner: string,
  repo: string,
  config: CommitsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const branches = config.branches || ["main", "master"];
  const limit = config.limit || 100;

  interface CommitResponse {
    sha: string;
    commit: {
      message: string;
      author: {
        name: string;
        date: string;
      };
    };
    html_url: string;
  }

  const allCommits: GitHubCommit[] = [];

  for (const branch of branches) {
    try {
      // Check if branch exists
      await ghApi(`repos/${owner}/${repo}/branches/${branch}`);

      const response = await ghApi<CommitResponse[]>(
        `repos/${owner}/${repo}/commits?sha=${branch}&since=${sinceDate.toISOString()}&per_page=${limit}`,
      );

      const commits: GitHubCommit[] = response.map((c) => ({
        sha: c.sha.substring(0, 7),
        message: c.commit.message.split("\n")[0],
        author: c.commit.author.name,
        date: c.commit.author.date,
        url: c.html_url,
        branch,
      }));

      // Filter by authors if specified
      const filteredCommits = config.authors
        ? commits.filter((c) => config.authors?.includes(c.author))
        : commits;

      // Exclude by authors if specified
      const finalCommits = config.exclude_authors
        ? filteredCommits.filter((c) => !config.exclude_authors?.includes(c.author))
        : filteredCommits;

      allCommits.push(...finalCommits);
    } catch {}
  }

  const markdown = formatCommitsMarkdown(allCommits);
  return { markdown, count: allCommits.length };
}

function formatCommitsMarkdown(commits: GitHubCommit[]): string {
  if (commits.length === 0) return "";

  const lines = ["## Commits", ""];

  for (const commit of commits) {
    lines.push(
      `- [\`${commit.sha}\`](${commit.url}) ${commit.message} - @${commit.author} (${commit.date})`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Collect releases from GitHub
 */
async function collectReleases(
  owner: string,
  repo: string,
  config: ReleasesContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 20;

  interface ReleaseResponse {
    tag_name: string;
    name: string;
    author: { login: string };
    html_url: string;
    created_at: string;
    published_at: string;
    prerelease: boolean;
    draft: boolean;
    body: string | null;
  }

  const response = await ghApi<ReleaseResponse[]>(
    `repos/${owner}/${repo}/releases?per_page=${limit}`,
  );

  // Filter by created date
  let releases = response.filter((r) => new Date(r.created_at) >= sinceDate);

  // Filter prereleases
  if (config.prerelease === false) {
    releases = releases.filter((r) => !r.prerelease);
  }

  // Filter drafts
  if (config.draft === false) {
    releases = releases.filter((r) => !r.draft);
  }

  const formattedReleases: GitHubRelease[] = releases.map((r) => ({
    tagName: r.tag_name,
    name: r.name,
    author: r.author.login,
    url: r.html_url,
    createdAt: r.created_at,
    publishedAt: r.published_at,
    prerelease: r.prerelease,
    draft: r.draft,
    body: r.body ?? undefined,
  }));

  const markdown = formatReleasesMarkdown(formattedReleases);
  return { markdown, count: formattedReleases.length };
}

function formatReleasesMarkdown(releases: GitHubRelease[]): string {
  if (releases.length === 0) return "";

  const lines = ["## Releases", ""];

  for (const release of releases) {
    lines.push(`### ${release.tagName} - ${release.name}`);
    lines.push(`**Author:** @${release.author} | **Published:** ${release.publishedAt}`);
    lines.push(`**Type:** ${release.prerelease ? "Pre-release" : "Release"}`);
    lines.push(`**URL:** ${release.url}`);
    if (release.body) {
      lines.push("", release.body);
    }
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect workflow runs from GitHub
 */
async function collectWorkflowRuns(
  owner: string,
  repo: string,
  config: WorkflowRunsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 50;
  const statuses = config.status || ["failure"];

  interface WorkflowRunResponse {
    id: number;
    name: string;
    status: string;
    conclusion: string;
    html_url: string;
    head_branch: string;
    created_at: string;
    updated_at: string;
    actor: { login: string };
  }

  interface WorkflowRunsResponse {
    workflow_runs: WorkflowRunResponse[];
  }

  const response = await ghApi<WorkflowRunsResponse>(
    `repos/${owner}/${repo}/actions/runs?per_page=${limit}`,
  );

  // Filter by created date and status
  const runs = response.workflow_runs.filter(
    (run) =>
      new Date(run.created_at) >= sinceDate &&
      statuses.includes(run.conclusion as (typeof statuses)[number]),
  );

  const formattedRuns: GitHubWorkflowRun[] = runs.map((r) => ({
    id: r.id,
    name: r.name,
    status: r.status,
    conclusion: r.conclusion,
    url: r.html_url,
    branch: r.head_branch,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: r.actor.login,
  }));

  const markdown = formatWorkflowRunsMarkdown(formattedRuns);
  return { markdown, count: formattedRuns.length };
}

function formatWorkflowRunsMarkdown(runs: GitHubWorkflowRun[]): string {
  if (runs.length === 0) return "";

  const lines = ["## Workflow Runs", ""];

  for (const run of runs) {
    lines.push(`### ${run.name} - Run #${run.id}`);
    lines.push(
      `**Status:** ${run.conclusion} | **Branch:** ${run.branch} | **Author:** @${run.author}`,
    );
    lines.push(`**Created:** ${run.createdAt}`);
    lines.push(`**URL:** ${run.url}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect repository stars count
 */
async function collectStars(owner: string, repo: string): Promise<CollectionResult> {
  interface RepoResponse {
    stargazers_count: number;
  }

  const response = await ghApi<RepoResponse>(`repos/${owner}/${repo}`);
  const stars = response.stargazers_count;

  console.log(`Current stars: ${stars}`);

  return {
    markdown: `## Stars: ${stars}\n\n`,
    count: 1,
  };
}

/**
 * Collect repository forks count
 */
async function collectForks(owner: string, repo: string): Promise<CollectionResult> {
  interface RepoResponse {
    forks_count: number;
  }

  const response = await ghApi<RepoResponse>(`repos/${owner}/${repo}`);
  const forks = response.forks_count;

  console.log(`Current forks: ${forks}`);

  return {
    markdown: `## Forks: ${forks}\n\n`,
    count: 1,
  };
}

/**
 * Collect Dependabot security alerts from GitHub
 */
async function collectSecurityAlerts(
  owner: string,
  repo: string,
  config: SecurityAlertsContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 100;

  interface SecurityAlert {
    number: number;
    state: string;
    dependency: {
      package: {
        ecosystem: string;
        name: string;
      };
      manifest_path?: string;
    };
    security_advisory: {
      ghsa_id: string;
      cve_id: string | null;
      summary: string;
      description: string;
      severity: string;
      cvss: {
        score: number;
        vector_string: string | null;
      };
      cwes: Array<{
        cwe_id: string;
        name: string;
      }>;
      published_at: string;
      updated_at: string;
      withdrawn_at: string | null;
      references: Array<{
        url: string;
      }>;
    };
    security_vulnerability: {
      package: {
        ecosystem: string;
        name: string;
      };
      severity: string;
      vulnerable_version_range: string;
      first_patched_version: {
        identifier: string;
      } | null;
    };
    url: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    dismissed_at: string | null;
    dismissed_by: { login: string } | null;
    dismissed_reason: string | null;
    dismissed_comment: string | null;
    fixed_at: string | null;
  }

  try {
    const response = await ghApi<SecurityAlert[]>(
      `repos/${owner}/${repo}/dependabot/alerts?per_page=${limit}&sort=created&direction=desc`,
    );

    let alerts = response;

    // Filter by state if specified
    if (config.state && config.state.length > 0) {
      alerts = alerts.filter((alert) => {
        if (config.state?.includes("open" as never)) {
          if (alert.state === "open") return true;
        }
        if (config.state?.includes("fixed" as never)) {
          if (alert.state === "fixed" || alert.fixed_at !== null) return true;
        }
        if (config.state?.includes("dismissed" as never)) {
          if (alert.state === "dismissed" || alert.dismissed_at !== null) return true;
        }
        return false;
      });
    }

    // Filter by severity if specified
    if (config.severity && config.severity.length > 0) {
      alerts = alerts.filter((alert) =>
        config.severity?.includes(alert.security_advisory.severity.toLowerCase() as never),
      );
    }

    // Filter by ecosystem if specified
    if (config.ecosystem && config.ecosystem.length > 0) {
      alerts = alerts.filter((alert) =>
        config.ecosystem?.includes(alert.dependency.package.ecosystem),
      );
    }

    const markdown = formatSecurityAlertsMarkdown(alerts);
    return { markdown, count: alerts.length };
  } catch (error) {
    console.log("Failed to collect security alerts (may require security_events permission)");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatSecurityAlertsMarkdown(
  alerts: Array<{
    number: number;
    state: string;
    dependency: {
      package: {
        ecosystem: string;
        name: string;
      };
    };
    security_advisory: {
      ghsa_id: string;
      cve_id: string | null;
      summary: string;
      severity: string;
      cvss: {
        score: number;
      };
    };
    security_vulnerability: {
      vulnerable_version_range: string;
      first_patched_version: {
        identifier: string;
      } | null;
    };
    html_url: string;
    created_at: string;
    fixed_at: string | null;
    dismissed_at: string | null;
  }>,
): string {
  if (alerts.length === 0) return "";

  const lines = ["## Security Alerts", ""];

  for (const alert of alerts) {
    const status = alert.fixed_at ? "Fixed" : alert.dismissed_at ? "Dismissed" : "Open";

    lines.push(`### [Alert #${alert.number}] ${alert.security_advisory.summary}`);
    lines.push(
      `**Severity:** ${alert.security_advisory.severity.toUpperCase()} (CVSS: ${alert.security_advisory.cvss.score}) | **Status:** ${status}`,
    );
    lines.push(
      `**Package:** ${alert.dependency.package.ecosystem}/${alert.dependency.package.name}`,
    );
    lines.push(`**Vulnerable Range:** ${alert.security_vulnerability.vulnerable_version_range}`);
    if (alert.security_vulnerability.first_patched_version) {
      lines.push(`**Fixed In:** ${alert.security_vulnerability.first_patched_version.identifier}`);
    }
    if (alert.security_advisory.cve_id) {
      lines.push(`**CVE:** ${alert.security_advisory.cve_id}`);
    }
    lines.push(`**GHSA:** ${alert.security_advisory.ghsa_id}`);
    lines.push(`**URL:** ${alert.html_url}`);
    lines.push(`**Created:** ${alert.created_at}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect Dependabot pull requests from GitHub
 */
async function collectDependabotPRs(
  owner: string,
  repo: string,
  config: DependabotPRsContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 50;
  const states = config.states || ["open"];

  interface PullRequestResponse {
    number: number;
    title: string;
    state: string;
    user: { login: string; type: string };
    html_url: string;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    labels: Array<{ name: string }>;
    base: { ref: string };
    head: { ref: string; sha: string };
    body: string | null;
  }

  try {
    // Fetch PRs with all states first, then filter
    const allStates = ["open", "closed"];
    const allPrs: PullRequestResponse[] = [];

    for (const state of allStates) {
      if (
        states.includes(state as never) ||
        (state === "closed" && states.includes("merged" as never))
      ) {
        const response = await ghApi<PullRequestResponse[]>(
          `repos/${owner}/${repo}/pulls?state=${state}&per_page=${limit}`,
        );
        allPrs.push(...response);
      }
    }

    // Filter for Dependabot PRs
    let dependabotPRs = allPrs.filter(
      (pr) =>
        pr.user.login === "dependabot[bot]" ||
        pr.user.login === "dependabot" ||
        pr.user.type === "Bot",
    );

    // Filter by merged state if specified
    if (states.length === 1 && states[0] === "merged") {
      dependabotPRs = dependabotPRs.filter((pr) => pr.merged_at !== null);
    }

    // Limit the results
    dependabotPRs = dependabotPRs.slice(0, limit);

    const markdown = formatDependabotPRsMarkdown(dependabotPRs);
    return { markdown, count: dependabotPRs.length };
  } catch (error) {
    console.log("Failed to collect Dependabot PRs");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatDependabotPRsMarkdown(
  prs: Array<{
    number: number;
    title: string;
    state: string;
    html_url: string;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    base: { ref: string };
    head: { ref: string };
    labels: Array<{ name: string }>;
    body: string | null;
  }>,
): string {
  if (prs.length === 0) return "";

  const lines = ["## Dependabot Pull Requests", ""];

  for (const pr of prs) {
    const status = pr.merged_at ? "Merged" : pr.state === "open" ? "Open" : "Closed";

    // Try to parse package info from title
    // Typical format: "Bump package-name from 1.0.0 to 2.0.0"
    const titleMatch = pr.title.match(/Bump\s+(.+?)\s+from\s+([\d.]+)\s+to\s+([\d.]+)/i);
    const packageName = titleMatch?.[1] || "Unknown";
    const fromVersion = titleMatch?.[2] || "?";
    const toVersion = titleMatch?.[3] || "?";

    lines.push(`### [PR #${pr.number}] ${pr.title}`);
    lines.push(`**Status:** ${status} | **Package:** ${packageName}`);
    lines.push(`**Version Update:** ${fromVersion} → ${toVersion}`);
    lines.push(`**Branch:** ${pr.head.ref} → ${pr.base.ref}`);
    lines.push(`**Labels:** ${pr.labels.map((l) => l.name).join(", ") || "none"}`);
    lines.push(`**Created:** ${pr.created_at} | **Updated:** ${pr.updated_at}`);
    if (pr.merged_at) {
      lines.push(`**Merged:** ${pr.merged_at}`);
    }
    lines.push(`**URL:** ${pr.html_url}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect code scanning alerts from GitHub (CodeQL, etc.)
 */
async function collectCodeScanningAlerts(
  owner: string,
  repo: string,
  config: CodeScanningAlertsContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 100;

  interface CodeScanningAlert {
    number: number;
    state: string;
    rule: {
      id: string;
      severity: string;
      description: string;
      name: string;
      security_severity_level?: string;
      tags?: string[];
    };
    tool: {
      name: string;
      version: string | null;
    };
    most_recent_instance: {
      ref: string;
      state: string;
      commit_sha: string;
      location: {
        path: string;
        start_line: number;
        end_line: number;
        start_column?: number;
        end_column?: number;
      };
      message: {
        text: string;
      };
      classifications?: string[];
    };
    created_at: string;
    updated_at: string;
    dismissed_at: string | null;
    dismissed_by: { login: string } | null;
    dismissed_reason: string | null;
    dismissed_comment: string | null;
    fixed_at: string | null;
    html_url: string;
  }

  try {
    const response = await ghApi<CodeScanningAlert[]>(
      `repos/${owner}/${repo}/code-scanning/alerts?per_page=${limit}&sort=created&direction=desc`,
    );

    let alerts = response;

    // Filter by state if specified
    if (config.state && config.state.length > 0) {
      alerts = alerts.filter((alert) => {
        if (config.state?.includes("open" as never)) {
          if (alert.state === "open") return true;
        }
        if (config.state?.includes("fixed" as never)) {
          if (alert.state === "fixed" || alert.fixed_at !== null) return true;
        }
        if (config.state?.includes("dismissed" as never)) {
          if (alert.state === "dismissed" || alert.dismissed_at !== null) return true;
        }
        return false;
      });
    }

    // Filter by severity if specified
    if (config.severity && config.severity.length > 0) {
      alerts = alerts.filter((alert) => {
        const severity =
          alert.rule.security_severity_level?.toLowerCase() ||
          alert.rule.severity?.toLowerCase();
        return config.severity?.includes(severity as never);
      });
    }

    // Filter by tool if specified
    if (config.tool && config.tool.length > 0) {
      alerts = alerts.filter((alert) => config.tool?.includes(alert.tool.name));
    }

    const markdown = formatCodeScanningAlertsMarkdown(alerts);
    return { markdown, count: alerts.length };
  } catch (error) {
    console.log(
      "Failed to collect code scanning alerts (may require security_events permission)",
    );
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatCodeScanningAlertsMarkdown(alerts: Array<{
  number: number;
  state: string;
  rule: {
    id: string;
    severity: string;
    description: string;
    name: string;
    security_severity_level?: string;
  };
  tool: {
    name: string;
    version: string | null;
  };
  most_recent_instance: {
    location: {
      path: string;
      start_line: number;
      end_line: number;
    };
    message: {
      text: string;
    };
  };
  html_url: string;
  created_at: string;
  fixed_at: string | null;
  dismissed_at: string | null;
}>): string {
  if (alerts.length === 0) return "";

  const lines = ["## Code Scanning Alerts", ""];

  for (const alert of alerts) {
    const status = alert.fixed_at
      ? "Fixed"
      : alert.dismissed_at
        ? "Dismissed"
        : "Open";

    const severity = (
      alert.rule.security_severity_level || alert.rule.severity
    ).toUpperCase();

    lines.push(`### [Alert #${alert.number}] ${alert.rule.name}`);
    lines.push(
      `**Severity:** ${severity} | **Status:** ${status} | **Tool:** ${alert.tool.name}`,
    );
    lines.push(`**Rule:** ${alert.rule.id}`);
    lines.push(`**Description:** ${alert.rule.description}`);
    lines.push(
      `**Location:** ${alert.most_recent_instance.location.path}:${alert.most_recent_instance.location.start_line}`,
    );
    lines.push(`**Message:** ${alert.most_recent_instance.message.text}`);
    lines.push(`**URL:** ${alert.html_url}`);
    lines.push(`**Created:** ${alert.created_at}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}
