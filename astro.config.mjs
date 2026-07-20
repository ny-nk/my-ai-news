import { defineConfig } from 'astro/config';

// ローカルは既定 '/'、GitHub Pages では CI が BASE_PATH='/my-ai-news/' を渡す
const base = process.env.BASE_PATH || '/';
const site = process.env.SITE_URL || undefined;

export default defineConfig({
  output: 'static',
  base,
  site,
});
