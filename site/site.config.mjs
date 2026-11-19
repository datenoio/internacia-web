// Site address and indexing switch (SPEC §11.2).
//
// SITE_URL is the only place the site's public address is written. Canonical URLs, the
// sitemap, JSON `meta` and llms.txt read it from here. When the custom domain is live,
// change it to "https://<DOMAIN>/", set INDEXABLE to true and add public/CNAME.
export const SITE_URL = 'https://datenoio.github.io/internacia-web/';

// The temporary GitHub Pages address must not be indexed by search engines.
export const INDEXABLE = false;
