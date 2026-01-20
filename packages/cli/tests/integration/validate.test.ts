import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dir, "../../src/index.ts");
const PROJECT_ROOT = resolve(import.meta.dir, "../../../..");
const EXAMPLE_AGENT = join(
	PROJECT_ROOT,
	".github/agents/issue-lifecycle/issue-analyzer.md",
);

describe("Validate Command", () => {
	test("validate single agent file", async () => {
		const proc = Bun.spawn(["bun", CLI_PATH, "validate", EXAMPLE_AGENT], {
			stdout: "pipe",
			stderr: "pipe",
		});

		await proc.exited;

		expect(proc.exitCode).toBe(0);
	});

	test("validate all agents with --all flag", async () => {
		const proc = Bun.spawn(["bun", CLI_PATH, "validate", "--all"], {
			cwd: PROJECT_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(proc.exitCode).toBe(0);
		expect(output).toContain("Valid");
	});

	test("validate command completes without error", async () => {
		// This test ensures the validate command works end-to-end
		// More specific validation logic is tested in unit tests
		const proc = Bun.spawn(["bun", CLI_PATH, "validate", "--all"], {
			cwd: PROJECT_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		});

		await proc.exited;

		// Validation should complete successfully
		expect(proc.exitCode).toBe(0);
	});
});
