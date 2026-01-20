import * as readline from "node:readline";

/**
 * Check if running in an interactive terminal (TTY)
 */
export function isTTY(): boolean {
  return !!process.stdin.isTTY && !!process.stdout.isTTY;
}

/**
 * Check if prompts should be disabled
 */
export function shouldDisablePrompts(): boolean {
  return !isTTY() || !!process.env.REPO_AGENTS_NO_INPUT;
}

/**
 * Prompts the user for input in the terminal
 * @param question The question to display to the user
 * @param options Options for the prompt
 * @returns The user's input (trimmed)
 * @throws Error if not running in a TTY and no default is provided
 */
export function promptForInput(
  question: string,
  options: { defaultValue?: string; allowNonInteractive?: boolean } = {},
): Promise<string> {
  // Check if we should disable prompts
  if (shouldDisablePrompts()) {
    if (options.defaultValue !== undefined) {
      return Promise.resolve(options.defaultValue);
    }

    if (options.allowNonInteractive) {
      return Promise.resolve("");
    }

    throw new Error(
      "Not running in an interactive terminal. Use --no-input flag or run in an interactive shell.",
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
