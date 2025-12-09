import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';

export default defineConfig({
  integrations: [
    starlight({
      title: 'gh-claude',
      description: 'GitHub CLI extension for creating Claude-powered GitHub Actions workflows',
      plugins: [starlightThemeRapide()],
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/yourusername/gh-claude',
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
            { label: 'Triggers', slug: 'guide/triggers' },
            { label: 'Outputs', slug: 'guide/outputs' },
            { label: 'Permissions', slug: 'guide/permissions' },
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
