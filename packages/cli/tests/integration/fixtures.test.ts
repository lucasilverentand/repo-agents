import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const CLI_PATH = resolve(import.meta.dir, "../../src/index.ts");
const PROJECT_ROOT = resolve(import.meta.dir, "../../../..");
const FIXTURES_DIR = join(PROJECT_ROOT, "tests/fixtures");
const VALID_AGENTS_DIR = join(FIXTURES_DIR, "agents");
const INVALID_AGENTS_DIR = join(FIXTURES_DIR, "invalid");

describe("Test Fixtures", () => {
	describe("Valid Fixtures", () => {
		// Get all valid fixture files
		const validFixtures = readdirSync(VALID_AGENTS_DIR)
			.filter((file) => file.endsWith(".md"))
			.map((file) => ({
				name: file,
				path: join(VALID_AGENTS_DIR, file),
			}));

		test("should have valid fixtures", () => {
			expect(validFixtures.length).toBeGreaterThan(0);
		});

		for (const fixture of validFixtures) {
			test(`${fixture.name} should validate successfully`, async () => {
				const proc = Bun.spawn(["bun", CLI_PATH, "validate", fixture.path], {
					stdout: "pipe",
					stderr: "pipe",
				});

				const stderr = await new Response(proc.stderr).text();
				await proc.exited;

				if (proc.exitCode !== 0) {
					console.error(`Validation failed for ${fixture.name}:`);
					console.error(stderr);
				}

				expect(proc.exitCode).toBe(0);
			});
		}

		test("all valid fixtures count", () => {
			// Just verify we have a good number of valid fixtures
			expect(validFixtures.length).toBeGreaterThan(10);
		});
	});

	describe("Invalid Fixtures", () => {
		// Get all invalid fixture files
		const invalidFixtures = readdirSync(INVALID_AGENTS_DIR)
			.filter((file) => file.endsWith(".md"))
			.map((file) => ({
				name: file,
				path: join(INVALID_AGENTS_DIR, file),
			}));

		test("should have invalid fixtures", () => {
			expect(invalidFixtures.length).toBeGreaterThan(0);
		});

		for (const fixture of invalidFixtures) {
			test(`${fixture.name} should fail validation`, async () => {
				const proc = Bun.spawn(["bun", CLI_PATH, "validate", fixture.path], {
					stdout: "pipe",
					stderr: "pipe",
				});

				await proc.exited;

				// Invalid fixtures should fail validation (non-zero exit code)
				expect(proc.exitCode).not.toBe(0);
			});
		}
	});

	describe("Fixture Coverage", () => {
		test("should cover all output types", () => {
			const validFixtures = readdirSync(VALID_AGENTS_DIR);

			// Check fixtures exist for key output types
			expect(
				validFixtures.some((f) => f.includes("comment") || f.includes("simple")),
			).toBe(true);
			expect(
				validFixtures.some((f) => f.includes("label") || f.includes("pr-labels")),
			).toBe(true);
			expect(
				validFixtures.some(
					(f) => f.includes("create-issue") || f.includes("multiple-outputs"),
				),
			).toBe(true);
			expect(validFixtures.some((f) => f.includes("discussion"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("pr") || f.includes("create-pr"))).toBe(
				true,
			);
			expect(validFixtures.some((f) => f.includes("update-file"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("close"))).toBe(true);
		});

		test("should cover all trigger types", () => {
			const validFixtures = readdirSync(VALID_AGENTS_DIR);

			// Trigger types that should be covered (check by filename patterns)
			expect(validFixtures.some((f) => f.includes("simple") || f.includes("complex"))).toBe(
				true,
			); // Issue triggers
			expect(validFixtures.some((f) => f.includes("pr"))).toBe(true); // PR triggers
			expect(validFixtures.some((f) => f.includes("discussion"))).toBe(true); // Discussion triggers
			expect(validFixtures.some((f) => f.includes("schedule"))).toBe(true); // Schedule triggers
			expect(validFixtures.some((f) => f.includes("workflow-dispatch"))).toBe(true); // Manual triggers
		});

		test("should cover authorization features", () => {
			const validFixtures = readdirSync(VALID_AGENTS_DIR);

			expect(validFixtures.some((f) => f.includes("allowed-users"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("allowed-teams"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("rate-limit"))).toBe(true);
		});

		test("should cover advanced features", () => {
			const validFixtures = readdirSync(VALID_AGENTS_DIR);

			expect(validFixtures.some((f) => f.includes("context"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("audit"))).toBe(true);
			expect(validFixtures.some((f) => f.includes("opencode"))).toBe(true);
		});

		test("should cover validation error cases", () => {
			const invalidFixtures = readdirSync(INVALID_AGENTS_DIR);

			// Should have fixtures for common validation errors
			expect(invalidFixtures.some((f) => f.includes("no-paths"))).toBe(true);
			expect(invalidFixtures.some((f) => f.includes("no-permission"))).toBe(true);
			expect(invalidFixtures.some((f) => f.includes("no-trigger"))).toBe(true);
			expect(invalidFixtures.some((f) => f.includes("malformed"))).toBe(true);
			expect(
				invalidFixtures.some(
					(f) => f.includes("missing-name") || f.includes("empty-name"),
				),
			).toBe(true);
		});
	});
});
