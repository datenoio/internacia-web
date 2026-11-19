import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { countries } from '../lib/data';
import { enumLabel } from '../lib/format';
import { frontMatter, table } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, countryMd, path } from '../lib/urls';

export const GET: APIRoute = () =>
  markdown(
    [
      frontMatter({ type: 'index', section: 'countries', url: absolute(path('countries/')), json: absolute(path('api/v1/countries.json')), data_version: meta.data.version }),
      `# Countries and territories (${countries().length})\n`,
      `Card per record: ${absolute(path('countries/{code}.md'))} (code in lowercase). ISO 3166-1 entries have code status \`official_iso3166_1\` (${meta.counts.iso_countries} records).\n`,
      table(
        ['Code', 'ISO3', 'Name', 'Entity type', 'Code status', 'UN status', 'Current memberships', 'Markdown'],
        countries().map((c) => [c.code, c.iso3code, c.name, enumLabel('entity_type', c.entity_type), c.code_status, c.un_status, c._current_member_count, absolute(countryMd(c.code))]),
      ),
    ].join('\n'),
  );
