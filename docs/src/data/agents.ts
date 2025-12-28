/**
 * Agent metadata for the interactive gallery
 */

export interface Agent {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'available' | 'planned';
  triggers: string[];
  outputs: string[];
  useCases: string[];
  exampleUrl?: string;
  code?: string;
}

export const categories = [
  'All',
  'Issue Management',
  'Code Review',
  'Repository Maintenance',
  'Project Intelligence',
] as const;

export type Category = typeof categories[number];

export const agents: Agent[] = [
  {
    id: 'issue-triage',
    name: 'Issue Triage Agent',
    description: 'Automatically categorizes and prioritizes new issues, welcomes contributors, and adds appropriate labels.',
    category: 'Issue Management',
    status: 'available',
    triggers: ['issues.opened'],
    outputs: ['add-comment', 'add-label'],
    useCases: [
      'Welcome first-time contributors',
      'Add priority and type labels',
      'Route issues to the right team',
      'Request missing information',
    ],
    exampleUrl: '/gh-claude/examples/issue-triage/',
    code: `on:
  issues:
    types: [opened]
outputs:
  add-comment: { max: 1 }
  add-label: true`,
  },
  {
    id: 'pr-review',
    name: 'PR Review Agent',
    description: 'Performs initial code review on pull requests, checking for common issues, missing tests, and documentation gaps.',
    category: 'Code Review',
    status: 'available',
    triggers: ['pull_request.opened', 'pull_request.synchronize'],
    outputs: ['add-comment', 'add-label'],
    useCases: [
      'Check code quality and style',
      'Identify missing tests',
      'Flag documentation gaps',
      'Suggest improvements',
    ],
    exampleUrl: '/gh-claude/examples/pr-review/',
    code: `on:
  pull_request:
    types: [opened, synchronize]
outputs:
  add-comment: { max: 1 }
  add-label: true`,
  },
  {
    id: 'stale-issue-manager',
    name: 'Stale Issue Manager',
    description: 'Identifies inactive issues, adds warning labels, and closes after extended inactivity.',
    category: 'Repository Maintenance',
    status: 'available',
    triggers: ['schedule.cron'],
    outputs: ['add-label', 'add-comment', 'close-issue'],
    useCases: [
      'Warn about stale issues',
      'Close abandoned issues',
      'Keep backlog clean',
      'Request updates from authors',
    ],
    exampleUrl: '/gh-claude/examples/daily-summary/',
    code: `on:
  schedule:
    - cron: '0 9 * * 1'
inputs:
  issues:
    state: open
    labels: []
  since: "30d"
outputs:
  add-label: true
  add-comment: true
  close-issue: true`,
  },
  {
    id: 'daily-summary',
    name: 'Daily Summary Agent',
    description: 'Generates daily activity summaries including new issues, merged PRs, and project metrics.',
    category: 'Project Intelligence',
    status: 'available',
    triggers: ['schedule.cron'],
    outputs: ['create-discussion'],
    useCases: [
      'Daily activity reports',
      'Weekly summaries',
      'Metrics tracking',
      'Team updates',
    ],
    exampleUrl: '/gh-claude/examples/daily-summary/',
    code: `on:
  schedule:
    - cron: '0 17 * * *'
inputs:
  issues:
    state: all
  pull_requests:
    state: all
  since: "24h"
outputs:
  create-discussion: { max: 1 }`,
  },
  {
    id: 'auto-labeler',
    name: 'Auto Labeler',
    description: 'Automatically labels issues and PRs based on content, file changes, and patterns.',
    category: 'Issue Management',
    status: 'planned',
    triggers: ['issues.opened', 'pull_request.opened'],
    outputs: ['add-label'],
    useCases: [
      'Label by file patterns',
      'Categorize by content',
      'Detect breaking changes',
      'Flag dependencies',
    ],
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    description: 'Scans PRs for potential security issues and dependency vulnerabilities.',
    category: 'Code Review',
    status: 'planned',
    triggers: ['pull_request.opened', 'pull_request.synchronize'],
    outputs: ['add-comment', 'add-label'],
    useCases: [
      'Check for security vulnerabilities',
      'Flag sensitive data exposure',
      'Validate dependencies',
      'Suggest security fixes',
    ],
  },
  {
    id: 'release-notes',
    name: 'Release Notes Generator',
    description: 'Automatically generates release notes from commits and merged PRs.',
    category: 'Project Intelligence',
    status: 'planned',
    triggers: ['release.published'],
    outputs: ['update-file', 'create-discussion'],
    useCases: [
      'Generate changelog',
      'Summarize changes',
      'Categorize updates',
      'Create announcements',
    ],
  },
  {
    id: 'docs-updater',
    name: 'Documentation Updater',
    description: 'Suggests documentation updates when code changes affect public APIs.',
    category: 'Repository Maintenance',
    status: 'planned',
    triggers: ['pull_request.opened'],
    outputs: ['add-comment', 'update-file'],
    useCases: [
      'Flag missing docs',
      'Suggest doc updates',
      'Check API changes',
      'Update examples',
    ],
  },
];
