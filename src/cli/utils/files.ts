import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';

export async function findMarkdownFiles(directory: string): Promise<string[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);
      if (entry.isFile() && extname(entry.name) === '.md') {
        files.push(fullPath);
      }
    }

    return files.sort();
  } catch (_error) {
    return [];
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function agentNameToWorkflowName(agentName: string): string {
  return `agent-${toKebabCase(agentName)}`;
}

export const DISPATCHER_WORKFLOW_NAME = 'agent-dispatcher';
