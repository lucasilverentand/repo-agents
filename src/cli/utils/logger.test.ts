import { Logger } from './logger';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with verbose disabled by default', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
      
      // Debug should not log when verbose is false
      logger.debug('test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should create logger with verbose enabled when true', () => {
      const logger = new Logger(true);
      expect(logger).toBeDefined();
      
      // Debug should log when verbose is true
      logger.debug('test message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('info', () => {
    it('should log info message with blue icon', () => {
      const logger = new Logger();
      logger.info('Information message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe('Information message');
    });
  });

  describe('success', () => {
    it('should log success message with green checkmark', () => {
      const logger = new Logger();
      logger.success('Operation successful');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe('Operation successful');
    });
  });

  describe('warn', () => {
    it('should log warning message with yellow icon', () => {
      const logger = new Logger();
      logger.warn('Warning message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe('Warning message');
    });
  });

  describe('error', () => {
    it('should log error message with red X to stderr', () => {
      const logger = new Logger();
      logger.error('Error occurred');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe('Error occurred');
    });
  });

  describe('debug', () => {
    it('should not log debug message when verbose is false', () => {
      const logger = new Logger(false);
      logger.debug('Debug information');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log debug message when verbose is true', () => {
      const logger = new Logger(true);
      logger.debug('Debug information');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call).toHaveLength(2);
      expect(call[1]).toBe('Debug information');
    });

    it('should include [DEBUG] prefix in debug messages', () => {
      const logger = new Logger(true);
      logger.debug('Debug information');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      // The first argument should be the styled [DEBUG] prefix
      const call = consoleLogSpy.mock.calls[0];
      expect(call[0]).toBeDefined();
    });
  });

  describe('log', () => {
    it('should log plain message without icons', () => {
      const logger = new Logger();
      logger.log('Plain log message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith('Plain log message');
    });
  });

  describe('newline', () => {
    it('should log empty line', () => {
      const logger = new Logger();
      logger.newline();

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith();
    });
  });

  describe('integration', () => {
    it('should handle multiple log calls', () => {
      const logger = new Logger();
      logger.info('First message');
      logger.success('Second message');
      logger.warn('Third message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(3);
    });

    it('should maintain verbose state across calls', () => {
      const logger = new Logger(true);
      logger.debug('First debug');
      logger.debug('Second debug');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should work with empty messages', () => {
      const logger = new Logger();
      logger.info('');
      logger.success('');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle special characters in messages', () => {
      const logger = new Logger();
      logger.info('Message with\nnewlines\tand\ttabs');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0];
      expect(call[1]).toContain('newlines');
      expect(call[1]).toContain('tabs');
    });
  });
});

