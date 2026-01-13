import { describe, it, expect } from 'bun:test';

// Note: The promptForInput function relies on readline and stdin,
// which are difficult to test without complex mocking.
// These tests verify the module can be imported correctly.

describe('prompts utility', () => {
  it('should export promptForInput function', async () => {
    const { promptForInput } = await import('./prompts');
    expect(typeof promptForInput).toBe('function');
  });

  it('should have correct function signature', async () => {
    const { promptForInput } = await import('./prompts');
    // The function should accept a question string and return a Promise
    expect(promptForInput.length).toBe(1);
  });
});
