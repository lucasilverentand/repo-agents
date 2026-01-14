import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const SCHEMA_URL = 'https://json.schemastore.org/github-workflow.json';
const SCHEMA_CACHE_PATH = join(tmpdir(), 'repo-agents-workflow-schema.json');

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

class WorkflowValidator {
  private ajv: Ajv;
  private schema: object | null = null;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(this.ajv);
  }

  /**
   * Validate that a cached schema looks like the real SchemaStore schema.
   * This prevents using corrupted or placeholder schemas.
   */
  private isValidSchema(schema: unknown): boolean {
    if (typeof schema !== 'object' || schema === null) return false;
    const s = schema as Record<string, unknown>;

    // Check for key indicators of the real SchemaStore schema
    // The real schema has definitions with many events, not just a few
    const definitions = s.definitions as Record<string, unknown> | undefined;
    if (!definitions) return false;

    const event = definitions.event as Record<string, unknown> | undefined;
    if (!event) return false;

    // The real schema has 30+ events in the enum
    const eventEnum = event.enum as string[] | undefined;
    if (!eventEnum || eventEnum.length < 20) return false;

    // Check for some specific events that should be present
    const requiredEvents = ['issues', 'pull_request', 'push', 'workflow_dispatch', 'discussion'];
    return requiredEvents.every((e) => eventEnum.includes(e));
  }

  /**
   * Fetch the GitHub workflow schema from SchemaStore.
   * Uses a local cache to avoid repeated network requests.
   */
  private async fetchSchema(): Promise<object> {
    if (this.schema) {
      return this.schema;
    }

    // Try to load from cache first
    try {
      const cached = await readFile(SCHEMA_CACHE_PATH, 'utf-8');
      const parsedCache = JSON.parse(cached) as object;

      // Validate the cached schema is the real SchemaStore schema
      if (this.isValidSchema(parsedCache)) {
        this.schema = parsedCache;
        return this.schema;
      }
      // Invalid cache, will fetch fresh below
    } catch {
      // Cache miss or read error, fetch from network
    }

    // Fetch from SchemaStore
    const response = await fetch(SCHEMA_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow schema: ${response.statusText}`);
    }

    this.schema = (await response.json()) as object;

    // Cache for future use
    try {
      await writeFile(SCHEMA_CACHE_PATH, JSON.stringify(this.schema, null, 2), 'utf-8');
    } catch {
      // Ignore cache write errors
    }

    return this.schema;
  }

  /**
   * Validate a workflow YAML string against the GitHub Actions workflow schema.
   * @param workflowYaml The workflow YAML string to validate
   * @returns Array of validation errors, or empty array if valid
   */
  async validateWorkflow(workflowYaml: string): Promise<ValidationError[]> {
    // Parse YAML to JSON
    let workflowJson: unknown;
    try {
      workflowJson = yaml.load(workflowYaml);
    } catch (error) {
      return [
        {
          path: 'yaml',
          message: `Invalid YAML: ${(error as Error).message}`,
        },
      ];
    }

    // Fetch schema
    const schema = await this.fetchSchema();

    // Validate
    const validate = this.ajv.compile(schema);
    const valid = validate(workflowJson);

    if (valid) {
      return [];
    }

    // Convert Ajv errors to our format
    return this.formatErrors(validate.errors || []);
  }

  /**
   * Format Ajv validation errors into a more readable format
   */
  private formatErrors(errors: ErrorObject[]): ValidationError[] {
    return errors.map((error) => {
      const path = error.instancePath || '/';
      const message = this.formatErrorMessage(error);

      return {
        path: path.replace(/^\//, '').replace(/\//g, '.') || 'root',
        message,
        value: error.data,
      };
    });
  }

  private formatErrorMessage(error: ErrorObject): string {
    const baseMessage = error.message || 'Validation error';

    switch (error.keyword) {
      case 'additionalProperties':
        if (error.params.additionalProperty) {
          return `Unknown property '${error.params.additionalProperty}'`;
        }
        return baseMessage;
      case 'required':
        if (error.params.missingProperty) {
          return `Missing required property '${error.params.missingProperty}'`;
        }
        return baseMessage;
      case 'enum':
        return `${baseMessage}. Allowed values: ${error.params.allowedValues?.join(', ')}`;
      case 'type':
        return `${baseMessage} (expected ${error.params.type})`;
      default:
        return baseMessage;
    }
  }
}

export const workflowValidator = new WorkflowValidator();
