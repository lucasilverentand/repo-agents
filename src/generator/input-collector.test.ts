import { InputCollector } from './input-collector';
import type { InputConfig } from '../types';

describe('InputCollector', () => {
  let collector: InputCollector;

  beforeEach(() => {
    collector = new InputCollector();
  });

  describe('generateCollectionScript', () => {
    it('should generate script with default time filter', () => {
      const config: InputConfig = {
        issues: { states: ['open'] },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('#!/bin/bash');
      expect(script).toContain('COLLECTED_DATA=""');
      expect(script).toContain('TOTAL_ITEMS=0');
      expect(script).toContain('Determine time filter');
    });

    it('should use last-run as default since value', () => {
      const config: InputConfig = {
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('last-run');
      expect(script).toContain('LAST_RUN');
      expect(script).toContain('workflow_runs');
    });

    it('should parse hour duration format', () => {
      const config: InputConfig = {
        since: '12h',
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('12h');
      expect(script).toContain('HOURS');
      expect(script).toContain('hours ago');
    });

    it('should parse day duration format', () => {
      const config: InputConfig = {
        since: '7d',
        pull_requests: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('7d');
      expect(script).toContain('DAYS');
      expect(script).toContain('days ago');
    });

    it('should use custom min_items threshold', () => {
      const config: InputConfig = {
        min_items: 5,
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('minimum: 5');
      expect(script).toContain('if [ "$TOTAL_ITEMS" -lt "5" ]');
    });

    it('should default min_items to 1', () => {
      const config: InputConfig = {
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('minimum: 1');
      expect(script).toContain('if [ "$TOTAL_ITEMS" -lt "1" ]');
    });

    it('should output has-inputs flag', () => {
      const config: InputConfig = {
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('has-inputs=true');
      expect(script).toContain('has-inputs=false');
      expect(script).toContain('$GITHUB_OUTPUT');
    });

    it('should save collected data to file', () => {
      const config: InputConfig = {
        pull_requests: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('/tmp/inputs.md');
      expect(script).toContain('echo "$COLLECTED_DATA" >');
    });
  });

  describe('issues collection', () => {
    it('should generate issues collection script', () => {
      const config: InputConfig = {
        issues: {
          states: ['open', 'closed'],
          limit: 50,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Issues');
      expect(script).toContain('## 📋 Issues');
      expect(script).toContain('repos/${{ github.repository }}/issues');
      // Multiple states are normalized to 'all' since GitHub API doesn't support comma-separated
      expect(script).toContain('issues?state=all&per_page=50');
    });

    it('should filter issues by labels', () => {
      const config: InputConfig = {
        issues: {
          labels: ['bug', 'enhancement'],
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('bug');
      expect(script).toContain('enhancement');
      expect(script).toContain('any(IN(');
    });

    it('should exclude issues by labels', () => {
      const config: InputConfig = {
        issues: {
          exclude_labels: ['wontfix', 'duplicate'],
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('wontfix');
      expect(script).toContain('duplicate');
      expect(script).toContain('| not');
    });

    it('should default to all states when none specified', () => {
      const config: InputConfig = {
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      // Default to 'all' when no states specified
      expect(script).toContain('issues?state=all&per_page=');
    });

    it('should filter pull requests from issues', () => {
      const config: InputConfig = {
        issues: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('select(.pull_request == null');
    });
  });

  describe('pull requests collection', () => {
    it('should generate PR collection script', () => {
      const config: InputConfig = {
        pull_requests: {
          states: ['open'],
          limit: 25,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Pull Requests');
      expect(script).toContain('## 🔀 Pull Requests');
      expect(script).toContain('repos/${{ github.repository }}/pulls');
      // State and per_page are now URL query parameters
      expect(script).toContain('pulls?state=open&per_page=25');
    });

    it('should handle merged state filtering', () => {
      const config: InputConfig = {
        pull_requests: {
          states: ['merged'],
        },
      };

      const script = collector.generateCollectionScript(config);

      // 'merged' state uses 'closed' API state and filters for merged_at
      expect(script).toContain('pulls?state=closed&per_page=');
      expect(script).toContain('merged_at != null');
    });

    it('should filter PRs by labels', () => {
      const config: InputConfig = {
        pull_requests: {
          labels: ['ready-for-review'],
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('ready-for-review');
    });
  });

  describe('discussions collection', () => {
    it('should generate discussions collection script using GraphQL', () => {
      const config: InputConfig = {
        discussions: {
          limit: 30,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Discussions');
      expect(script).toContain('## 💬 Discussions');
      expect(script).toContain('gh api graphql');
      expect(script).toContain('repository(owner: $owner, name: $repo)');
      expect(script).toContain('limit="30"');
    });

    it('should filter by categories', () => {
      const config: InputConfig = {
        discussions: {
          categories: ['Q&A', 'Ideas'],
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('Q&A');
      expect(script).toContain('Ideas');
      expect(script).toContain('category.name');
    });

    it('should filter answered discussions', () => {
      const config: InputConfig = {
        discussions: {
          answered: true,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('answer.isAnswer == true');
    });

    it('should filter unanswered discussions', () => {
      const config: InputConfig = {
        discussions: {
          unanswered: true,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('answer.isAnswer != true');
    });
  });

  describe('commits collection', () => {
    it('should generate commits collection script', () => {
      const config: InputConfig = {
        commits: {
          branches: ['main', 'develop'],
          limit: 20,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Commits');
      expect(script).toContain('## 📝 Commits');
      expect(script).toContain('"main"');
      expect(script).toContain('"develop"');
      expect(script).toContain('per_page="20"');
    });

    it('should default to main and master branches', () => {
      const config: InputConfig = {
        commits: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('"main"');
      expect(script).toContain('"master"');
    });

    it('should check if branch exists', () => {
      const config: InputConfig = {
        commits: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('repos/${{ github.repository }}/branches/$BRANCH');
      expect(script).toContain('if ! gh api');
    });
  });

  describe('releases collection', () => {
    it('should generate releases collection script', () => {
      const config: InputConfig = {
        releases: {
          limit: 10,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Releases');
      expect(script).toContain('## 🚀 Releases');
      // per_page is now a URL query parameter
      expect(script).toContain('repos/${{ github.repository }}/releases?per_page=10');
    });

    it('should exclude prereleases by default', () => {
      const config: InputConfig = {
        releases: {
          prerelease: false,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('prerelease == false');
    });

    it('should exclude drafts by default', () => {
      const config: InputConfig = {
        releases: {
          draft: false,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('draft == false');
    });
  });

  describe('workflow runs collection', () => {
    it('should generate workflow runs collection script', () => {
      const config: InputConfig = {
        workflow_runs: {
          status: ['failure'],
          limit: 15,
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Workflow Runs');
      expect(script).toContain('## ⚙️ Workflow Runs');
      // per_page is now a URL query parameter
      expect(script).toContain('repos/${{ github.repository }}/actions/runs?per_page=15');
      expect(script).toContain('failure');
    });

    it('should default to failure status', () => {
      const config: InputConfig = {
        workflow_runs: {},
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('failure');
    });

    it('should filter by multiple statuses', () => {
      const config: InputConfig = {
        workflow_runs: {
          status: ['failure', 'cancelled'],
        },
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('failure');
      expect(script).toContain('cancelled');
    });
  });

  describe('stars and forks collection', () => {
    it('should generate stars collection script', () => {
      const config: InputConfig = {
        stars: true,
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Stars');
      expect(script).toContain('stargazers_count');
      expect(script).toContain('## ⭐ Stars');
    });

    it('should generate forks collection script', () => {
      const config: InputConfig = {
        forks: true,
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Forks');
      expect(script).toContain('forks_count');
      expect(script).toContain('## 🍴 Forks');
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple input types together', () => {
      const config: InputConfig = {
        issues: { states: ['open'] },
        pull_requests: { states: ['open'] },
        discussions: { unanswered: true },
        since: '24h',
        min_items: 3,
      };

      const script = collector.generateCollectionScript(config);

      expect(script).toContain('# Collect Issues');
      expect(script).toContain('# Collect Pull Requests');
      expect(script).toContain('# Collect Discussions');
      expect(script).toContain('24h');
      expect(script).toContain('minimum: 3');
    });

    it('should generate valid bash script structure', () => {
      const config: InputConfig = {
        issues: {},
        pull_requests: {},
      };

      const script = collector.generateCollectionScript(config);

      // Check for bash script essentials
      expect(script.startsWith('#!/bin/bash')).toBe(true);
      expect(script).toContain('set -e');
      expect(script).toContain('TOTAL_ITEMS');
      expect(script).toContain('COLLECTED_DATA');
      expect(script).toContain('$GITHUB_OUTPUT');
    });
  });
});
