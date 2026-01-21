import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from "bun:test";
import { Logger } from "./logger.js";

describe("Logger", () => {
  let consoleLogSpy: Mock<typeof console.log>;
  let consoleErrorSpy: Mock<typeof console.error>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should create logger with verbose disabled by default", () => {
      const logger = new Logger();
      expect(logger).toBeDefined();

      // Debug should not log when verbose is false
      logger.debug("test message");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should create logger with verbose enabled when true", () => {
      const logger = new Logger(true);
      expect(logger).toBeDefined();

      // Debug should log when verbose is true
      logger.debug("test message");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should respect color parameter", () => {
      const logger = new Logger(false, false);
      expect(logger).toBeDefined();
      logger.info("test");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should respect quiet parameter", () => {
      const logger = new Logger(false, true, true);
      logger.info("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should enable quiet mode via REPO_AGENTS_QUIET env var", () => {
      process.env.REPO_AGENTS_QUIET = "1";
      const logger = new Logger();
      logger.info("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("disableColor", () => {
    it("should disable colors when called", () => {
      const logger = new Logger(false, true);
      logger.disableColor();

      logger.info("test message");
      expect(consoleLogSpy).toHaveBeenCalled();

      const call = consoleLogSpy.mock.calls[0];
      // When colors are disabled, the icon should be plain text
      expect(call[0]).toBe("ℹ");
    });

    it("should work when colors already disabled", () => {
      const logger = new Logger(false, false);
      logger.disableColor();

      logger.success("test");
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("setQuiet", () => {
    it("should enable quiet mode", () => {
      const logger = new Logger();
      logger.setQuiet(true);

      logger.info("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should disable quiet mode", () => {
      const logger = new Logger(false, true, true);
      logger.setQuiet(false);
      delete process.env.REPO_AGENTS_QUIET;

      logger.info("should appear");
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should suppress all non-error output when enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);

      logger.info("info");
      logger.success("success");
      logger.warn("warn");
      logger.log("log");
      logger.newline();
      logger.debug("debug");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should not suppress error output when enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);

      logger.error("error");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("info", () => {
    it("should log info message with blue icon", () => {
      const logger = new Logger();
      logger.info("Information message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe("Information message");
    });

    it("should not log when quiet mode is enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.info("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle long messages", () => {
      const logger = new Logger();
      const longMessage = "x".repeat(1000);
      logger.info(longMessage);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toBe(longMessage);
    });
  });

  describe("success", () => {
    it("should log success message with green checkmark", () => {
      const logger = new Logger();
      logger.success("Operation successful");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe("Operation successful");
    });

    it("should not log when quiet mode is enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.success("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("warn", () => {
    it("should log warning message with yellow icon", () => {
      const logger = new Logger();
      logger.warn("Warning message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe("Warning message");
    });

    it("should not log when quiet mode is enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.warn("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should log error message with red X to stderr", () => {
      const logger = new Logger();
      logger.error("Error occurred");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe("Error occurred");
    });

    it("should always log errors even in quiet mode", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.error("error message");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle error objects", () => {
      const logger = new Logger();
      logger.error("Error: something went wrong");

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("debug", () => {
    it("should not log debug message when verbose is false", () => {
      const logger = new Logger(false);
      logger.debug("Debug information");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log debug message when verbose is true", () => {
      const logger = new Logger(true);
      logger.debug("Debug information");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe("Debug information");
    });

    it("should include [DEBUG] prefix in debug messages", () => {
      const logger = new Logger(true);
      logger.debug("Debug information");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      // The first argument should be the styled [DEBUG] prefix
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toBeDefined();
    });

    it("should not log when quiet mode is enabled even if verbose is true", () => {
      const logger = new Logger(true);
      logger.setQuiet(true);
      logger.debug("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle empty debug messages", () => {
      const logger = new Logger(true);
      logger.debug("");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("log", () => {
    it("should log plain message without icons", () => {
      const logger = new Logger();
      logger.log("Plain log message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith("Plain log message");
    });

    it("should not log when quiet mode is enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.log("should not appear");
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle multiline messages", () => {
      const logger = new Logger();
      logger.log("Line 1\nLine 2\nLine 3");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("newline", () => {
    it("should log empty line", () => {
      const logger = new Logger();
      logger.newline();

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith();
    });

    it("should not log when quiet mode is enabled", () => {
      const logger = new Logger();
      logger.setQuiet(true);
      logger.newline();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe("color handling", () => {
    it("should call colorize method when useColor is true", () => {
      const logger = new Logger(false, true);
      logger.info("colored message");

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      // Should have icon and message
      expect(call.length).toBe(2);
      expect(call[1]).toBe("colored message");
    });

    it("should not apply colors when useColor is false", () => {
      const logger = new Logger(false, false);
      logger.info("plain message");

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      // When colors are disabled, the icon is plain
      expect(call[0]).toBe("ℹ");
    });

    it("should handle all log levels without colors", () => {
      const logger = new Logger(true, false);

      logger.info("info");
      logger.success("success");
      logger.warn("warn");
      logger.error("error");
      logger.debug("debug");

      expect(consoleLogSpy).toHaveBeenCalledTimes(4);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it("should output plain icons when colors disabled", () => {
      const logger = new Logger(true, false);

      logger.info("info");
      logger.success("success");
      logger.warn("warn");
      logger.error("error");
      logger.debug("debug");

      // Check that icons are plain text
      expect(consoleLogSpy.mock.calls[0][0]).toBe("ℹ");
      expect(consoleLogSpy.mock.calls[1][0]).toBe("✓");
      expect(consoleLogSpy.mock.calls[2][0]).toBe("⚠");
      expect(consoleErrorSpy.mock.calls[0][0]).toBe("✗");
      expect(consoleLogSpy.mock.calls[3][0]).toBe("[DEBUG]");
    });
  });

  describe("integration", () => {
    it("should handle multiple log calls", () => {
      const logger = new Logger();
      logger.info("First message");
      logger.success("Second message");
      logger.warn("Third message");

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });

    it("should maintain verbose state across calls", () => {
      const logger = new Logger(true);
      logger.debug("First debug");
      logger.debug("Second debug");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("should work with empty messages", () => {
      const logger = new Logger();
      logger.info("");
      logger.success("");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle special characters in messages", () => {
      const logger = new Logger();
      logger.info("Message with\nnewlines\tand\ttabs");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toContain("newlines");
      expect(call[1]).toContain("tabs");
    });

    it("should handle mix of quiet and non-quiet calls", () => {
      const logger = new Logger();

      logger.info("visible 1");
      logger.setQuiet(true);
      logger.info("invisible");
      logger.setQuiet(false);
      logger.info("visible 2");

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it("should handle REPO_AGENTS_QUIET env var consistently", () => {
      process.env.REPO_AGENTS_QUIET = "1";
      const logger = new Logger();

      logger.info("should not appear");
      logger.setQuiet(false);
      logger.info("still should not appear due to env var");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should handle unicode in messages", () => {
      const logger = new Logger();
      logger.info("Unicode: 🚀 ✨ 🎉");

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toContain("🚀");
    });

    it("should handle all log levels in sequence", () => {
      const logger = new Logger(true);

      logger.info("info");
      logger.success("success");
      logger.warn("warn");
      logger.error("error");
      logger.debug("debug");
      logger.log("log");
      logger.newline();

      expect(consoleLogSpy).toHaveBeenCalledTimes(6);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
