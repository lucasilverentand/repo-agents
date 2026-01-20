#!/usr/bin/env bun

/**
 * Validate all agent markdown files against the schema
 *
 * This provides IDE-independent validation for agent files
 */

import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..");

async function validateAgents() {
	const { AgentParser } = await import(
		join(PROJECT_ROOT, "packages/parser/src/index.ts")
	);

	const parser = new AgentParser();

	// Recursively find all .md files in .github/agents
	async function findAgentFiles(dir: string): Promise<string[]> {
		const files: string[] = [];
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			if (entry.isDirectory()) {
				files.push(...(await findAgentFiles(fullPath)));
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(fullPath);
			}
		}

		return files;
	}

	const agentsDir = join(PROJECT_ROOT, ".github/agents");
	const agentFiles = await findAgentFiles(agentsDir);

	console.log(`\n🔍 Validating ${agentFiles.length} agent file(s)...\n`);

	let hasErrors = false;

	for (const filePath of agentFiles) {
		const relativePath = filePath.replace(`${PROJECT_ROOT}/`, "");
		const { errors } = await parser.parseFile(filePath);

		if (errors.length > 0) {
			hasErrors = true;
			console.error(`❌ ${relativePath}:`);
			for (const error of errors) {
				const location = error.field ? ` (${error.field})` : "";
				console.error(
					`   ${error.severity.toUpperCase()}${location}: ${error.message}`,
				);
			}
			console.log("");
		} else {
			console.log(`✅ ${relativePath}`);
		}
	}

	if (hasErrors) {
		console.error("\n❌ Validation failed\n");
		process.exit(1);
	}
	console.log(`\n✅ All ${agentFiles.length} agent(s) valid\n`);
}

validateAgents().catch((error) => {
	console.error("❌ Validation error:", error);
	process.exit(1);
});
