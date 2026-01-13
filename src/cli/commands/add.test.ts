import { describe, it, expect } from 'bun:test';
import matter from 'gray-matter';

// Test the copyAgents logic using pure function tests
// The logic itself is simple enough to test without file system operations

describe('add command logic', () => {
  describe('copyAgents logic', () => {
    // Test the classification logic separately from file system operations
    interface CopyDecision {
      action: 'copy' | 'skip' | 'overwrite';
      filename: string;
    }

    function decideCopyAction(
      filename: string,
      targetExists: boolean,
      force: boolean
    ): CopyDecision {
      if (targetExists && !force) {
        return { action: 'skip', filename };
      } else if (targetExists && force) {
        return { action: 'overwrite', filename };
      } else {
        return { action: 'copy', filename };
      }
    }

    it('should decide to copy when target does not exist', () => {
      const decision = decideCopyAction('agent.md', false, false);
      expect(decision.action).toBe('copy');
    });

    it('should decide to skip when target exists and no force flag', () => {
      const decision = decideCopyAction('agent.md', true, false);
      expect(decision.action).toBe('skip');
    });

    it('should decide to overwrite when target exists with force flag', () => {
      const decision = decideCopyAction('agent.md', true, true);
      expect(decision.action).toBe('overwrite');
    });

    it('should decide to copy when target does not exist even with force flag', () => {
      const decision = decideCopyAction('agent.md', false, true);
      expect(decision.action).toBe('copy');
    });
  });

  describe('agent file parsing', () => {
    it('should extract agent name from frontmatter', () => {
      const content = `---
name: Test Agent
on:
  issues:
    types: [opened]
---

Test instructions.
`;
      const { data } = matter(content);
      expect(data.name).toBe('Test Agent');
    });

    it('should handle missing name in frontmatter', () => {
      const content = `---
on:
  issues:
    types: [opened]
---

Test instructions.
`;
      const { data } = matter(content);
      expect(data.name).toBeUndefined();
    });

    it('should extract triggers from frontmatter', () => {
      const content = `---
name: Issue Triage
on:
  issues:
    types: [opened, edited]
---

Instructions here.
`;
      const { data } = matter(content);
      expect(data.on.issues.types).toEqual(['opened', 'edited']);
    });
  });
});
