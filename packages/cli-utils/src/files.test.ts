import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentNameToWorkflowName, fileExists, findMarkdownFiles, toKebabCase } from "./files.js";

describe("files utils", () => {
  describe("toKebabCase", () => {
    it("should convert spaces to hyphens", () => {
      expect(toKebabCase("Hello World")).toBe("hello-world");
    });

    it("should convert to lowercase", () => {
      expect(toKebabCase("UPPERCASE")).toBe("uppercase");
    });

    it("should remove special characters", () => {
      expect(toKebabCase("Hello@World!")).toBe("helloworld");
    });

    it("should handle multiple spaces", () => {
      expect(toKebabCase("Hello   World")).toBe("hello-world");
    });

    it("should handle mixed case and spaces", () => {
      expect(toKebabCase("My Agent Name")).toBe("my-agent-name");
    });

    it("should handle already kebab-case", () => {
      expect(toKebabCase("already-kebab")).toBe("already-kebab");
    });

    it("should handle empty string", () => {
      expect(toKebabCase("")).toBe("");
    });

    it("should handle numbers", () => {
      expect(toKebabCase("Agent 123")).toBe("agent-123");
    });

    it("should handle consecutive special characters", () => {
      expect(toKebabCase("Test!!!Agent???")).toBe("testagent");
    });

    it("should handle unicode characters", () => {
      expect(toKebabCase("Café Résumé")).toBe("caf-rsum");
    });
  });

  describe("agentNameToWorkflowName", () => {
    it("should prefix with agent-", () => {
      expect(agentNameToWorkflowName("Test Agent")).toBe("agent-test-agent");
    });

    it("should handle complex names", () => {
      expect(agentNameToWorkflowName("My Complex Agent Name")).toBe("agent-my-complex-agent-name");
    });

    it("should remove special characters", () => {
      expect(agentNameToWorkflowName("Test@Agent!")).toBe("agent-testagent");
    });

    it("should handle empty string", () => {
      expect(agentNameToWorkflowName("")).toBe("agent-");
    });

    it("should handle numbers", () => {
      expect(agentNameToWorkflowName("Agent 2")).toBe("agent-agent-2");
    });
  });

  describe("findMarkdownFiles", () => {
    it("should find markdown files", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      writeFileSync(join(tempDir, "file1.md"), "test");
      writeFileSync(join(tempDir, "file2.md"), "test");
      writeFileSync(join(tempDir, "file3.txt"), "test");

      const files = await findMarkdownFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files[0]).toContain("file1.md");
      expect(files[1]).toContain("file2.md");
    });

    it("should return empty array for non-existent directory", async () => {
      const files = await findMarkdownFiles("/non/existent/path");
      expect(files).toEqual([]);
    });

    it("should return sorted files", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      writeFileSync(join(tempDir, "zebra.md"), "test");
      writeFileSync(join(tempDir, "alpha.md"), "test");

      const files = await findMarkdownFiles(tempDir);

      expect(files[0]).toContain("alpha.md");
      expect(files[1]).toContain("zebra.md");
    });

    it("should recursively search subdirectories", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      const subDir = join(tempDir, "subdir");
      const nestedDir = join(subDir, "nested");

      mkdirSync(subDir);
      mkdirSync(nestedDir);

      writeFileSync(join(tempDir, "root.md"), "test");
      writeFileSync(join(subDir, "sub.md"), "test");
      writeFileSync(join(nestedDir, "nested.md"), "test");
      writeFileSync(join(subDir, "other.txt"), "test");

      const files = await findMarkdownFiles(tempDir);

      expect(files).toHaveLength(3);
      expect(files.some((f) => f.endsWith("root.md"))).toBe(true);
      expect(files.some((f) => f.endsWith("sub.md"))).toBe(true);
      expect(files.some((f) => f.endsWith("nested.md"))).toBe(true);
    });

    it("should handle empty directory", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      const files = await findMarkdownFiles(tempDir);

      expect(files).toEqual([]);
    });

    it("should handle directory with only non-markdown files", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      writeFileSync(join(tempDir, "file1.txt"), "test");
      writeFileSync(join(tempDir, "file2.json"), "test");

      const files = await findMarkdownFiles(tempDir);

      expect(files).toEqual([]);
    });

    it("should handle directories with subdirectories but no markdown files", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      const subDir = join(tempDir, "subdir");
      mkdirSync(subDir);
      writeFileSync(join(subDir, "file.txt"), "test");

      const files = await findMarkdownFiles(tempDir);

      expect(files).toEqual([]);
    });

    it("should handle mixed case markdown extensions", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      writeFileSync(join(tempDir, "file.md"), "test");
      writeFileSync(join(tempDir, "FILE.MD"), "test");
      writeFileSync(join(tempDir, "other.Md"), "test");

      const files = await findMarkdownFiles(tempDir);

      // Only lowercase .md should match
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("file.md");
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      const filePath = join(tempDir, "test.txt");
      writeFileSync(filePath, "test content");

      const exists = await fileExists(filePath);

      expect(exists).toBe(true);
    });

    it("should return true for existing directory", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));

      const exists = await fileExists(tempDir);

      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await fileExists("/non/existent/file.txt");

      expect(exists).toBe(false);
    });

    it("should return false for non-existent directory", async () => {
      const exists = await fileExists("/non/existent/directory");

      expect(exists).toBe(false);
    });

    it("should handle empty path", async () => {
      const exists = await fileExists("");

      expect(exists).toBe(false);
    });

    it("should handle paths with special characters", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "repo-agents-test-"));
      const filePath = join(tempDir, "file with spaces.txt");
      writeFileSync(filePath, "test");

      const exists = await fileExists(filePath);

      expect(exists).toBe(true);
    });

    it("should return false for paths that are not accessible", async () => {
      // Test with a path that doesn't exist
      const exists = await fileExists("/root/inaccessible/file.txt");

      expect(exists).toBe(false);
    });
  });
});
