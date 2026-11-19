// Build identity and key figures written by pipeline/build_data.py.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

function loadMeta(): SiteMeta {
  const path = join(process.cwd(), 'src', 'generated', 'meta.json');
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SiteMeta;
  } catch {
    throw new Error(
      'site/src/generated/meta.json is missing. Run `python pipeline/fetch.py` and ' +
        '`python pipeline/build_data.py` from the repository root before building the site.',
    );
  }
}

export const meta: SiteMeta = loadMeta();
