import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { Logger } from './logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: ReturnType<typeof spyOn>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    consoleLogSpy = spyOn(console, 'log');
    consoleErrorSpy = spyOn(console, 'error');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with verbose=false by default', () => {
      logger = new Logger();
      expect(logger).toBeDefined();
    });

    it('should create logger with verbose=true when specified', () => {
      logger = new Logger(true);
      expect(logger).toBeDefined();
    });
  });

  describe('info', () => {
    it('should log info message with blue icon', () => {
      logger = new Logger();
      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call.join(' ')).toContain('test message');
    });
  });

  describe('success', () => {
    it('should log success message with green icon', () => {
      logger = new Logger();
      logger.success('operation completed');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call.join(' ')).toContain('operation completed');
    });
  });

  describe('warn', () => {
    it('should log warning message with yellow icon', () => {
      logger = new Logger();
      logger.warn('warning message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call.join(' ')).toContain('warning message');
    });
  });

  describe('error', () => {
    it('should log error message with red icon to stderr', () => {
      logger = new Logger();
      logger.error('error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0];
      expect(call.join(' ')).toContain('error occurred');
    });
  });

  describe('debug', () => {
    it('should not log debug message when verbose is false', () => {
      logger = new Logger(false);
      logger.debug('debug info');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log debug message when verbose is true', () => {
      logger = new Logger(true);
      logger.debug('debug info');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call.join(' ')).toContain('debug info');
      expect(call.join(' ')).toContain('[DEBUG]');
    });
  });

  describe('log', () => {
    it('should log plain message without formatting', () => {
      logger = new Logger();
      logger.log('plain message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('plain message');
    });
  });

  describe('newline', () => {
    it('should log empty line', () => {
      logger = new Logger();
      logger.newline();

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith();
    });
  });
});

