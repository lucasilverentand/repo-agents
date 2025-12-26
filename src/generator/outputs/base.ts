import type { OutputConfig } from '../../types/index';

/**
 * Runtime context available when generating output handler scripts
 */
export interface RuntimeContext {
  /** GitHub repository in format "owner/repo" */
  repository: string;
  /** Issue number if triggered by issue event */
  issueNumber?: string;
  /** Pull request number if triggered by PR event */
  prNumber?: string;
  /**
   * Combined issue or PR number for use in bash scripts.
   * Uses concatenation of both template strings so the correct one
   * is used at workflow runtime (whichever is non-empty).
   */
  issueOrPrNumber: string;
  /** Allowed paths glob patterns for file operations */
  allowedPaths?: string[];
}

/**
 * Base interface for output handlers
 * Each output type (add-comment, add-label, etc.) implements this interface
 */
export interface OutputHandler {
  /**
   * The output type name (e.g., 'add-comment', 'create-pr')
   */
  name: string;

  /**
   * Returns bash script to fetch dynamic context and append to context file
   * @param runtime - Runtime context with repository, issue/PR numbers, etc.
   * @returns Bash script string or null if no dynamic context needed
   *
   * The script should append to /tmp/context.txt in markdown format
   * Example: Fetch available labels from GitHub API
   */
  getContextScript(runtime: RuntimeContext): string | null;

  /**
   * Returns Claude skill markdown for creating the output file
   * @param config - Output configuration from agent definition
   * @returns Markdown content describing how to create the output file
   *
   * Should include:
   * - Skill description
   * - File path to write (/tmp/outputs/<output-type>.json)
   * - JSON schema
   * - Constraints (max, etc.)
   * - Example usage
   */
  generateSkill(config: OutputConfig): string;

  /**
   * Returns bash script to validate output file and execute GitHub operation
   * @param config - Output configuration from agent definition
   * @returns Bash script that validates and executes the output
   *
   * The script should:
   * 1. Check if output file exists in /tmp/outputs/
   * 2. Validate JSON structure
   * 3. Validate business logic
   * 4. Write errors to /tmp/validation-errors/<output-type>.txt if validation fails
   * 5. Execute GitHub operation via gh CLI if validation passes
   */
  generateValidationScript(config: OutputConfig, runtime: RuntimeContext): string;
}
