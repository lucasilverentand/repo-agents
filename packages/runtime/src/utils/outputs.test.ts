import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { setOutput, setOutputs } from "./outputs";

describe("outputs", () => {
  let originalEnv: Record<string, string | undefined>;
  let testOutputFile: string;

  beforeEach(() => {
    // Save original environment
    originalEnv = {
      GITHUB_OUTPUT: process.env.GITHUB_OUTPUT,
    };

    // Set test output file
    testOutputFile = "/tmp/test-github-output.txt";
    process.env.GITHUB_OUTPUT = testOutputFile;
  });

  afterEach(async () => {
    // Restore original environment
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Clean up test file
    if (existsSync(testOutputFile)) {
      rmSync(testOutputFile, { force: true });
    }
  });

  describe("setOutput", () => {
    test("writes single line output correctly", async () => {
      await setOutput("test-name", "test-value");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("test-name=test-value\n");
    });

    test("writes empty value correctly", async () => {
      await setOutput("empty-name", "");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("empty-name=\n");
    });

    test("appends multiple outputs", async () => {
      await setOutput("first", "value1");
      await setOutput("second", "value2");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("first=value1\nsecond=value2\n");
    });

    test("writes multiline output with heredoc delimiter", async () => {
      const multilineValue = "line 1\nline 2\nline 3";
      await setOutput("multiline", multilineValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      // Should use heredoc format
      expect(content).toContain("multiline<<");
      expect(content).toContain("\nline 1\nline 2\nline 3\n");
    });

    test("generates unique delimiter for multiline", async () => {
      const multilineValue = "line 1\nline 2";
      await setOutput("first-multiline", multilineValue);
      await setOutput("second-multiline", multilineValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      // Extract delimiters
      const delimiterRegex = /<<(ghadelimiter_\w+)/g;
      const matches = Array.from(content.matchAll(delimiterRegex));

      expect(matches.length).toBeGreaterThanOrEqual(2);
      // Delimiters should be different
      expect(matches[0][1]).not.toBe(matches[1][1]);
    });

    test("handles value with special characters", async () => {
      const specialValue = "value with $pecial ch@rs & symbols!";
      await setOutput("special", specialValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("special=value with $pecial ch@rs & symbols!\n");
    });

    test("handles value with equals sign", async () => {
      await setOutput("test", "key=value");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("test=key=value\n");
    });

    test("logs to console when GITHUB_OUTPUT not set", async () => {
      delete process.env.GITHUB_OUTPUT;

      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        await setOutput("test-name", "test-value");
        expect(logs).toContain("[OUTPUT] test-name=test-value");
      } finally {
        console.log = originalLog;
      }
    });

    test("creates output file if it does not exist", async () => {
      if (existsSync(testOutputFile)) {
        rmSync(testOutputFile);
      }

      await setOutput("test", "value");

      expect(existsSync(testOutputFile)).toBe(true);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe("test=value\n");
    });

    test("handles very long single line values", async () => {
      const longValue = "a".repeat(10000);
      await setOutput("long", longValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe(`long=${longValue}\n`);
    });

    test("handles multiline with empty lines", async () => {
      const multilineValue = "line 1\n\nline 3";
      await setOutput("with-empty", multilineValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("line 1\n\nline 3");
    });

    test("handles JSON values", async () => {
      const jsonValue = JSON.stringify({ key: "value", nested: { data: [1, 2, 3] } });
      await setOutput("json", jsonValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      expect(content).toBe(`json=${jsonValue}\n`);
    });

    test("handles multiline JSON values", async () => {
      const jsonValue = JSON.stringify({ key: "value" }, null, 2);
      await setOutput("json-pretty", jsonValue);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      // Pretty JSON has newlines, so should use heredoc
      expect(content).toContain("json-pretty<<");
      expect(content).toContain(jsonValue);
    });
  });

  describe("setOutputs", () => {
    test("writes multiple outputs at once", async () => {
      await setOutputs({
        first: "value1",
        second: "value2",
        third: "value3",
      });

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("first=value1\n");
      expect(content).toContain("second=value2\n");
      expect(content).toContain("third=value3\n");
    });

    test("writes empty object", async () => {
      await setOutputs({});

      if (existsSync(testOutputFile)) {
        const { readFile } = await import("node:fs/promises");
        const content = await readFile(testOutputFile, "utf-8");
        expect(content).toBe("");
      }
    });

    test("handles mixed single and multiline values", async () => {
      await setOutputs({
        single: "value",
        multiline: "line1\nline2",
        another: "single-value",
      });

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("single=value\n");
      expect(content).toContain("multiline<<");
      expect(content).toContain("line1\nline2");
      expect(content).toContain("another=single-value\n");
    });

    test("preserves insertion order", async () => {
      await setOutputs({
        z: "last",
        a: "first",
        m: "middle",
      });

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      const lines = content.split("\n").filter((line) => line && !line.startsWith("ghadelimiter_"));

      // Object.entries preserves insertion order in modern JavaScript
      expect(lines[0]).toContain("z=");
      expect(lines[1]).toContain("a=");
      expect(lines[2]).toContain("m=");
    });

    test("appends to existing outputs", async () => {
      await setOutput("existing", "value");
      await setOutputs({
        new1: "value1",
        new2: "value2",
      });

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("existing=value\n");
      expect(content).toContain("new1=value1\n");
      expect(content).toContain("new2=value2\n");
    });

    test("logs to console when GITHUB_OUTPUT not set", async () => {
      delete process.env.GITHUB_OUTPUT;

      const originalLog = console.log;
      const logs: string[] = [];
      console.log = (...args: unknown[]) => {
        logs.push(args.join(" "));
      };

      try {
        await setOutputs({
          first: "value1",
          second: "value2",
        });

        expect(logs).toContain("[OUTPUT] first=value1");
        expect(logs).toContain("[OUTPUT] second=value2");
      } finally {
        console.log = originalLog;
      }
    });

    test("handles outputs with boolean-like string values", async () => {
      await setOutputs({
        bool_true: "true",
        bool_false: "false",
        number: "42",
      });

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("bool_true=true\n");
      expect(content).toContain("bool_false=false\n");
      expect(content).toContain("number=42\n");
    });
  });

  describe("integration scenarios", () => {
    test("sequential single outputs maintain order", async () => {
      await setOutput("step1", "value1");
      await setOutput("step2", "value2");
      await setOutput("step3", "value3");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");
      const lines = content.split("\n").filter((line) => line);

      expect(lines[0]).toBe("step1=value1");
      expect(lines[1]).toBe("step2=value2");
      expect(lines[2]).toBe("step3=value3");
    });

    test("mixing setOutput and setOutputs", async () => {
      await setOutput("single1", "value1");
      await setOutputs({
        batch1: "batchvalue1",
        batch2: "batchvalue2",
      });
      await setOutput("single2", "value2");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("single1=value1\n");
      expect(content).toContain("batch1=batchvalue1\n");
      expect(content).toContain("batch2=batchvalue2\n");
      expect(content).toContain("single2=value2\n");
    });

    test("large batch of outputs", async () => {
      const outputs: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        outputs[`output${i}`] = `value${i}`;
      }

      await setOutputs(outputs);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      for (let i = 0; i < 100; i++) {
        expect(content).toContain(`output${i}=value${i}\n`);
      }
    });

    test("outputs with complex workflow-like data", async () => {
      await setOutputs({
        "should-continue": "true",
        "skip-reason": "",
        "validation-result": "success",
        "error-message": "",
      });

      await setOutput("agent-output", JSON.stringify({ status: "complete", result: "ok" }));

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      expect(content).toContain("should-continue=true\n");
      expect(content).toContain("skip-reason=\n");
      expect(content).toContain("validation-result=success\n");
      expect(content).toContain("error-message=\n");
      expect(content).toContain('agent-output={"status":"complete","result":"ok"}\n');
    });
  });

  describe("delimiter generation", () => {
    test("delimiter has correct format", async () => {
      await setOutput("test", "line1\nline2");

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      const delimiterMatch = content.match(/<<(ghadelimiter_[a-zA-Z0-9]{16})/);
      expect(delimiterMatch).not.toBeNull();
      expect(delimiterMatch?.[1]).toMatch(/^ghadelimiter_[a-zA-Z0-9]{16}$/);
    });

    test("delimiter is random", async () => {
      const delimiters: string[] = [];

      for (let i = 0; i < 10; i++) {
        // Clear file
        if (existsSync(testOutputFile)) {
          rmSync(testOutputFile);
        }

        await setOutput("test", `line1\nline2\nrun${i}`);

        const { readFile } = await import("node:fs/promises");
        const content = await readFile(testOutputFile, "utf-8");
        const match = content.match(/<<(ghadelimiter_\w+)/);

        if (match) {
          delimiters.push(match[1]);
        }
      }

      // All delimiters should be unique
      const uniqueDelimiters = new Set(delimiters);
      expect(uniqueDelimiters.size).toBe(10);
    });

    test("delimiter does not appear in value", async () => {
      // This is statistically unlikely but theoretically the delimiter could appear in the value
      // The function doesn't check for this, but we document the behavior
      const value = "line1\nline2\nline3";
      await setOutput("test", value);

      const { readFile } = await import("node:fs/promises");
      const content = await readFile(testOutputFile, "utf-8");

      // Extract delimiter
      const match = content.match(/<<(ghadelimiter_\w+)/);
      expect(match).not.toBeNull();

      const delimiter = match?.[1];
      // Delimiter should not be in the original value
      expect(value).not.toContain(delimiter ?? "");
    });
  });
});
