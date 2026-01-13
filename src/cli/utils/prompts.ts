import * as readline from 'readline';

/**
 * Prompts the user for input in the terminal
 * @param question The question to display to the user
 * @returns The user's input (trimmed)
 */
export function promptForInput(question: string): Promise<string> {
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
