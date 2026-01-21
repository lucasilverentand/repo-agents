import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { agentParser } from "@repo-agents/parser";

/**
 * Find an agent file by name
 */
export async function findAgentByName(
  name: string,
  agentsDir: string = ".github/agents",
): Promise<string | null> {
  const files = await findMarkdownFiles(agentsDir);

  for (const file of files) {
    try {
      const { agent } = await agentParser.parseFile(file);
      if (agent && agent.name === name) {
        return file;
      }
    } catch {}
  }

  return null;
}

/**
 * Recursively find all markdown files
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await findMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return files;
}
