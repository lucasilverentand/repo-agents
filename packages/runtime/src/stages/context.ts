import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AgentParser } from "@repo-agents/parser";
import type {
  BranchesContextConfig,
  CheckRunsContextConfig,
  CodeScanningAlertsContextConfig,
  CommentsContextConfig,
  CommitsContextConfig,
  ContributorsContextConfig,
  DependabotPRsContextConfig,
  DeploymentsContextConfig,
  DiscussionsContextConfig,
  GitHubCommit,
  GitHubDiscussion,
  GitHubIssue,
  GitHubProject,
  GitHubProjectField,
  GitHubProjectItem,
  GitHubProjectItemFieldValue,
  GitHubPullRequest,
  GitHubRelease,
  GitHubWorkflowRun,
  IssuesContextConfig,
  MilestonesContextConfig,
  ProjectContextConfig,
  PullRequestsContextConfig,
  ReleasesContextConfig,
  RepositoryTrafficContextConfig,
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
    const { markdown, count } = await collectDependabotPRs(owner, repo, config.dependabot_prs);
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

  // Collect deployments
  if (config.deployments) {
    const { markdown, count } = await collectDeployments(owner, repo, config.deployments);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} deployment(s)`);
  }

  // Collect milestones
  if (config.milestones) {
    const { markdown, count } = await collectMilestones(owner, repo, config.milestones);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} milestone(s)`);
  }

  // Collect contributors
  if (config.contributors) {
    const { markdown, count } = await collectContributors(
      owner,
      repo,
      config.contributors,
      sinceDate,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} contributor(s)`);
  }

  // Collect comments
  if (config.comments) {
    const { markdown, count } = await collectComments(owner, repo, config.comments, sinceDate);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} comment(s)`);
  }

  // Collect repository traffic
  if (config.repository_traffic) {
    const { markdown, count } = await collectRepositoryTraffic(
      owner,
      repo,
      config.repository_traffic,
    );
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found repository traffic data`);
  }

  // Collect branches
  if (config.branches) {
    const { markdown, count } = await collectBranches(owner, repo, config.branches);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} branch(es)`);
  }

  // Collect check runs
  if (config.check_runs) {
    const { markdown, count } = await collectCheckRuns(owner, repo, config.check_runs, sinceDate);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} check run(s)`);
  }

  // Collect project context (GitHub Projects v2)
  if (config.project) {
    const { markdown, count } = await collectProject(owner, repo, config.project);
    if (count > 0) {
      collectedSections.push(markdown);
      totalItems += count;
    }
    console.log(`Found ${count} project item(s)`);
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
          alert.rule.security_severity_level?.toLowerCase() || alert.rule.severity?.toLowerCase();
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
    console.log("Failed to collect code scanning alerts (may require security_events permission)");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatCodeScanningAlertsMarkdown(
  alerts: Array<{
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
  }>,
): string {
  if (alerts.length === 0) return "";

  const lines = ["## Code Scanning Alerts", ""];

  for (const alert of alerts) {
    const status = alert.fixed_at ? "Fixed" : alert.dismissed_at ? "Dismissed" : "Open";

    const severity = (alert.rule.security_severity_level || alert.rule.severity).toUpperCase();

    lines.push(`### [Alert #${alert.number}] ${alert.rule.name}`);
    lines.push(`**Severity:** ${severity} | **Status:** ${status} | **Tool:** ${alert.tool.name}`);
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

/**
 * Collect deployments from GitHub
 */
async function collectDeployments(
  owner: string,
  repo: string,
  config: DeploymentsContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 50;

  interface DeploymentStatus {
    state: string;
    description: string | null;
    environment: string;
    created_at: string;
    updated_at: string;
    target_url: string | null;
    log_url: string | null;
  }

  interface DeploymentResponse {
    id: number;
    sha: string;
    ref: string;
    task: string;
    environment: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    creator: { login: string };
    statuses_url: string;
  }

  try {
    const response = await ghApi<DeploymentResponse[]>(
      `repos/${owner}/${repo}/deployments?per_page=${limit}`,
    );

    let deployments = response;

    // Filter by environment if specified
    if (config.environments && config.environments.length > 0) {
      deployments = deployments.filter((d) => config.environments?.includes(d.environment));
    }

    // Fetch statuses for each deployment and filter by state if specified
    const deploymentsWithStatus = await Promise.all(
      deployments.map(async (deployment) => {
        try {
          const statuses = await ghApi<DeploymentStatus[]>(
            `repos/${owner}/${repo}/deployments/${deployment.id}/statuses`,
          );
          const latestStatus = statuses[0]; // Most recent status first
          return { deployment, status: latestStatus };
        } catch {
          return { deployment, status: null };
        }
      }),
    );

    // Filter by state if specified
    let filteredDeployments = deploymentsWithStatus;
    if (config.states && config.states.length > 0) {
      filteredDeployments = deploymentsWithStatus.filter((d) =>
        d.status ? config.states?.includes(d.status.state as never) : false,
      );
    }

    const markdown = formatDeploymentsMarkdown(filteredDeployments);
    return { markdown, count: filteredDeployments.length };
  } catch (error) {
    console.log("Failed to collect deployments");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatDeploymentsMarkdown(
  deployments: Array<{
    deployment: {
      id: number;
      sha: string;
      ref: string;
      environment: string;
      description: string | null;
      created_at: string;
      creator: { login: string };
    };
    status: {
      state: string;
      description: string | null;
      created_at: string;
      target_url: string | null;
      log_url: string | null;
    } | null;
  }>,
): string {
  if (deployments.length === 0) return "";

  const lines = ["## Deployments", ""];

  for (const { deployment, status } of deployments) {
    const shortSha = deployment.sha.substring(0, 7);
    lines.push(`### Deployment #${deployment.id} - ${deployment.environment}`);
    lines.push(
      `**Ref:** ${deployment.ref} (\`${shortSha}\`) | **Creator:** @${deployment.creator.login}`,
    );
    if (status) {
      lines.push(`**Status:** ${status.state.toUpperCase()} | **Updated:** ${status.created_at}`);
      if (status.description) {
        lines.push(`**Description:** ${status.description}`);
      }
      if (status.target_url) {
        lines.push(`**Deployment URL:** ${status.target_url}`);
      }
      if (status.log_url) {
        lines.push(`**Logs:** ${status.log_url}`);
      }
    } else {
      lines.push("**Status:** No status available");
    }
    if (deployment.description) {
      lines.push(`**Notes:** ${deployment.description}`);
    }
    lines.push(`**Created:** ${deployment.created_at}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect milestones from GitHub
 */
async function collectMilestones(
  owner: string,
  repo: string,
  config: MilestonesContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 20;
  const state = config.states?.[0] || "open";
  const sort = config.sort || "due_on";

  interface MilestoneResponse {
    number: number;
    title: string;
    description: string | null;
    state: string;
    open_issues: number;
    closed_issues: number;
    created_at: string;
    updated_at: string;
    due_on: string | null;
    closed_at: string | null;
    creator: { login: string };
    html_url: string;
  }

  try {
    const response = await ghApi<MilestoneResponse[]>(
      `repos/${owner}/${repo}/milestones?state=${state}&sort=${sort}&per_page=${limit}`,
    );

    const milestones = response;

    const markdown = formatMilestonesMarkdown(milestones);
    return { markdown, count: milestones.length };
  } catch (error) {
    console.log("Failed to collect milestones");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatMilestonesMarkdown(
  milestones: Array<{
    number: number;
    title: string;
    description: string | null;
    state: string;
    open_issues: number;
    closed_issues: number;
    due_on: string | null;
    created_at: string;
    html_url: string;
    creator: { login: string };
  }>,
): string {
  if (milestones.length === 0) return "";

  const lines = ["## Milestones", ""];

  for (const milestone of milestones) {
    const totalIssues = milestone.open_issues + milestone.closed_issues;
    const completionPercent =
      totalIssues > 0 ? Math.round((milestone.closed_issues / totalIssues) * 100) : 0;

    lines.push(`### [Milestone #${milestone.number}] ${milestone.title}`);
    lines.push(
      `**State:** ${milestone.state} | **Completion:** ${completionPercent}% (${milestone.closed_issues}/${totalIssues})`,
    );
    if (milestone.due_on) {
      const dueDate = new Date(milestone.due_on);
      const now = new Date();
      const isOverdue = dueDate < now && milestone.state === "open";
      const dueDateStr = dueDate.toISOString().split("T")[0];
      lines.push(`**Due:** ${dueDateStr}${isOverdue ? " (OVERDUE)" : ""}`);
    }
    lines.push(`**Creator:** @${milestone.creator.login} | **Created:** ${milestone.created_at}`);
    lines.push(`**URL:** ${milestone.html_url}`);
    if (milestone.description) {
      lines.push("", milestone.description);
    }
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect contributors from GitHub
 */
async function collectContributors(
  owner: string,
  repo: string,
  config: ContributorsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 50;

  interface ContributorResponse {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    contributions: number;
    type: string;
  }

  try {
    const response = await ghApi<ContributorResponse[]>(
      `repos/${owner}/${repo}/contributors?per_page=${limit}`,
    );

    const contributors = response;

    // For new contributor detection, we need to check their first contribution date
    // This requires checking commits, PRs, or issues created by each contributor
    const contributorsWithDetails = await Promise.all(
      contributors.map(async (contributor) => {
        try {
          // Get recent commits by this contributor
          const commits = await ghApi<
            Array<{
              commit: { author: { date: string } };
            }>
          >(
            `repos/${owner}/${repo}/commits?author=${contributor.login}&per_page=1&since=${sinceDate.toISOString()}`,
          );

          const hasRecentActivity = commits.length > 0;
          const firstCommitDate =
            commits.length > 0 ? new Date(commits[0].commit.author.date) : null;

          return {
            ...contributor,
            hasRecentActivity,
            firstCommitDate,
          };
        } catch {
          return {
            ...contributor,
            hasRecentActivity: false,
            firstCommitDate: null,
          };
        }
      }),
    );

    // Filter to only contributors with recent activity
    const recentContributors = contributorsWithDetails.filter((c) => c.hasRecentActivity);

    const markdown = formatContributorsMarkdown(recentContributors);
    return { markdown, count: recentContributors.length };
  } catch (error) {
    console.log("Failed to collect contributors");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatContributorsMarkdown(
  contributors: Array<{
    login: string;
    avatar_url: string;
    html_url: string;
    contributions: number;
    hasRecentActivity: boolean;
    firstCommitDate: Date | null;
  }>,
): string {
  if (contributors.length === 0) return "";

  const lines = ["## Contributors", ""];

  for (const contributor of contributors) {
    lines.push(`### @${contributor.login}`);
    lines.push(`**Total Contributions:** ${contributor.contributions}`);
    if (contributor.firstCommitDate) {
      lines.push(`**First Contribution in Period:** ${contributor.firstCommitDate.toISOString()}`);
    }
    lines.push(`**Profile:** ${contributor.html_url}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect comments from GitHub (issue comments, PR comments, review comments)
 */
async function collectComments(
  owner: string,
  repo: string,
  config: CommentsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 100;
  const allComments: Array<{
    id: number;
    type: string;
    body: string;
    author: string;
    createdAt: string;
    updatedAt: string;
    url: string;
    parentNumber?: number;
    parentTitle?: string;
  }> = [];

  interface IssueCommentResponse {
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    updated_at: string;
    html_url: string;
    issue_url: string;
  }

  interface PullRequestCommentResponse {
    id: number;
    body: string;
    user: { login: string };
    created_at: string;
    updated_at: string;
    html_url: string;
    pull_request_url: string;
    path?: string;
    position?: number;
  }

  try {
    // Collect issue comments
    if (config.issue_comments !== false) {
      try {
        const issueComments = await ghApi<IssueCommentResponse[]>(
          `repos/${owner}/${repo}/issues/comments?per_page=${limit}&sort=created&direction=desc`,
        );

        const recentComments = issueComments.filter((c) => new Date(c.created_at) >= sinceDate);

        for (const comment of recentComments) {
          // Extract issue number from issue_url
          const issueMatch = comment.issue_url.match(/\/issues\/(\d+)$/);
          const issueNumber = issueMatch ? parseInt(issueMatch[1], 10) : undefined;

          allComments.push({
            id: comment.id,
            type: "issue_comment",
            body: comment.body,
            author: comment.user.login,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            url: comment.html_url,
            parentNumber: issueNumber,
          });
        }
      } catch (error) {
        console.log("Failed to collect issue comments");
        console.error(error);
      }
    }

    // Collect PR review comments
    if (config.pr_review_comments !== false) {
      try {
        const prComments = await ghApi<PullRequestCommentResponse[]>(
          `repos/${owner}/${repo}/pulls/comments?per_page=${limit}&sort=created&direction=desc`,
        );

        const recentComments = prComments.filter((c) => new Date(c.created_at) >= sinceDate);

        for (const comment of recentComments) {
          // Extract PR number from pull_request_url
          const prMatch = comment.pull_request_url.match(/\/pulls\/(\d+)$/);
          const prNumber = prMatch ? parseInt(prMatch[1], 10) : undefined;

          allComments.push({
            id: comment.id,
            type: "pr_review_comment",
            body: comment.body,
            author: comment.user.login,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            url: comment.html_url,
            parentNumber: prNumber,
          });
        }
      } catch (error) {
        console.log("Failed to collect PR review comments");
        console.error(error);
      }
    }

    const markdown = formatCommentsMarkdown(allComments);
    return { markdown, count: allComments.length };
  } catch (error) {
    console.log("Failed to collect comments");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatCommentsMarkdown(
  comments: Array<{
    id: number;
    type: string;
    body: string;
    author: string;
    createdAt: string;
    url: string;
    parentNumber?: number;
  }>,
): string {
  if (comments.length === 0) return "";

  const lines = ["## Comments", ""];

  for (const comment of comments) {
    const typeLabel = comment.type === "issue_comment" ? "Issue" : "PR Review";
    const parentRef = comment.parentNumber ? `#${comment.parentNumber}` : "Unknown";

    lines.push(`### ${typeLabel} Comment on ${parentRef}`);
    lines.push(`**Author:** @${comment.author} | **Created:** ${comment.createdAt}`);
    lines.push(`**URL:** ${comment.url}`);
    lines.push("", comment.body);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect repository traffic data from GitHub
 */
async function collectRepositoryTraffic(
  owner: string,
  repo: string,
  config: RepositoryTrafficContextConfig,
): Promise<CollectionResult> {
  const sections: string[] = [];
  let totalDataPoints = 0;

  interface TrafficViews {
    count: number;
    uniques: number;
    views: Array<{
      timestamp: string;
      count: number;
      uniques: number;
    }>;
  }

  interface TrafficClones {
    count: number;
    uniques: number;
    clones: Array<{
      timestamp: string;
      count: number;
      uniques: number;
    }>;
  }

  interface TrafficReferrer {
    referrer: string;
    count: number;
    uniques: number;
  }

  interface TrafficPath {
    path: string;
    title: string;
    count: number;
    uniques: number;
  }

  try {
    // Collect views
    if (config.views !== false) {
      try {
        const views = await ghApi<TrafficViews>(`repos/${owner}/${repo}/traffic/views`);
        sections.push(`### Views\n`);
        sections.push(`**Total:** ${views.count} views (${views.uniques} unique visitors)\n`);
        if (views.views.length > 0) {
          sections.push("**Daily Breakdown:**");
          for (const day of views.views.slice(0, 7)) {
            const date = new Date(day.timestamp).toISOString().split("T")[0];
            sections.push(`- ${date}: ${day.count} views (${day.uniques} unique)`);
          }
        }
        sections.push("");
        totalDataPoints += 1;
      } catch (_error) {
        console.log("Failed to collect views (requires push permission)");
      }
    }

    // Collect clones
    if (config.clones !== false) {
      try {
        const clones = await ghApi<TrafficClones>(`repos/${owner}/${repo}/traffic/clones`);
        sections.push(`### Clones\n`);
        sections.push(`**Total:** ${clones.count} clones (${clones.uniques} unique cloners)\n`);
        if (clones.clones.length > 0) {
          sections.push("**Daily Breakdown:**");
          for (const day of clones.clones.slice(0, 7)) {
            const date = new Date(day.timestamp).toISOString().split("T")[0];
            sections.push(`- ${date}: ${day.count} clones (${day.uniques} unique)`);
          }
        }
        sections.push("");
        totalDataPoints += 1;
      } catch (_error) {
        console.log("Failed to collect clones (requires push permission)");
      }
    }

    // Collect referrers
    if (config.referrers !== false) {
      try {
        const referrers = await ghApi<TrafficReferrer[]>(
          `repos/${owner}/${repo}/traffic/popular/referrers`,
        );
        if (referrers.length > 0) {
          sections.push(`### Top Referrers\n`);
          for (const referrer of referrers.slice(0, 10)) {
            sections.push(
              `- **${referrer.referrer}**: ${referrer.count} views (${referrer.uniques} unique)`,
            );
          }
          sections.push("");
          totalDataPoints += 1;
        }
      } catch (_error) {
        console.log("Failed to collect referrers (requires push permission)");
      }
    }

    // Collect popular paths
    if (config.paths !== false) {
      try {
        const paths = await ghApi<TrafficPath[]>(`repos/${owner}/${repo}/traffic/popular/paths`);
        if (paths.length > 0) {
          sections.push(`### Popular Paths\n`);
          for (const path of paths.slice(0, 10)) {
            sections.push(
              `- **${path.path}** (${path.title}): ${path.count} views (${path.uniques} unique)`,
            );
          }
          sections.push("");
          totalDataPoints += 1;
        }
      } catch (_error) {
        console.log("Failed to collect popular paths (requires push permission)");
      }
    }

    if (sections.length === 0) {
      return { markdown: "", count: 0 };
    }

    const markdown = ["## Repository Traffic", "", ...sections].join("\n");
    return { markdown, count: totalDataPoints };
  } catch (error) {
    console.log("Failed to collect repository traffic (requires push permission)");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

/**
 * Collect branches from GitHub
 */
async function collectBranches(
  owner: string,
  repo: string,
  config: BranchesContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 100;
  const staleDays = config.stale_days || 30;

  interface BranchResponse {
    name: string;
    commit: {
      sha: string;
      commit: {
        author: {
          name: string;
          date: string;
        };
      };
    };
    protected: boolean;
  }

  try {
    const response = await ghApi<BranchResponse[]>(
      `repos/${owner}/${repo}/branches?per_page=${limit}`,
    );

    let branches = response;

    // Filter by protected status if specified
    if (config.protected !== undefined) {
      branches = branches.filter((b) => b.protected === config.protected);
    }

    // Calculate stale branches
    const staleThreshold = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);
    const branchesWithStatus = branches.map((branch) => {
      const lastCommitDate = new Date(branch.commit.commit.author.date);
      const isStale = lastCommitDate < staleThreshold;
      const daysSinceCommit = Math.floor(
        (Date.now() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        ...branch,
        lastCommitDate,
        isStale,
        daysSinceCommit,
      };
    });

    const markdown = formatBranchesMarkdown(branchesWithStatus);
    return { markdown, count: branchesWithStatus.length };
  } catch (error) {
    console.log("Failed to collect branches");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatBranchesMarkdown(
  branches: Array<{
    name: string;
    commit: {
      sha: string;
      commit: {
        author: {
          name: string;
          date: string;
        };
      };
    };
    protected: boolean;
    lastCommitDate: Date;
    isStale: boolean;
    daysSinceCommit: number;
  }>,
): string {
  if (branches.length === 0) return "";

  const lines = ["## Branches", ""];

  for (const branch of branches) {
    const shortSha = branch.commit.sha.substring(0, 7);
    const staleIndicator = branch.isStale ? " (STALE)" : "";
    const protectedIndicator = branch.protected ? " [Protected]" : "";

    lines.push(`### ${branch.name}${protectedIndicator}${staleIndicator}`);
    lines.push(`**Last Commit:** \`${shortSha}\` by ${branch.commit.commit.author.name}`);
    lines.push(
      `**Last Activity:** ${branch.lastCommitDate.toISOString()} (${branch.daysSinceCommit} days ago)`,
    );
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect check runs from GitHub
 */
async function collectCheckRuns(
  owner: string,
  repo: string,
  config: CheckRunsContextConfig,
  sinceDate: Date,
): Promise<CollectionResult> {
  const limit = config.limit || 100;

  interface CheckRunResponse {
    total_count: number;
    check_runs: Array<{
      id: number;
      name: string;
      head_sha: string;
      status: string;
      conclusion: string | null;
      started_at: string;
      completed_at: string | null;
      app: {
        name: string;
      };
      output: {
        title: string | null;
        summary: string | null;
      };
      html_url: string;
    }>;
  }

  try {
    // Note: GitHub API doesn't support filtering check runs by date directly
    // We need to get recent commits and then check runs for each
    const response = await ghApi<CheckRunResponse>(
      `repos/${owner}/${repo}/commits/HEAD/check-runs?per_page=${limit}`,
    );

    let checkRuns = response.check_runs.filter((run) => {
      const startedAt = new Date(run.started_at);
      return startedAt >= sinceDate;
    });

    // Filter by workflow names if specified
    if (config.workflows && config.workflows.length > 0) {
      checkRuns = checkRuns.filter((run) => config.workflows?.some((w) => run.name.includes(w)));
    }

    // Filter by status/conclusion if specified
    if (config.status && config.status.length > 0) {
      checkRuns = checkRuns.filter((run) => config.status?.includes(run.conclusion as never));
    }

    const markdown = formatCheckRunsMarkdown(checkRuns);
    return { markdown, count: checkRuns.length };
  } catch (error) {
    console.log("Failed to collect check runs");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatCheckRunsMarkdown(
  checkRuns: Array<{
    id: number;
    name: string;
    head_sha: string;
    status: string;
    conclusion: string | null;
    started_at: string;
    completed_at: string | null;
    app: {
      name: string;
    };
    output: {
      title: string | null;
      summary: string | null;
    };
    html_url: string;
  }>,
): string {
  if (checkRuns.length === 0) return "";

  const lines = ["## Check Runs", ""];

  for (const run of checkRuns) {
    const shortSha = run.head_sha.substring(0, 7);
    const conclusion = run.conclusion || run.status;
    const duration =
      run.completed_at && run.started_at
        ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
        : "in progress";

    lines.push(`### ${run.name} - ${conclusion.toUpperCase()}`);
    lines.push(
      `**App:** ${run.app.name} | **Commit:** \`${shortSha}\` | **Duration:** ${duration}`,
    );
    lines.push(`**Started:** ${run.started_at}`);
    if (run.output.title) {
      lines.push(`**Output:** ${run.output.title}`);
    }
    if (run.output.summary) {
      lines.push(`**Summary:** ${run.output.summary}`);
    }
    lines.push(`**URL:** ${run.html_url}`);
    lines.push("", "---", "");
  }

  return lines.join("\n");
}

/**
 * Collect GitHub Projects v2 data using GraphQL
 */
async function collectProject(
  owner: string,
  repo: string,
  config: ProjectContextConfig,
): Promise<CollectionResult> {
  const limit = config.limit || 100;
  const includeItems = config.include_items !== false;
  const includeFields = config.include_fields !== false;

  // GraphQL types for Project v2
  interface ProjectV2SingleSelectOption {
    id: string;
    name: string;
  }

  interface ProjectV2SingleSelectField {
    __typename: "ProjectV2SingleSelectField";
    id: string;
    name: string;
    options: ProjectV2SingleSelectOption[];
  }

  interface ProjectV2IterationField {
    __typename: "ProjectV2IterationField";
    id: string;
    name: string;
  }

  interface ProjectV2Field {
    __typename: "ProjectV2Field";
    id: string;
    name: string;
    dataType: string;
  }

  type ProjectField = ProjectV2SingleSelectField | ProjectV2IterationField | ProjectV2Field;

  interface ProjectV2ItemFieldSingleSelectValue {
    __typename: "ProjectV2ItemFieldSingleSelectValue";
    name: string;
    field: { name: string };
  }

  interface ProjectV2ItemFieldTextValue {
    __typename: "ProjectV2ItemFieldTextValue";
    text: string;
    field: { name: string };
  }

  interface ProjectV2ItemFieldNumberValue {
    __typename: "ProjectV2ItemFieldNumberValue";
    number: number;
    field: { name: string };
  }

  interface ProjectV2ItemFieldDateValue {
    __typename: "ProjectV2ItemFieldDateValue";
    date: string;
    field: { name: string };
  }

  interface ProjectV2ItemFieldIterationValue {
    __typename: "ProjectV2ItemFieldIterationValue";
    title: string;
    field: { name: string };
  }

  type FieldValue =
    | ProjectV2ItemFieldSingleSelectValue
    | ProjectV2ItemFieldTextValue
    | ProjectV2ItemFieldNumberValue
    | ProjectV2ItemFieldDateValue
    | ProjectV2ItemFieldIterationValue;

  interface IssueContent {
    __typename: "Issue";
    number: number;
    title: string;
    state: string;
    url: string;
    assignees: { nodes: Array<{ login: string }> };
    labels: { nodes: Array<{ name: string }> };
  }

  interface PullRequestContent {
    __typename: "PullRequest";
    number: number;
    title: string;
    state: string;
    url: string;
    assignees: { nodes: Array<{ login: string }> };
    labels: { nodes: Array<{ name: string }> };
  }

  interface DraftIssueContent {
    __typename: "DraftIssue";
    title: string;
  }

  type ItemContent = IssueContent | PullRequestContent | DraftIssueContent;

  interface ProjectItem {
    id: string;
    content: ItemContent | null;
    fieldValues: {
      nodes: FieldValue[];
    };
  }

  interface GraphQLResponse {
    data: {
      repository?: {
        projectV2: {
          id: string;
          number: number;
          title: string;
          shortDescription: string | null;
          url: string;
          fields: {
            nodes: ProjectField[];
          };
          items: {
            nodes: ProjectItem[];
          };
        } | null;
      };
      organization?: {
        projectV2: {
          id: string;
          number: number;
          title: string;
          shortDescription: string | null;
          url: string;
          fields: {
            nodes: ProjectField[];
          };
          items: {
            nodes: ProjectItem[];
          };
        } | null;
      };
    };
    errors?: Array<{ message: string }>;
  }

  // Determine if we're querying by project_number or project_id
  // project_number requires owner context
  const projectNumber = config.project_number;
  const projectId = config.project_id;

  if (!projectNumber && !projectId) {
    console.log("Project context requires either project_number or project_id");
    return { markdown: "", count: 0 };
  }

  try {
    let query: string;
    let variables: Record<string, unknown>;

    if (projectNumber) {
      // Query by project number - need to determine if user or org project
      const projectOwner = config.owner || owner;

      // Try repository project first, then org project
      query = `
        query($owner: String!, $repo: String!, $projectNumber: Int!, $itemsLimit: Int!) {
          repository(owner: $owner, name: $repo) {
            projectV2(number: $projectNumber) {
              id
              number
              title
              shortDescription
              url
              fields(first: 50) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    __typename
                    id
                    name
                    options {
                      id
                      name
                    }
                  }
                  ... on ProjectV2IterationField {
                    __typename
                    id
                    name
                  }
                  ... on ProjectV2Field {
                    __typename
                    id
                    name
                    dataType
                  }
                }
              }
              items(first: $itemsLimit) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      __typename
                      number
                      title
                      state
                      url
                      assignees(first: 10) { nodes { login } }
                      labels(first: 10) { nodes { name } }
                    }
                    ... on PullRequest {
                      __typename
                      number
                      title
                      state
                      url
                      assignees(first: 10) { nodes { login } }
                      labels(first: 10) { nodes { name } }
                    }
                    ... on DraftIssue {
                      __typename
                      title
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        __typename
                        name
                        field { ... on ProjectV2SingleSelectField { name } }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        __typename
                        text
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        __typename
                        number
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        __typename
                        date
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldIterationValue {
                        __typename
                        title
                        field { ... on ProjectV2IterationField { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      variables = {
        owner: projectOwner,
        repo,
        projectNumber,
        itemsLimit: limit,
      };
    } else {
      // Query by project ID (node ID)
      query = `
        query($projectId: ID!, $itemsLimit: Int!) {
          node(id: $projectId) {
            ... on ProjectV2 {
              id
              number
              title
              shortDescription
              url
              fields(first: 50) {
                nodes {
                  ... on ProjectV2SingleSelectField {
                    __typename
                    id
                    name
                    options {
                      id
                      name
                    }
                  }
                  ... on ProjectV2IterationField {
                    __typename
                    id
                    name
                  }
                  ... on ProjectV2Field {
                    __typename
                    id
                    name
                    dataType
                  }
                }
              }
              items(first: $itemsLimit) {
                nodes {
                  id
                  content {
                    ... on Issue {
                      __typename
                      number
                      title
                      state
                      url
                      assignees(first: 10) { nodes { login } }
                      labels(first: 10) { nodes { name } }
                    }
                    ... on PullRequest {
                      __typename
                      number
                      title
                      state
                      url
                      assignees(first: 10) { nodes { login } }
                      labels(first: 10) { nodes { name } }
                    }
                    ... on DraftIssue {
                      __typename
                      title
                    }
                  }
                  fieldValues(first: 20) {
                    nodes {
                      ... on ProjectV2ItemFieldSingleSelectValue {
                        __typename
                        name
                        field { ... on ProjectV2SingleSelectField { name } }
                      }
                      ... on ProjectV2ItemFieldTextValue {
                        __typename
                        text
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldNumberValue {
                        __typename
                        number
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldDateValue {
                        __typename
                        date
                        field { ... on ProjectV2Field { name } }
                      }
                      ... on ProjectV2ItemFieldIterationValue {
                        __typename
                        title
                        field { ... on ProjectV2IterationField { name } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      variables = {
        projectId,
        itemsLimit: limit,
      };
    }

    const response = await ghApi<GraphQLResponse>("graphql", {
      method: "POST",
      body: { query, variables },
    });

    if (response.errors && response.errors.length > 0) {
      console.log(`GraphQL errors: ${response.errors.map((e) => e.message).join(", ")}`);
      return { markdown: "", count: 0 };
    }

    // Extract project data from response
    let projectData: GraphQLResponse["data"]["repository"] extends undefined
      ? never
      : NonNullable<GraphQLResponse["data"]["repository"]>["projectV2"];

    if (projectNumber) {
      projectData = response.data.repository?.projectV2 || null;
      // If not found in repository, try organization
      if (!projectData && response.data.organization) {
        projectData = response.data.organization.projectV2;
      }
    } else {
      // For node ID query, the data is at data.node
      const nodeData = (response.data as { node?: typeof projectData }).node;
      projectData = nodeData || null;
    }

    if (!projectData) {
      console.log("Project not found");
      return { markdown: "", count: 0 };
    }

    // Parse fields
    const fields: GitHubProjectField[] = includeFields
      ? projectData.fields.nodes
          .filter((f): f is ProjectField => f !== null)
          .map((field) => {
            if (field.__typename === "ProjectV2SingleSelectField") {
              return {
                id: field.id,
                name: field.name,
                dataType: "single_select" as const,
                options: field.options.map((o) => ({ id: o.id, name: o.name })),
              };
            }
            if (field.__typename === "ProjectV2IterationField") {
              return {
                id: field.id,
                name: field.name,
                dataType: "iteration" as const,
              };
            }
            return {
              id: field.id,
              name: field.name,
              dataType: (field.dataType?.toLowerCase() || "text") as GitHubProjectField["dataType"],
            };
          })
      : [];

    // Parse items
    let items: GitHubProjectItem[] = includeItems
      ? projectData.items.nodes
          .filter((item): item is ProjectItem => item !== null)
          .map((item) => {
            const content = item.content;
            const fieldValues: GitHubProjectItemFieldValue[] = item.fieldValues.nodes
              .filter((fv): fv is FieldValue => fv !== null && fv.__typename !== undefined)
              .map((fv) => {
                let value: string | number | null = null;
                const fieldName = fv.field?.name || "Unknown";

                if (fv.__typename === "ProjectV2ItemFieldSingleSelectValue") {
                  value = fv.name;
                } else if (fv.__typename === "ProjectV2ItemFieldTextValue") {
                  value = fv.text;
                } else if (fv.__typename === "ProjectV2ItemFieldNumberValue") {
                  value = fv.number;
                } else if (fv.__typename === "ProjectV2ItemFieldDateValue") {
                  value = fv.date;
                } else if (fv.__typename === "ProjectV2ItemFieldIterationValue") {
                  value = fv.title;
                }

                return { fieldName, value };
              })
              .filter((fv) => fv.value !== null);

            const assignees: string[] = [];
            const labels: string[] = [];

            if (content) {
              if (content.__typename === "Issue" || content.__typename === "PullRequest") {
                assignees.push(...content.assignees.nodes.map((a) => a.login));
                labels.push(...content.labels.nodes.map((l) => l.name));
              }
            }

            return {
              id: item.id,
              contentType: (content?.__typename ||
                "DraftIssue") as GitHubProjectItem["contentType"],
              contentNumber:
                content && content.__typename !== "DraftIssue" ? content.number : undefined,
              contentTitle: content?.title,
              contentState:
                content && content.__typename !== "DraftIssue" ? content.state : undefined,
              contentUrl: content && content.__typename !== "DraftIssue" ? content.url : undefined,
              assignees,
              labels,
              fieldValues,
            };
          })
      : [];

    // Apply filters
    if (config.filters) {
      if (config.filters.status && config.filters.status.length > 0) {
        items = items.filter((item) => {
          const statusField = item.fieldValues.find(
            (fv) => fv.fieldName.toLowerCase() === "status",
          );
          return statusField && config.filters?.status?.includes(statusField.value as string);
        });
      }

      if (config.filters.assignee && config.filters.assignee.length > 0) {
        items = items.filter((item) =>
          item.assignees.some((a) => config.filters?.assignee?.includes(a)),
        );
      }

      if (config.filters.labels && config.filters.labels.length > 0) {
        items = items.filter((item) =>
          item.labels.some((l) => config.filters?.labels?.includes(l)),
        );
      }
    }

    // Calculate status distribution
    const itemsByStatus: Record<string, number> = {};
    for (const item of items) {
      const statusField = item.fieldValues.find((fv) => fv.fieldName.toLowerCase() === "status");
      const status = (statusField?.value as string) || "No Status";
      itemsByStatus[status] = (itemsByStatus[status] || 0) + 1;
    }

    const project: GitHubProject = {
      id: projectData.id,
      number: projectData.number,
      title: projectData.title,
      description: projectData.shortDescription || undefined,
      url: projectData.url,
      fields,
      items,
      itemsByStatus,
      totalItems: items.length,
    };

    const markdown = formatProjectMarkdown(project, includeFields, includeItems);
    return { markdown, count: items.length };
  } catch (error) {
    console.log("Failed to collect project context");
    console.error(error);
    return { markdown: "", count: 0 };
  }
}

function formatProjectMarkdown(
  project: GitHubProject,
  includeFields: boolean,
  includeItems: boolean,
): string {
  const lines = [`## Project: ${project.title}`, ""];

  if (project.description) {
    lines.push(`*${project.description}*`, "");
  }

  lines.push(`**URL:** ${project.url}`, "");

  // Fields section
  if (includeFields && project.fields.length > 0) {
    lines.push("### Fields", "");

    for (const field of project.fields) {
      if (field.options && field.options.length > 0) {
        lines.push(`- **${field.name}**: ${field.options.map((o) => o.name).join(", ")}`);
      } else {
        lines.push(`- **${field.name}** (${field.dataType})`);
      }
    }
    lines.push("");
  }

  // Items summary by status
  if (Object.keys(project.itemsByStatus).length > 0) {
    lines.push(`### Items (${project.totalItems} total)`, "");
    lines.push("#### By Status", "");

    for (const [status, count] of Object.entries(project.itemsByStatus)) {
      lines.push(`- ${status}: ${count} item${count === 1 ? "" : "s"}`);
    }
    lines.push("");
  }

  // Recent items
  if (includeItems && project.items.length > 0) {
    lines.push("#### Recent Items", "");

    for (const item of project.items.slice(0, 20)) {
      const typeIcon =
        item.contentType === "Issue" ? "📋" : item.contentType === "PullRequest" ? "🔀" : "📝";
      const numberStr = item.contentNumber ? `#${item.contentNumber}` : "";

      lines.push(`**${typeIcon} ${numberStr} ${item.contentTitle || "Untitled"}**`);

      // Show field values
      const fieldLines: string[] = [];
      for (const fv of item.fieldValues) {
        if (fv.value !== null) {
          fieldLines.push(`${fv.fieldName}: ${fv.value}`);
        }
      }

      if (item.assignees.length > 0) {
        fieldLines.push(`Assignee: @${item.assignees.join(", @")}`);
      }

      if (fieldLines.length > 0) {
        lines.push(`- ${fieldLines.join(" | ")}`);
      }

      if (item.contentUrl) {
        lines.push(`- URL: ${item.contentUrl}`);
      }

      lines.push("");
    }
  }

  return lines.join("\n");
}
