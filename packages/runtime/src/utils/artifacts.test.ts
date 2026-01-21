import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getArtifactPath, readArtifact, writeArtifact } from "./artifacts";

describe("artifacts", () => {
  const testArtifactsPath = "/tmp/artifacts-test";
  const originalBasePath = "/tmp/artifacts";

  beforeEach(() => {
    // Clean up test directory before each test
    if (existsSync(testArtifactsPath)) {
      rmSync(testArtifactsPath, { recursive: true, force: true });
    }
    if (existsSync(originalBasePath)) {
      rmSync(originalBasePath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after tests
    if (existsSync(testArtifactsPath)) {
      rmSync(testArtifactsPath, { recursive: true, force: true });
    }
    if (existsSync(originalBasePath)) {
      rmSync(originalBasePath, { recursive: true, force: true });
    }
  });

  describe("getArtifactPath", () => {
    test("returns correct path for artifact name", () => {
      const path = getArtifactPath("test-artifact");
      expect(path).toBe("/tmp/artifacts/test-artifact");
    });

    test("handles artifact names with special characters", () => {
      const path = getArtifactPath("test-artifact-123_foo");
      expect(path).toBe("/tmp/artifacts/test-artifact-123_foo");
    });

    test("handles empty artifact name", () => {
      const path = getArtifactPath("");
      expect(path).toBe("/tmp/artifacts");
    });
  });

  describe("writeArtifact", () => {
    test("writes string data to artifact file", async () => {
      const content = "test content";
      await writeArtifact("test-artifact", "file.txt", content);

      const filePath = join(originalBasePath, "test-artifact", "file.txt");
      expect(existsSync(filePath)).toBe(true);

      const readContent = await readFile(filePath, "utf-8");
      expect(readContent).toBe(content);
    });

    test("writes Buffer data to artifact file", async () => {
      const content = Buffer.from("test buffer content");
      await writeArtifact("test-artifact", "file.bin", content);

      const filePath = join(originalBasePath, "test-artifact", "file.bin");
      expect(existsSync(filePath)).toBe(true);

      const readContent = await readFile(filePath, "utf-8");
      expect(readContent).toBe("test buffer content");
    });

    test("creates nested directories automatically", async () => {
      await writeArtifact("test-artifact", "nested/path/file.txt", "content");

      const filePath = join(originalBasePath, "test-artifact", "nested/path/file.txt");
      expect(existsSync(filePath)).toBe(true);
    });

    test("overwrites existing file", async () => {
      await writeArtifact("test-artifact", "file.txt", "original");
      await writeArtifact("test-artifact", "file.txt", "updated");

      const filePath = join(originalBasePath, "test-artifact", "file.txt");
      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("updated");
    });

    test("handles empty content", async () => {
      await writeArtifact("test-artifact", "empty.txt", "");

      const filePath = join(originalBasePath, "test-artifact", "empty.txt");
      expect(existsSync(filePath)).toBe(true);

      const content = await readFile(filePath, "utf-8");
      expect(content).toBe("");
    });

    test("handles multiline content", async () => {
      const content = "line 1\nline 2\nline 3";
      await writeArtifact("test-artifact", "multiline.txt", content);

      const filePath = join(originalBasePath, "test-artifact", "multiline.txt");
      const readContent = await readFile(filePath, "utf-8");
      expect(readContent).toBe(content);
    });

    test("creates artifact directory if it does not exist", async () => {
      const artifactPath = join(originalBasePath, "new-artifact");
      expect(existsSync(artifactPath)).toBe(false);

      await writeArtifact("new-artifact", "file.txt", "content");

      expect(existsSync(artifactPath)).toBe(true);
      expect(existsSync(join(artifactPath, "file.txt"))).toBe(true);
    });
  });

  describe("readArtifact", () => {
    test("reads existing artifact file", async () => {
      const content = "test content";
      await writeArtifact("test-artifact", "file.txt", content);

      const readContent = await readArtifact("test-artifact", "file.txt");
      expect(readContent).toBe(content);
    });

    test("returns null for non-existent artifact", async () => {
      const content = await readArtifact("non-existent", "file.txt");
      expect(content).toBeNull();
    });

    test("returns null for non-existent file in existing artifact", async () => {
      await writeArtifact("test-artifact", "exists.txt", "content");

      const content = await readArtifact("test-artifact", "missing.txt");
      expect(content).toBeNull();
    });

    test("reads multiline content correctly", async () => {
      const content = "line 1\nline 2\nline 3";
      await writeArtifact("test-artifact", "multiline.txt", content);

      const readContent = await readArtifact("test-artifact", "multiline.txt");
      expect(readContent).toBe(content);
    });

    test("reads empty file correctly", async () => {
      await writeArtifact("test-artifact", "empty.txt", "");

      const content = await readArtifact("test-artifact", "empty.txt");
      expect(content).toBe("");
    });

    test("reads nested file correctly", async () => {
      const content = "nested content";
      await writeArtifact("test-artifact", "nested/path/file.txt", content);

      const readContent = await readArtifact("test-artifact", "nested/path/file.txt");
      expect(readContent).toBe(content);
    });

    test("handles read errors gracefully", async () => {
      // Create a directory instead of a file to cause a read error
      const artifactDir = join(originalBasePath, "test-artifact");
      const fileDir = join(artifactDir, "not-a-file");
      mkdirSync(fileDir, { recursive: true });

      const content = await readArtifact("test-artifact", "not-a-file");
      expect(content).toBeNull();
    });

    test("reads special characters correctly", async () => {
      const content = "special chars: äöü €$@!";
      await writeArtifact("test-artifact", "special.txt", content);

      const readContent = await readArtifact("test-artifact", "special.txt");
      expect(readContent).toBe(content);
    });
  });

  describe("integration scenarios", () => {
    test("multiple artifacts in parallel", async () => {
      await Promise.all([
        writeArtifact("artifact-1", "file.txt", "content 1"),
        writeArtifact("artifact-2", "file.txt", "content 2"),
        writeArtifact("artifact-3", "file.txt", "content 3"),
      ]);

      const [content1, content2, content3] = await Promise.all([
        readArtifact("artifact-1", "file.txt"),
        readArtifact("artifact-2", "file.txt"),
        readArtifact("artifact-3", "file.txt"),
      ]);

      expect(content1).toBe("content 1");
      expect(content2).toBe("content 2");
      expect(content3).toBe("content 3");
    });

    test("multiple files in same artifact", async () => {
      await Promise.all([
        writeArtifact("test-artifact", "file1.txt", "content 1"),
        writeArtifact("test-artifact", "file2.txt", "content 2"),
        writeArtifact("test-artifact", "file3.txt", "content 3"),
      ]);

      const [content1, content2, content3] = await Promise.all([
        readArtifact("test-artifact", "file1.txt"),
        readArtifact("test-artifact", "file2.txt"),
        readArtifact("test-artifact", "file3.txt"),
      ]);

      expect(content1).toBe("content 1");
      expect(content2).toBe("content 2");
      expect(content3).toBe("content 3");
    });

    test("write, read, update, read workflow", async () => {
      await writeArtifact("test-artifact", "file.txt", "original");

      const original = await readArtifact("test-artifact", "file.txt");
      expect(original).toBe("original");

      await writeArtifact("test-artifact", "file.txt", "updated");

      const updated = await readArtifact("test-artifact", "file.txt");
      expect(updated).toBe("updated");
    });
  });
});
