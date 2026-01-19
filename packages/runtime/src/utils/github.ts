import type { GitHubIssue, GitHubPullRequest } from "@repo-agents/types";
import { $ } from "bun";

export interface GitHubApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Make a GitHub API request using the gh CLI
 */
export async function ghApi<T>(endpoint: string, options?: GitHubApiOptions): Promise<T> {
  const args: string[] = ["api", endpoint];

  if (options?.method) {
    args.push("--method", options.method);
  }

  if (options?.body) {
    args.push("--input", "-");
  }

  try {
    let result: { stdout: Buffer; exitCode: number };

    if (options?.body) {
      const input = JSON.stringify(options.body);
      result = await $`gh ${args} <<< ${input}`.quiet();
    } else {
      result = await $`gh ${args}`.quiet();
    }

    const output = result.stdout.toString().trim();
    if (!output) {
      return {} as T;
    }

    return JSON.parse(output) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GitHub API request failed: ${error.message}`);
    }
    throw error;
  }
}

export type RepositoryPermission = "admin" | "write" | "read" | "none";

/**
 * Get the permission level for a user in a repository
 */
export async function getRepositoryPermission(
  owner: string,
  repo: string,
  username: string,
): Promise<RepositoryPermission> {
  try {
    const response = await ghApi<{ permission: string }>(
      `repos/${owner}/${repo}/collaborators/${username}/permission`,
    );

    const permission = response.permission;
    if (permission === "admin" || permission === "write" || permission === "read") {
      return permission;
    }
    return "none";
  } catch {
    return "none";
  }
}

/**
 * Check if a user is a member of an organization
 */
export async function isOrgMember(org: string, username: string): Promise<boolean> {
  try {
    // This endpoint returns 204 if user is a member, 404 if not
    await $`gh api orgs/${org}/members/${username} --silent`.quiet();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an issue by number
 */
export async function getIssue(owner: string, repo: string, number: number): Promise<GitHubIssue> {
  const response = await ghApi<{
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
  }>(`repos/${owner}/${repo}/issues/${number}`);

  return {
    number: response.number,
    title: response.title,
    state: response.state,
    author: response.user.login,
    url: response.html_url,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    labels: response.labels.map((l) => l.name),
    assignees: response.assignees.map((a) => a.login),
    body: response.body ?? undefined,
  };
}

/**
 * Get a pull request by number
 */
export async function getPullRequest(
  owner: string,
  repo: string,
  number: number,
): Promise<GitHubPullRequest> {
  const response = await ghApi<{
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
  }>(`repos/${owner}/${repo}/pulls/${number}`);

  return {
    number: response.number,
    title: response.title,
    state: response.state,
    author: response.user.login,
    url: response.html_url,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    mergedAt: response.merged_at ?? undefined,
    labels: response.labels.map((l) => l.name),
    assignees: response.assignees.map((a) => a.login),
    reviewers: response.requested_reviewers.map((r) => r.login),
    baseBranch: response.base.ref,
    headBranch: response.head.ref,
    body: response.body ?? undefined,
  };
}

/**
 * Parse a repository string (owner/repo) into its components
 */
export function parseRepository(repo: string): { owner: string; repo: string } {
  const parts = repo.split("/");
  if (parts.length !== 2) {
    throw new Error(`Invalid repository format: ${repo}. Expected 'owner/repo'.`);
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Check if a user is a member of a team
 */
export async function isTeamMember(org: string, team: string, username: string): Promise<boolean> {
  try {
    const response = await ghApi<{ state: string }>(
      `orgs/${org}/teams/${team}/memberships/${username}`,
    );
    return response.state === "active";
  } catch {
    return false;
  }
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
}

/**
 * Count open PRs created by a specific author (or the agent) with a specific label
 */
export async function countOpenPRs(
  owner: string,
  repo: string,
  label?: string,
): Promise<number> {
  try {
    // Search for open PRs in this repo
    // If label is provided, filter by label
    let query = `repo:${owner}/${repo} is:pr is:open`;
    if (label) {
      query += ` label:"${label}"`;
    }

    const response = await ghApi<{ total_count: number }>(
      `search/issues?q=${encodeURIComponent(query)}`,
    );

    return response.total_count;
  } catch (error) {
    console.warn("Failed to count open PRs:", error);
    return 0;
  }
}

/**
 * Get recent workflow runs for a specific workflow
 */
export async function getRecentWorkflowRuns(
  owner: string,
  repo: string,
  workflowName: string,
  limit = 5,
): Promise<WorkflowRun[]> {
  try {
    const response = await ghApi<{ workflow_runs: WorkflowRun[] }>(
      `repos/${owner}/${repo}/actions/runs`,
    );

    // Filter by workflow name and completed status
    const filtered = response.workflow_runs
      .filter(
        (run) =>
          run.name === workflowName && run.status === "completed" && run.conclusion === "success",
      )
      .slice(0, limit);

    return filtered;
  } catch {
    return [];
  }
}
