import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const ARTIFACTS_BASE_PATH = "/tmp/artifacts";

/**
 * Get the directory path for a named artifact
 */
export function getArtifactPath(name: string): string {
  return join(ARTIFACTS_BASE_PATH, name);
}

/**
 * Write data to an artifact file
 * Creates the artifact directory if it doesn't exist
 */
export async function writeArtifact(
  name: string,
  path: string,
  data: string | Buffer,
): Promise<void> {
  const artifactDir = getArtifactPath(name);
  const fullPath = join(artifactDir, path);
  const dir = dirname(fullPath);

  // Ensure the directory exists
  await mkdir(dir, { recursive: true });

  // Write the data
  await writeFile(fullPath, data, "utf-8");
}

/**
 * Read data from an artifact file
 * Returns null if the file doesn't exist
 */
export async function readArtifact(name: string, path: string): Promise<string | null> {
  const artifactDir = getArtifactPath(name);
  const fullPath = join(artifactDir, path);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    return await readFile(fullPath, "utf-8");
  } catch {
    return null;
  }
}
