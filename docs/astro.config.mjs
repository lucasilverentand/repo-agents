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
          label: 'Guide',
          items: [
            { label: 'Agent Definition', slug: 'guide/agent-definition' },
            { label: 'Outputs', slug: 'guide/outputs' },
            { label: 'Permissions', slug: 'guide/permissions' },
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
          label: 'CLI Reference',
          items: [
            { label: 'init', slug: 'cli/init' },
            { label: 'compile', slug: 'cli/compile' },
            { label: 'validate', slug: 'cli/validate' },
            { label: 'list', slug: 'cli/list' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'Issue Triage', slug: 'examples/issue-triage' },
            { label: 'PR Review', slug: 'examples/pr-review' },
            { label: 'Daily Summary', slug: 'examples/daily-summary' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration', slug: 'reference/configuration' },
            { label: 'Security', slug: 'reference/security' },
          ],
        },
      ],
    }),
  ],
});
