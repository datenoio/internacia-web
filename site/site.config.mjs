// Site address and indexing switch (SPEC §11.2).
//
// SITE_URL is the only place the site's public address is written. Canonical URLs, the
// sitemap, JSON `meta` and llms.txt read it from here. The custom domain is internacia.io
// (public/CNAME, SPEC §11.2); the old address https://datenoio.github.io/internacia-web/
// redirects to it, path included.
export const SITE_URL = 'https://internacia.io/';

// Search engines may index the site on its own domain.
export const INDEXABLE = true;
