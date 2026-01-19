import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { StageResult } from "../../types";
import type { DispatchContext, DispatcherContext } from "./types";

/**
 * Prepare context stage: Extracts and normalizes GitHub event data.
 *
 * Reads GITHUB_EVENT_PATH and extracts:
 * 1. Base context (dispatch ID, timestamps, repository info)
 * 2. Event-specific data (issue, PR, discussion, schedule, repository_dispatch)
 *
 * Writes normalized context to /tmp/dispatch-context/context.json for artifact upload.
 */
export async function runPrepareContext(ctx: DispatcherContext): Promise<StageResult> {
  try {
    // Read event payload
    const eventPayload = await readEventPayload(ctx.github.eventPath);

    // Build base context
    const context: DispatchContext = {
      dispatchId: `${ctx.github.runId}-${ctx.github.runAttempt}`,
      dispatchedAt: new Date().toISOString(),
      dispatcherRunId: ctx.github.runId,
      dispatcherRunUrl: `${ctx.github.serverUrl}/${ctx.github.repository}/actions/runs/${ctx.github.runId}`,
      eventName: ctx.github.eventName,
      eventAction: ctx.github.eventAction,
      repository: ctx.github.repository,
      ref: ctx.github.ref,
      sha: ctx.github.sha,
      actor: ctx.github.actor,
    };

    // Add event-specific data
    switch (ctx.github.eventName) {
      case "issues":
        context.issue = extractIssueData(eventPayload);
        break;
      case "pull_request":
        context.pullRequest = extractPullRequestData(eventPayload);
        break;
      case "discussion":
        context.discussion = extractDiscussionData(eventPayload);
        break;
      case "schedule":
        context.schedule = extractScheduleData(eventPayload);
        break;
      case "repository_dispatch":
        context.repositoryDispatch = extractRepositoryDispatchData(eventPayload);
        break;
    }

    // Write context to file
    const contextPath = "/tmp/dispatch-context/context.json";
    await mkdir(dirname(contextPath), { recursive: true });
    await writeFile(contextPath, JSON.stringify(context, null, 2));

    console.log("Context prepared:");
    console.log(JSON.stringify(context, null, 2));

    return {
      success: true,
      outputs: {
        "run-id": ctx.github.runId,
      },
    };
  } catch (error) {
    console.error("Failed to prepare context:", error);
    return {
      success: false,
      outputs: {},
    };
  }
}

interface Label {
  name: string;
}

interface GitHubEventPayload {
  issue?: {
    number: number;
    title: string;
    body: string;
    user?: { login: string };
    labels?: Label[];
    state: string;
    html_url: string;
  };
  pull_request?: {
    number: number;
    title: string;
    body: string;
    user?: { login: string };
    labels?: Label[];
    base?: { ref: string };
    head?: { ref: string };
    state: string;
    html_url: string;
  };
  discussion?: {
    number: number;
    title: string;
    body: string;
    user?: { login: string };
    category?: { name: string };
    html_url: string;
  };
  schedule?: string;
  action?: string;
  client_payload?: unknown;
}

/**
 * Read and parse GitHub event payload.
 */
async function readEventPayload(eventPath: string): Promise<GitHubEventPayload> {
  const content = await readFile(eventPath, "utf-8");
  return JSON.parse(content) as GitHubEventPayload;
}

/**
 * Extract issue-specific data from event payload.
 */
function extractIssueData(payload: GitHubEventPayload) {
  return {
    number: payload.issue?.number ?? 0,
    title: payload.issue?.title ?? "",
    body: payload.issue?.body ?? "",
    author: payload.issue?.user?.login ?? "",
    labels: payload.issue?.labels?.map((l) => l.name) ?? [],
    state: payload.issue?.state ?? "",
    url: payload.issue?.html_url ?? "",
  };
}

/**
 * Extract pull request-specific data from event payload.
 */
function extractPullRequestData(payload: GitHubEventPayload) {
  return {
    number: payload.pull_request?.number ?? 0,
    title: payload.pull_request?.title ?? "",
    body: payload.pull_request?.body ?? "",
    author: payload.pull_request?.user?.login ?? "",
    labels: payload.pull_request?.labels?.map((l) => l.name) ?? [],
    baseBranch: payload.pull_request?.base?.ref ?? "",
    headBranch: payload.pull_request?.head?.ref ?? "",
    state: payload.pull_request?.state ?? "",
    url: payload.pull_request?.html_url ?? "",
  };
}

/**
 * Extract discussion-specific data from event payload.
 */
function extractDiscussionData(payload: GitHubEventPayload) {
  return {
    number: payload.discussion?.number ?? 0,
    title: payload.discussion?.title ?? "",
    body: payload.discussion?.body ?? "",
    author: payload.discussion?.user?.login ?? "",
    category: payload.discussion?.category?.name ?? "",
    url: payload.discussion?.html_url ?? "",
  };
}

/**
 * Extract schedule-specific data from event payload.
 */
function extractScheduleData(payload: GitHubEventPayload) {
  return {
    cron: payload.schedule ?? "",
  };
}

/**
 * Extract repository_dispatch-specific data from event payload.
 */
function extractRepositoryDispatchData(payload: GitHubEventPayload) {
  return {
    eventType: payload.action ?? "",
    clientPayload: payload.client_payload ?? {},
  };
}
