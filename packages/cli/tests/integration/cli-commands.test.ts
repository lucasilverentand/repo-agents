import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dir, "../../src/index.ts");

describe("CLI Commands", () => {
	test("help command shows usage information", async () => {
		const proc = Bun.spawn(["bun", CLI_PATH, "--help"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(proc.exitCode).toBe(0);
		expect(output).toContain("repo-agents");
		expect(output).toContain("init");
		expect(output).toContain("compile");
		expect(output).toContain("validate");
		expect(output).toContain("list");
	});

	test("version command shows version", async () => {
		const proc = Bun.spawn(["bun", CLI_PATH, "--version"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const output = await new Response(proc.stdout).text();
		await proc.exited;

		expect(proc.exitCode).toBe(0);
		// Should show semantic version format
		expect(output).toMatch(/\d+\.\d+\.\d+/);
	});

	test("unknown command shows error", async () => {
		const proc = Bun.spawn(["bun", CLI_PATH, "unknown-command"], {
			stdout: "pipe",
			stderr: "pipe",
		});

		const stderr = await new Response(proc.stderr).text();
		await proc.exited;

		expect(proc.exitCode).not.toBe(0);
		expect(stderr).toContain("unknown command");
	});
});
