import { defineConfig } from 'astro/config';
import { SITE_URL } from './site.config.mjs';
import trimHtml from './scripts/trim-html.mjs';

const url = new URL(SITE_URL);

export default defineConfig({
  site: url.origin,
  base: url.pathname,
  trailingSlash: 'always',
  // Compression drops the space between text and a link that starts on the next line
  // ("from<a>…"). Keep source whitespace; trim-html then removes the indentation after the build
  // and keeps each line break, so the space stays (site size, SPEC §10.3).
  compressHTML: false,
  integrations: [trimHtml()],
  build: {
    format: 'directory',
  },
});
