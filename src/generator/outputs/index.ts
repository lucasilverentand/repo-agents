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

// Import all handlers to register them (after registry is exported)
import './add-comment';
import './add-label';
import './remove-label';
import './create-issue';
import './create-pr';
import './update-file';
import './close-issue';
import './close-pr';
