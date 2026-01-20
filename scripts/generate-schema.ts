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

async function generateSchema() {
	console.log("🔨 Generating JSON Schema from Zod schemas...");

	// Dynamic import using absolute path
	const { agentFrontmatterSchema } = await import(SCHEMA_MODULE_PATH);

	// Convert Zod schema to JSON Schema
	const jsonSchema = zodToJsonSchema(agentFrontmatterSchema, {
		name: "AgentFrontmatter",
		$refStrategy: "none", // Inline all references for simplicity
	});

	// Add additional metadata for better IDE support
	const enhancedSchema = {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: "https://github.com/lucasilverentand/repo-agents/schemas/agent-frontmatter",
		title: "Repo Agent Frontmatter",
		description:
			"YAML frontmatter schema for repo-agents agent definition files",
		...jsonSchema,
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
