import type { Output } from '../../types/index';
import type { OutputHandler } from './base';

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

// Import all handlers
import { addCommentHandler } from './add-comment';
import { handler as addLabelHandler } from './add-label';
import { handler as removeLabelHandler } from './remove-label';
import { handler as createIssueHandler } from './create-issue';
import { handler as createDiscussionHandler } from './create-discussion';
import { handler as createPrHandler } from './create-pr';
import { handler as updateFileHandler } from './update-file';
import { handler as closeIssueHandler } from './close-issue';
import { handler as closePrHandler } from './close-pr';

// Register all handlers
registry.register('add-comment', addCommentHandler);
registry.register('add-label', addLabelHandler);
registry.register('remove-label', removeLabelHandler);
registry.register('create-issue', createIssueHandler);
registry.register('create-discussion', createDiscussionHandler);
registry.register('create-pr', createPrHandler);
registry.register('update-file', updateFileHandler);
registry.register('close-issue', closeIssueHandler);
registry.register('close-pr', closePrHandler);
