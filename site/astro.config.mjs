import { defineConfig } from 'astro/config';
import { SITE_URL } from './site.config.mjs';

const url = new URL(SITE_URL);

export default defineConfig({
  site: url.origin,
  base: url.pathname,
  trailingSlash: 'always',
  // Compression drops the space between text and a link that starts on the next line
  // ("from<a>…"). Keep source whitespace; gzip makes the size difference negligible.
  compressHTML: false,
  build: {
    format: 'directory',
  },
});
