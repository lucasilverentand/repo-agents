import chalk from "chalk";

// Respect color preferences according to clig.dev and NO_COLOR standard
// Disable colors when:
// - NO_COLOR env var is set (https://no-color.org)
// - TERM=dumb (non-interactive terminal)
// - stdout is not a TTY (piped to file/another command)
// - User explicitly requests --no-color
const shouldDisableColor =
  !!process.env.NO_COLOR || process.env.TERM === "dumb" || !process.stdout.isTTY;

if (shouldDisableColor) {
  chalk.level = 0;
}

export class Logger {
  private verbose: boolean;
  private useColor: boolean;
  private quiet: boolean;

  constructor(verbose = false, useColor = !shouldDisableColor, quiet = false) {
    this.verbose = verbose;
    this.useColor = useColor;
    this.quiet = quiet || !!process.env.REPO_AGENTS_QUIET;
  }

  /**
   * Disable colors for this logger instance
   */
  disableColor(): void {
    this.useColor = false;
  }

  /**
   * Enable quiet mode - suppress all non-error output
   */
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }

  /**
   * Apply color if enabled, otherwise return plain text
   */
  private colorize(text: string, colorFn: (text: string) => string): string {
    return this.useColor ? colorFn(text) : text;
  }

  /**
   * Check if quiet mode is enabled (instance setting or env var)
   */
  private isQuiet(): boolean {
    return this.quiet || !!process.env.REPO_AGENTS_QUIET;
  }

  info(message: string): void {
    if (!this.isQuiet()) {
      console.log(this.colorize("ℹ", chalk.blue), message);
    }
  }

  success(message: string): void {
    if (!this.isQuiet()) {
      console.log(this.colorize("✓", chalk.green), message);
    }
  }

  warn(message: string): void {
    if (!this.isQuiet()) {
      console.log(this.colorize("⚠", chalk.yellow), message);
    }
  }

  error(message: string): void {
    console.error(this.colorize("✗", chalk.red), message);
  }

  debug(message: string): void {
    if (this.verbose && !this.isQuiet()) {
      console.log(this.colorize("[DEBUG]", chalk.gray), message);
    }
  }

  log(message: string): void {
    if (!this.isQuiet()) {
      console.log(message);
    }
  }

  newline(): void {
    if (!this.isQuiet()) {
      console.log();
    }
  }
}

export const logger = new Logger();
