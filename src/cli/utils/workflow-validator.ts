import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const SCHEMA_URL = 'https://json.schemastore.org/github-workflow.json';
const SCHEMA_CACHE_PATH = join(tmpdir(), 'gh-claude-workflow-schema.json');

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
      this.schema = JSON.parse(cached) as object;
      return this.schema;
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
      let message = error.message || 'Validation error';

      // Add more context for specific error types
      if (error.keyword === 'additionalProperties' && error.params.additionalProperty) {
        message = `Unknown property '${error.params.additionalProperty}'`;
      } else if (error.keyword === 'required' && error.params.missingProperty) {
        message = `Missing required property '${error.params.missingProperty}'`;
      } else if (error.keyword === 'enum') {
        message = `${message}. Allowed values: ${error.params.allowedValues?.join(', ')}`;
      } else if (error.keyword === 'type') {
        message = `${message} (expected ${error.params.type})`;
      }

      return {
        path: path.replace(/^\//, '').replace(/\//g, '.') || 'root',
        message,
        value: error.data,
      };
    });
  }
}

export const workflowValidator = new WorkflowValidator();
