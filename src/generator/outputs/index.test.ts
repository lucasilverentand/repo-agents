import { registry, getOutputHandler } from './index';
import type { Output } from '../../types';
import type { RuntimeContext } from './base';

describe('OutputHandlerRegistry', () => {
  const mockRuntime: RuntimeContext = {
    repository: 'owner/repo',
    issueNumber: '123',
    prNumber: '456',
  };

  const mockConfig = {
    max: 5,
  };

  describe('registration', () => {
    it('should register all expected output handlers', () => {
      const expectedOutputs: Output[] = [
        'add-comment',
        'add-label',
        'remove-label',
        'create-issue',
        'create-discussion',
        'create-pr',
        'update-file',
        'close-issue',
        'close-pr',
      ];

      expectedOutputs.forEach((output) => {
        expect(registry.hasHandler(output)).toBe(true);
      });
    });

    it('should return all registered output types', () => {
      const registeredOutputs = registry.getRegisteredOutputs();

      expect(registeredOutputs).toContain('add-comment');
      expect(registeredOutputs).toContain('add-label');
      expect(registeredOutputs).toContain('remove-label');
      expect(registeredOutputs).toContain('create-issue');
      expect(registeredOutputs).toContain('create-discussion');
      expect(registeredOutputs).toContain('create-pr');
      expect(registeredOutputs).toContain('update-file');
      expect(registeredOutputs).toContain('close-issue');
      expect(registeredOutputs).toContain('close-pr');

      expect(registeredOutputs.length).toBe(9);
    });
  });

  describe('getHandler', () => {
    it('should retrieve add-comment handler with correct interface', () => {
      const handler = registry.getHandler('add-comment');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve add-label handler with correct interface', () => {
      const handler = registry.getHandler('add-label');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve remove-label handler with correct interface', () => {
      const handler = registry.getHandler('remove-label');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve create-issue handler with correct interface', () => {
      const handler = registry.getHandler('create-issue');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve create-discussion handler with correct interface', () => {
      const handler = registry.getHandler('create-discussion');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve create-pr handler with correct interface', () => {
      const handler = registry.getHandler('create-pr');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve update-file handler with correct interface', () => {
      const handler = registry.getHandler('update-file');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve close-issue handler with correct interface', () => {
      const handler = registry.getHandler('close-issue');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should retrieve close-pr handler with correct interface', () => {
      const handler = registry.getHandler('close-pr');

      expect(handler).toBeDefined();
      expect(typeof handler.getContextScript).toBe('function');
      expect(typeof handler.generateSkill).toBe('function');
      expect(typeof handler.generateValidationScript).toBe('function');
    });

    it('should throw error for unregistered handler', () => {
      expect(() => {
        // @ts-expect-error Testing invalid output type
        registry.getHandler('non-existent-output');
      }).toThrow('No handler registered for output type: non-existent-output');
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handlers', () => {
      expect(registry.hasHandler('add-comment')).toBe(true);
      expect(registry.hasHandler('create-pr')).toBe(true);
      expect(registry.hasHandler('update-file')).toBe(true);
    });

    it('should return false for unregistered handlers', () => {
      // @ts-expect-error Testing invalid output type
      expect(registry.hasHandler('unknown-output')).toBe(false);
    });
  });

  describe('getOutputHandler function', () => {
    it('should be a convenience function that calls registry.getHandler', () => {
      const handler1 = getOutputHandler('add-comment');
      const handler2 = registry.getHandler('add-comment');

      expect(handler1).toBe(handler2);
    });

    it('should throw same error as registry for missing handlers', () => {
      expect(() => {
        // @ts-expect-error Testing invalid output type
        getOutputHandler('missing-handler');
      }).toThrow('No handler registered for output type: missing-handler');
    });
  });

  describe('handler methods', () => {
    it('should verify all handlers implement getContextScript', () => {
      const outputs: Output[] = [
        'add-comment',
        'add-label',
        'remove-label',
        'create-issue',
        'create-discussion',
        'create-pr',
        'update-file',
        'close-issue',
        'close-pr',
      ];

      outputs.forEach((output) => {
        const handler = registry.getHandler(output);
        const result = handler.getContextScript(mockRuntime);
        
        // Result should be either a string or null
        expect(result === null || typeof result === 'string').toBe(true);
      });
    });

    it('should verify all handlers implement generateSkill', () => {
      const outputs: Output[] = [
        'add-comment',
        'add-label',
        'remove-label',
        'create-issue',
        'create-discussion',
        'create-pr',
        'update-file',
        'close-issue',
        'close-pr',
      ];

      outputs.forEach((output) => {
        const handler = registry.getHandler(output);
        const result = handler.generateSkill(mockConfig);
        
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should verify all handlers implement generateValidationScript', () => {
      const outputs: Output[] = [
        'add-comment',
        'add-label',
        'remove-label',
        'create-issue',
        'create-discussion',
        'create-pr',
        'update-file',
        'close-issue',
        'close-pr',
      ];

      outputs.forEach((output) => {
        const handler = registry.getHandler(output);
        const result = handler.generateValidationScript(mockConfig, mockRuntime);
        
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });
  });

  describe('integration', () => {
    it('should handle multiple handler retrievals', () => {
      const handler1 = getOutputHandler('add-comment');
      const handler2 = getOutputHandler('create-pr');
      const handler3 = getOutputHandler('update-file');

      expect(handler1).toBeDefined();
      expect(handler2).toBeDefined();
      expect(handler3).toBeDefined();
      expect(handler1).not.toBe(handler2);
      expect(handler2).not.toBe(handler3);
    });

    it('should maintain handler consistency across calls', () => {
      const handler1a = getOutputHandler('add-label');
      const handler1b = getOutputHandler('add-label');

      expect(handler1a).toBe(handler1b); // Should be same instance
    });
  });
});

