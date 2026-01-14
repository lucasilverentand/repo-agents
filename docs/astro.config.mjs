import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeRapide from 'starlight-theme-rapide';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://lucasilverentand.github.io',
  base: '/repo-agents',
  integrations: [
    starlight({
      title: 'Repo Agents',
      description: 'CLI tool for creating AI-powered GitHub Actions workflows from markdown agent definitions',
      plugins: [starlightThemeRapide()],
      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/lucasilverentand/repo-agents',
        },
      ],
      sidebar: [
        {
          label: 'Getting Started',
          autogenerate: { directory: 'getting-started' }
        },
        {
          label: 'Anatomy of an Agent',
          items: []
        }
      ]
    }),
    react(),
  ],
});
