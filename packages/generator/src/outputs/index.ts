import type { Output } from "@repo-agents/types";
import type { OutputHandler } from "./base";

/**
 * Registry mapping output types to their handlers
 */
class OutputHandlerRegistry {
  private handlers: Map<Output, OutputHandler> = new Map();

  /**
   * Register a handler for an output type
   */
  register(output: Output, handler: OutputHandler): void {
    this.handlers.set(output, handler);
  }

  /**
   * Get handler for an output type
   * @throws Error if handler not found
   */
  getHandler(output: Output): OutputHandler {
    const handler = this.handlers.get(output);
    if (!handler) {
      throw new Error(`No handler registered for output type: ${output}`);
    }
    return handler;
  }

  /**
   * Check if handler exists for an output type
   */
  hasHandler(output: Output): boolean {
    return this.handlers.has(output);
  }

  /**
   * Get all registered output types
   */
  getRegisteredOutputs(): Output[] {
    return Array.from(this.handlers.keys());
  }
}

// Create singleton instance
export const registry = new OutputHandlerRegistry();

/**
 * Get handler for an output type
 * @throws Error if handler not found
 */
export function getOutputHandler(output: Output): OutputHandler {
  return registry.getHandler(output);
}

import { handler as addCommentHandler } from "./add-comment";
import { handler as addLabelHandler } from "./add-label";
import { handler as addReactionHandler } from "./add-reaction";
import { handler as addToProjectHandler } from "./add-to-project";
import { handler as approvePrHandler } from "./approve-pr";
import { handler as archiveProjectItemHandler } from "./archive-project-item";
import { handler as assignIssueHandler } from "./assign-issue";
import { handler as closeIssueHandler } from "./close-issue";
import { handler as closePrHandler } from "./close-pr";
import { handler as convertToDiscussionHandler } from "./convert-to-discussion";
import { handler as copyProjectHandler } from "./copy-project";
import { handler as createBranchHandler } from "./create-branch";
import { handler as createDiscussionHandler } from "./create-discussion";
import { handler as createIssueHandler } from "./create-issue";
import { handler as createPrHandler } from "./create-pr";
import { handler as createReleaseHandler } from "./create-release";
import { handler as deleteBranchHandler } from "./delete-branch";
import { handler as editIssueHandler } from "./edit-issue";
import { handler as linkProjectHandler } from "./link-project";
import { handler as lockConversationHandler } from "./lock-conversation";
import { handler as manageLabelsHandler } from "./manage-labels";
import { handler as manageProjectHandler } from "./manage-project";
import { handler as manageProjectFieldHandler } from "./manage-project-field";
import { handler as markTemplateHandler } from "./mark-template";
import { handler as mergePrHandler } from "./merge-pr";
import { handler as pinIssueHandler } from "./pin-issue";
import { handler as removeFromProjectHandler } from "./remove-from-project";
import { handler as removeLabelHandler } from "./remove-label";
import { handler as reopenIssueHandler } from "./reopen-issue";
import { handler as requestReviewHandler } from "./request-review";
import { handler as setMilestoneHandler } from "./set-milestone";
import { handler as triggerWorkflowHandler } from "./trigger-workflow";
import { handler as updateFileHandler } from "./update-file";
import { handler as updateProjectFieldHandler } from "./update-project-field";

registry.register("add-comment", addCommentHandler);
registry.register("add-label", addLabelHandler);
registry.register("add-to-project", addToProjectHandler);
registry.register("archive-project-item", archiveProjectItemHandler);
registry.register("close-issue", closeIssueHandler);
registry.register("close-pr", closePrHandler);
registry.register("convert-to-discussion", convertToDiscussionHandler);
registry.register("copy-project", copyProjectHandler);
registry.register("create-branch", createBranchHandler);
registry.register("create-discussion", createDiscussionHandler);
registry.register("create-issue", createIssueHandler);
registry.register("create-pr", createPrHandler);
registry.register("create-release", createReleaseHandler);
registry.register("delete-branch", deleteBranchHandler);
registry.register("edit-issue", editIssueHandler);
registry.register("link-project", linkProjectHandler);
registry.register("lock-conversation", lockConversationHandler);
registry.register("manage-labels", manageLabelsHandler);
registry.register("manage-project", manageProjectHandler);
registry.register("manage-project-field", manageProjectFieldHandler);
registry.register("mark-template", markTemplateHandler);
registry.register("merge-pr", mergePrHandler);
registry.register("pin-issue", pinIssueHandler);
registry.register("remove-from-project", removeFromProjectHandler);
registry.register("remove-label", removeLabelHandler);
registry.register("reopen-issue", reopenIssueHandler);
registry.register("request-review", requestReviewHandler);
registry.register("set-milestone", setMilestoneHandler);
registry.register("trigger-workflow", triggerWorkflowHandler);
registry.register("update-file", updateFileHandler);
registry.register("update-project-field", updateProjectFieldHandler);
registry.register("add-reaction", addReactionHandler);
registry.register("assign-issue", assignIssueHandler);
registry.register("approve-pr", approvePrHandler);
