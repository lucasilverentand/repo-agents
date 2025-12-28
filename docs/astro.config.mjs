import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';

export default defineConfig({
  site: 'https://lucasilverentand.github.io',
  base: '/gh-claude',
  integrations: [
    starlight({
      title: 'gh-claude',
      description: 'GitHub CLI extension for creating Claude-powered GitHub Actions workflows',
      plugins: [starlightThemeRapide()],
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/lucasilverentand/gh-claude',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Overview', slug: 'guide' },
            { label: 'How It Works', slug: 'guide/how-it-works' },
            { label: 'Agent Definition', slug: 'guide/agent-definition' },
            { label: 'Permissions', slug: 'guide/permissions' },
            { label: 'Cost Estimation', slug: 'guide/cost-estimation' },
          ],
        },
        {
          label: 'Authentication & Security',
          items: [
            { label: 'Authentication', slug: 'guide/authentication' },
            { label: 'Security Overview', slug: 'reference/security' },
            { label: 'Security Best Practices', slug: 'guide/security-best-practices' },
            { label: 'Security Model', slug: 'reference/security-model' },
            { label: 'Security Checklist', slug: 'reference/security-checklist' },
          ],
        },
        {
          label: 'Triggers',
          items: [
            { label: 'Overview', slug: 'triggers' },
            { label: 'Issues', slug: 'triggers/issues' },
            { label: 'Pull Requests', slug: 'triggers/pull-requests' },
            { label: 'Discussions', slug: 'triggers/discussions' },
            { label: 'Schedule', slug: 'triggers/schedule' },
            { label: 'Workflow Dispatch', slug: 'triggers/workflow-dispatch' },
            { label: 'Repository Dispatch', slug: 'triggers/repository-dispatch' },
          ],
        },
        {
          label: 'Inputs',
          items: [
            { label: 'Overview', slug: 'inputs' },
            { label: 'Issues', slug: 'inputs/issues' },
            { label: 'Pull Requests', slug: 'inputs/pull-requests' },
            { label: 'Discussions', slug: 'inputs/discussions' },
            { label: 'Commits', slug: 'inputs/commits' },
            { label: 'Releases', slug: 'inputs/releases' },
            { label: 'Workflow Runs', slug: 'inputs/workflow-runs' },
            { label: 'Stars & Forks', slug: 'inputs/stars-and-forks' },
            { label: 'Time Filtering', slug: 'inputs/time-filtering' },
          ],
        },
        {
          label: 'Outputs',
          items: [
            { label: 'Overview', slug: 'outputs' },
            { label: 'Comments', slug: 'outputs/comments' },
            { label: 'Labels', slug: 'outputs/labels' },
            { label: 'Issues', slug: 'outputs/issues' },
            { label: 'Pull Requests', slug: 'outputs/pull-requests' },
            { label: 'Discussions', slug: 'outputs/discussions' },
            { label: 'Files', slug: 'outputs/files' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Overview', slug: 'examples' },
            { label: 'Issue Triage', slug: 'examples/issue-triage' },
            { label: 'PR Review', slug: 'examples/pr-review' },
            { label: 'Daily Summary', slug: 'examples/daily-summary' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', slug: 'cli' },
            { label: 'init', slug: 'cli/init' },
            { label: 'compile', slug: 'cli/compile' },
            { label: 'validate', slug: 'cli/validate' },
            { label: 'list', slug: 'cli/list' },
            { label: 'setup-token', slug: 'cli/setup-token' },
            { label: 'setup-app', slug: 'cli/setup-app' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Overview', slug: 'reference' },
            { label: 'Quick Reference', slug: 'reference/quick-reference' },
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'FAQ', slug: 'reference/faq' },
          ],
        },
        {
          label: 'Advanced',
          collapsed: true,
          items: [
            { label: 'Advanced Topics', slug: 'guide/advanced' },
            { label: 'Multi-Agent Patterns', slug: 'guide/multi-agent-patterns' },
            { label: 'Testing Strategies', slug: 'guide/testing-strategies' },
            { label: 'Troubleshooting', slug: 'guide/troubleshooting' },
          ],
        },
        {
          label: 'Agent Gallery',
          collapsed: true,
          items: [
            { label: 'Overview', slug: 'agents' },
            { label: 'Available Agents', slug: 'agents/gallery' },
            { label: 'Roadmap', slug: 'agents/roadmap' },
          ],
        },
      ],
    }),
  ],
});
