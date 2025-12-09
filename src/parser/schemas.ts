import { z } from 'zod';

const workflowInputSchema = z.object({
  description: z.string(),
  required: z.boolean().optional(),
  default: z.string().optional(),
  type: z.enum(['string', 'boolean', 'choice']).optional(),
  options: z.array(z.string()).optional(),
});

const triggerConfigSchema = z.object({
  issues: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  pull_request: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  discussion: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
  schedule: z
    .array(
      z.object({
        cron: z.string(),
      })
    )
    .optional(),
  workflow_dispatch: z
    .object({
      inputs: z.record(workflowInputSchema).optional(),
    })
    .optional(),
  repository_dispatch: z
    .object({
      types: z.array(z.string()).optional(),
    })
    .optional(),
});

const permissionsSchema = z
  .object({
    contents: z.enum(['read', 'write']).optional(),
    issues: z.enum(['read', 'write']).optional(),
    pull_requests: z.enum(['read', 'write']).optional(),
    discussions: z.enum(['read', 'write']).optional(),
  })
  .optional();

const claudeConfigSchema = z
  .object({
    model: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().min(0).max(1).optional(),
  })
  .optional();

const outputConfigSchema = z.object({
  max: z.number().optional(),
  sign: z.boolean().optional(),
}).passthrough();  // Allow additional properties

const outputSchema = z.record(
  z.enum([
    'add-comment',
    'add-label',
    'remove-label',
    'create-issue',
    'create-pr',
    'update-file',
    'close-issue',
    'close-pr',
  ]),
  z.union([outputConfigSchema, z.boolean()])
).optional();

const toolSchema = z
  .array(
    z.object({
      name: z.string(),
      description: z.string(),
      parameters: z.record(z.unknown()).optional(),
    })
  )
  .optional();

export const agentFrontmatterSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  on: triggerConfigSchema,
  permissions: permissionsSchema,
  claude: claudeConfigSchema,
  outputs: outputSchema,
  tools: toolSchema,
  'allowed-actors': z.array(z.string()).optional(),
  'allowed-teams': z.array(z.string()).optional(),
  'allowed-paths': z.array(z.string()).optional(),
});

export type AgentFrontmatter = z.infer<typeof agentFrontmatterSchema>;
