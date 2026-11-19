// Build identity and key figures written by pipeline/build_data.py.

export interface SiteMeta {
  data: {
    repository: string;
    tag: string;
    version: string;
    git_commit: string;
    release_url: string;
    build_date: string;
    contract_version: string;
    license: string;
  };
  counts: {
    countries: number;
    iso_countries: number;
    intblocks: number;
    blocktypes: number;
    topics: number;
    memberships: number;
    current_memberships: number;
  };
}

const files = import.meta.glob<{ default: SiteMeta }>('../generated/meta.json', { eager: true });
const loaded = files['../generated/meta.json'];

if (!loaded) {
  throw new Error(
    'site/src/generated/meta.json is missing. Run `python pipeline/fetch.py` and ' +
      '`python pipeline/build_data.py` from the repository root before building the site.',
  );
}

export const meta: SiteMeta = loaded.default;
