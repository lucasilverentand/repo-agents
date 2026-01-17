import { appendFile } from "node:fs/promises";

/**
 * Generate a random delimiter for multiline values
 */
function generateDelimiter(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "ghadelimiter_";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Set a single GitHub Actions output
 * Handles multiline values using heredoc-style delimiters
 */
export async function setOutput(name: string, value: string): Promise<void> {
  const outputFile = process.env.GITHUB_OUTPUT;

  if (!outputFile) {
    // Local testing mode - log to console
    console.log(`[OUTPUT] ${name}=${value}`);
    return;
  }

  let content: string;

  if (value.includes("\n")) {
    // Multiline value - use heredoc-style delimiter
    const delimiter = generateDelimiter();
    content = `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
  } else {
    // Single line value
    content = `${name}=${value}\n`;
  }

  await appendFile(outputFile, content, "utf-8");
}

/**
 * Set multiple GitHub Actions outputs at once
 */
export async function setOutputs(outputs: Record<string, string>): Promise<void> {
  for (const [name, value] of Object.entries(outputs)) {
    await setOutput(name, value);
  }
}
