#!/usr/bin/env bun

/**
 * Generate JSON Schema from Zod schemas for IDE autocomplete support
 *
 * This script converts the Zod schemas used for runtime validation
 * into a JSON Schema that can be used by IDEs for autocomplete,
 * validation, and inline documentation when writing agent markdown files.
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Get the project root (parent of scripts directory)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

// Output to docs public directory for hosting
const SCHEMA_OUTPUT_PATH = join(
	PROJECT_ROOT,
	"docs/public/schemas/agent-frontmatter.schema.json",
);

const SCHEMA_MODULE_PATH = join(
	PROJECT_ROOT,
	"packages/parser/src/schemas.ts",
);

/**
 * Post-process the JSON Schema to add constraints that zod-to-json-schema doesn't handle well
 */
function enhanceSchema(schema: any): any {
	const agentDef = schema.definitions?.AgentFrontmatter;
	if (!agentDef) return schema;

	// Add strict validation for outputs property names
	if (agentDef.properties?.outputs) {
		agentDef.properties.outputs = {
			type: "object",
			propertyNames: {
				enum: [
					"add-comment",
					"add-label",
					"remove-label",
					"create-issue",
					"create-discussion",
					"create-pr",
					"update-file",
					"close-issue",
					"close-pr",
					"assign-issue",
					"request-review",
					"merge-pr",
					"approve-pr",
					"create-release",
					"delete-branch",
					"lock-conversation",
					"pin-issue",
					"convert-to-discussion",
					"edit-issue",
					"reopen-issue",
					"set-milestone",
					"trigger-workflow",
					"add-reaction",
					"create-branch",
				],
			},
			additionalProperties: {
				anyOf: [
					{
						type: "object",
						properties: {
							max: { type: "number" },
							sign: { type: "boolean" },
						},
						additionalProperties: true,
					},
					{ type: "boolean" },
				],
			},
		};
	}

	// Add strict validation for trigger event types
	if (agentDef.properties?.on?.properties) {
		const onProps = agentDef.properties.on.properties;

		// Issues trigger types
		if (onProps.issues?.properties?.types) {
			onProps.issues.properties.types = {
				type: "array",
				items: {
					type: "string",
					enum: [
						"opened",
						"edited",
						"deleted",
						"transferred",
						"pinned",
						"unpinned",
						"closed",
						"reopened",
						"assigned",
						"unassigned",
						"labeled",
						"unlabeled",
						"locked",
						"unlocked",
						"milestoned",
						"demilestoned",
					],
				},
			};
		}

		// Pull request trigger types
		if (onProps.pull_request?.properties?.types) {
			onProps.pull_request.properties.types = {
				type: "array",
				items: {
					type: "string",
					enum: [
						"opened",
						"edited",
						"closed",
						"reopened",
						"synchronize",
						"assigned",
						"unassigned",
						"labeled",
						"unlabeled",
						"review_requested",
						"review_request_removed",
						"ready_for_review",
						"converted_to_draft",
						"locked",
						"unlocked",
						"auto_merge_enabled",
						"auto_merge_disabled",
					],
				},
			};
		}

		// Discussion trigger types
		if (onProps.discussion?.properties?.types) {
			onProps.discussion.properties.types = {
				type: "array",
				items: {
					type: "string",
					enum: [
						"created",
						"edited",
						"deleted",
						"transferred",
						"pinned",
						"unpinned",
						"labeled",
						"unlabeled",
						"locked",
						"unlocked",
						"category_changed",
						"answered",
						"unanswered",
					],
				},
			};
		}
	}

	return schema;
}

async function generateSchema() {
	console.log("🔨 Generating JSON Schema from Zod schemas...");

	// Dynamic import using absolute path
	const { agentFrontmatterSchema } = await import(SCHEMA_MODULE_PATH);

	// Convert Zod schema to JSON Schema
	const jsonSchema = zodToJsonSchema(agentFrontmatterSchema, {
		name: "AgentFrontmatter",
		$refStrategy: "none", // Inline all references for simplicity
	});

	// Post-process to add strict constraints
	const strictSchema = enhanceSchema(jsonSchema);

	// Add additional metadata for better IDE support
	const enhancedSchema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://github.com/lucasilverentand/repo-agents/schemas/agent-frontmatter",
		title: "Repo Agent Frontmatter",
		description:
			"YAML frontmatter schema for repo-agents agent definition files",
		...strictSchema,
	};

	// Ensure output directory exists
	const outputDir = dirname(SCHEMA_OUTPUT_PATH);
	await mkdir(outputDir, { recursive: true });

	// Write schema to file
	await writeFile(
		SCHEMA_OUTPUT_PATH,
		JSON.stringify(enhancedSchema, null, 2),
		"utf-8",
	);

	console.log(`✅ JSON Schema generated at: ${SCHEMA_OUTPUT_PATH}`);
	console.log(
		"\n💡 To enable IDE autocomplete, configure your editor to use this schema for agent markdown files.",
	);
}

// Run the generator
generateSchema().catch((error) => {
	console.error("❌ Failed to generate schema:", error);
	process.exit(1);
});
