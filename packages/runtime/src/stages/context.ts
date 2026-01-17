import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AgentParser } from "@repo-agents/parser";
import type {
  CommitsContextConfig,
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
