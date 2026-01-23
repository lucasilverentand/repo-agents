import { agentParser } from "@repo-agents/parser";
import type { AgentDefinition } from "@repo-agents/types";
import type { StageResult } from "../../types";
import { writeArtifact } from "../../utils/artifacts";
import {
  createInitialProgressState,
  createProgressComment,
  parseRepository,
} from "../../utils/index";
import type { PermissionIssue, ValidationContext, ValidationStatus } from "../../utils/validation";
import {
  checkBlockingIssues,
  checkBotActor,
  checkMaxOpenPRs,
  checkRateLimit,
  checkTriggerLabels,
  checkUserAuthorization,
  getEventPayload,
  getIssueOrPRNumber,
} from "../../utils/validation";

/**
 * Unified validate stage: Per-agent validation before execution.
 *
 * This replaces the dispatcher dispatch job. It runs in a GitHub Actions matrix
 * (one per matching agent) and performs all validation checks:
 *
 * 1. Load and validate agent definition
 * 2. Check if actor is a bot (prevents recursive loops)
 * 3. Check user authorization (repo permission, org membership, allowed lists)
 * 4. Check trigger labels (if configured)
 * 5. Check rate limiting (time since last successful run)
 * 6. Check max open PRs limit (if configured)
 * 7. Check blocking issues (if configured)
 * 8. Create progress comment (if enabled)
 * 9. Get target issue/PR number for outputs
 * 10. Encode event payload for agent context
 *
 * Outputs:
 * - should-run: "true" if all checks pass, "false" otherwise
 * - skip-reason: Reason for skipping (if should-run is false)
 * - bot-triggered: "true" if skipped because actor is a bot
 * - rate-limited: "true" if skipped due to rate limit
 * - pr-limited: "true" if skipped due to max open PRs
 * - blocked-by-issues: "true" if skipped due to blocking issues
 * - progress-comment-id: ID of progress comment (if created)
 * - progress-issue-number: Issue/PR number for progress comment
 * - target-issue-number: Issue/PR number for outputs
 * - event-payload: Base64-encoded event payload for agent context
 *
 * Creates validation audit artifact for tracking.
 */
export async function runUnifiedValidate(ctx: {
  github: {
    actor: string;
    repository: string;
    eventName: string;
    eventPath: string;
    runId: number;
    serverUrl: string;
  };
  options?: {
    agentPath?: string;
  };
}): Promise<StageResult> {
  const validationStatus: ValidationStatus = {
    agent_loaded: false,
    bot_actor_check: false,
    user_authorization: false,
    labels_check: false,
    rate_limit_check: false,
    max_open_prs_check: false,
    blocking_issues_check: false,
  };
  const permissionIssues: PermissionIssue[] = [];

  const outputs: Record<string, string> = {
    "should-run": "false",
    "bot-triggered": "false",
    "rate-limited": "false",
    "pr-limited": "false",
    "blocked-by-issues": "false",
  };

  try {
    // Step 1: Load and validate agent definition
    const agentPath = ctx.options?.agentPath;
    if (!agentPath) {
      throw new Error("Agent path is required");
    }

    const agent = await loadAgent(agentPath);
    validationStatus.agent_loaded = true;
    console.log(`✓ Loaded agent: ${agent.name}`);

    // Build validation context
    const validationContext: ValidationContext = {
      github: ctx.github,
      options: ctx.options,
    };

    // Step 2: Check if actor is a bot (prevents recursive loops)
    const botActorResult = await checkBotActor(validationContext, agent);
    if (!botActorResult.allowed) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "validation_error",
        severity: "warning",
        message: "Bot actor detected - skipping to prevent recursive loops",
        context: {
          actor: ctx.github.actor,
          isBot: botActorResult.isBot,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = botActorResult.reason ?? "Bot actor not allowed";
      outputs["bot-triggered"] = "true";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.bot_actor_check = true;
    console.log(`✓ Bot actor check passed: ${ctx.github.actor}`);

    // Step 3: Check user authorization (human users only at this point)
    const authResult = await checkUserAuthorization(validationContext, agent);
    if (!authResult.authorized) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "missing_permission",
        severity: "error",
        message: "User not authorized to trigger agent",
        context: {
          user: ctx.github.actor,
          permission: authResult.permission,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = authResult.reason ?? "User not authorized";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.user_authorization = true;
    console.log(`✓ User authorized: ${ctx.github.actor}`);

    // Step 4: Check trigger labels (if configured)
    const labelsResult = await checkTriggerLabels(validationContext, agent);
    if (!labelsResult.valid) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "validation_error",
        severity: "warning",
        message: "Required trigger labels not present",
        context: {
          required: agent.trigger_labels,
          present: labelsResult.presentLabels,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = labelsResult.reason ?? "Required labels not present";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.labels_check = true;
    console.log("✓ Trigger labels check passed");

    // Step 5: Check rate limiting
    const rateLimitResult = await checkRateLimit(validationContext, agent);
    if (!rateLimitResult.allowed) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "rate_limit",
        severity: "warning",
        message: "Rate limit exceeded",
        context: {
          lastRun: rateLimitResult.lastRun,
          limitMinutes: agent.rate_limit_minutes ?? 5,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = rateLimitResult.reason ?? "Rate limit exceeded";
      outputs["rate-limited"] = "true";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.rate_limit_check = true;
    console.log("✓ Rate limit check passed");

    // Step 6: Check max open PRs limit (if configured)
    const maxOpenPrsResult = await checkMaxOpenPRs(validationContext, agent);
    if (!maxOpenPrsResult.allowed) {
      // Silently skip - no comment, just don't run. Will retry on PR close/merge.
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] = maxOpenPrsResult.reason ?? "Max open PRs limit reached";
      outputs["pr-limited"] = "true";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.max_open_prs_check = true;
    console.log("✓ Max open PRs check passed");

    // Step 7: Check for blocking issues (if configured)
    const blockingIssuesResult = await checkBlockingIssues(validationContext, agent);
    if (!blockingIssuesResult.allowed) {
      permissionIssues.push({
        timestamp: new Date().toISOString(),
        issue_type: "validation_error",
        severity: "warning",
        message: "Issue has open blocking dependencies",
        context: {
          blockers: blockingIssuesResult.blockers,
          blockingCount: blockingIssuesResult.blockingCount,
        },
      });
      await writeAuditData(validationStatus, permissionIssues, agent.name);
      outputs["skip-reason"] =
        blockingIssuesResult.reason ?? "Issue has open blocking dependencies";
      outputs["blocked-by-issues"] = "true";
      await writeValidationResult(outputs);
      return {
        success: true, // Not an error, just skipped
        outputs,
      };
    }
    validationStatus.blocking_issues_check = true;
    console.log("✓ Blocking issues check passed");

    // All checks passed
    await writeAuditData(validationStatus, permissionIssues, agent.name);

    // Always get the target issue/PR number for outputs to use
    const targetNumber = await getIssueOrPRNumber(validationContext);
    if (targetNumber) {
      outputs["target-issue-number"] = String(targetNumber);
    }

    // Get the full event payload for agent stage context
    const eventPayload = await getEventPayload(validationContext);
    if (eventPayload) {
      outputs["event-payload"] = eventPayload;
    }

    // Create progress comment if enabled for this agent
    const progressCommentResult = await createProgressCommentIfEnabled(ctx, agent);
    if (progressCommentResult.created) {
      outputs["progress-comment-id"] = String(progressCommentResult.commentId);
      outputs["progress-issue-number"] = String(progressCommentResult.issueNumber);
      console.log(`✓ Created progress comment #${progressCommentResult.commentId}`);
    }

    outputs["should-run"] = "true";
    console.log(`✓ All validation checks passed for ${agent.name}`);

    // Write validation result to artifact for execution job to consume
    await writeValidationResult(outputs);

    return {
      success: true,
      outputs,
    };
  } catch (error) {
    console.error("Validation failed:", error);
    permissionIssues.push({
      timestamp: new Date().toISOString(),
      issue_type: "validation_error",
      severity: "error",
      message: `Validation error: ${(error as Error).message}`,
    });
    await writeAuditData(validationStatus, permissionIssues, "unknown");
    outputs["skip-reason"] = `Validation error: ${(error as Error).message}`;

    // Write validation result to artifact even on error
    await writeValidationResult(outputs);

    return {
      success: false,
      outputs,
    };
  }
}

/**
 * Load and validate agent definition.
 */
async function loadAgent(agentPath: string): Promise<AgentDefinition> {
  const { agent, errors } = await agentParser.parseFile(agentPath);

  if (errors.length > 0) {
    throw new Error(`Agent validation failed: ${errors[0].message}`);
  }

  if (!agent) {
    throw new Error("Failed to parse agent definition");
  }

  return agent;
}

/**
 * Write validation audit data.
 */
async function writeAuditData(
  validationStatus: ValidationStatus,
  permissionIssues: PermissionIssue[],
  agentName: string,
): Promise<void> {
  const auditData = {
    timestamp: new Date().toISOString(),
    agent: agentName,
    validation: validationStatus,
    issues: permissionIssues,
  };

  await writeArtifact("validation-audit", "audit.json", JSON.stringify(auditData, null, 2));
}

/**
 * Write validation result outputs for consumption by execution job.
 * GitHub Actions matrix jobs cannot export outputs, so we write to artifact instead.
 */
async function writeValidationResult(outputs: Record<string, string>): Promise<void> {
  const result = {
    should_run: outputs["should-run"] === "true",
    skip_reason: outputs["skip-reason"] || null,
    bot_triggered: outputs["bot-triggered"] === "true",
    rate_limited: outputs["rate-limited"] === "true",
    pr_limited: outputs["pr-limited"] === "true",
    blocked_by_issues: outputs["blocked-by-issues"] === "true",
    progress_comment_id: outputs["progress-comment-id"] || null,
    progress_issue_number: outputs["progress-issue-number"] || null,
    target_issue_number: outputs["target-issue-number"] || null,
    event_payload: outputs["event-payload"] || null,
  };

  await writeArtifact("validation-audit", "result.json", JSON.stringify(result, null, 2));
}

/**
 * Create progress comment if enabled for this agent.
 */
async function createProgressCommentIfEnabled(
  ctx: {
    github: {
      repository: string;
      runId: number;
      serverUrl: string;
      eventPath: string;
    };
  },
  agent: AgentDefinition,
): Promise<{ created: boolean; commentId?: number; issueNumber?: number }> {
  // Check if progress comments should be enabled
  const shouldUseProgress =
    agent.progress_comment !== undefined
      ? agent.progress_comment
      : !!(agent.on.issues || agent.on.pull_request);

  if (!shouldUseProgress) {
    return { created: false };
  }

  // Get issue/PR number from event
  const validationContext: ValidationContext = {
    github: {
      actor: "",
      repository: ctx.github.repository,
      eventName: "",
      eventPath: ctx.github.eventPath,
      runId: ctx.github.runId,
      serverUrl: ctx.github.serverUrl,
    },
  };

  const issueNumber = await getIssueOrPRNumber(validationContext);
  if (!issueNumber) {
    console.log("Progress comment: No issue/PR number found, skipping");
    return { created: false };
  }

  const { owner, repo } = parseRepository(ctx.github.repository);
  const hasContext = !!agent.context;

  // Create initial progress state
  const workflowRunUrl = `${ctx.github.serverUrl}/${ctx.github.repository}/actions/runs/${ctx.github.runId}`;
  const state = createInitialProgressState(
    agent.name,
    String(ctx.github.runId),
    workflowRunUrl,
    hasContext,
  );

  try {
    const comment = await createProgressComment(owner, repo, issueNumber, state);

    return {
      created: true,
      commentId: comment.id,
      issueNumber,
    };
  } catch (error) {
    console.warn("Failed to create progress comment:", error);
    return { created: false };
  }
}
