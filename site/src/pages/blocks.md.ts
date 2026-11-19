import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { blocks } from '../lib/data';
import { frontMatter, table } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const GET: APIRoute = () =>
  markdown(
    [
      frontMatter({ type: 'index', section: 'intblocks', url: absolute(path('blocks/')), json: absolute(path('api/v1/blocks.json')), data_version: meta.data.version }),
      `# International organizations and groupings (${blocks().length})\n`,
      `Card per record: ${absolute(path('blocks/{id}.md'))} (ID in lowercase); JSON: ${absolute(path('api/v1/blocks/{ID}.json'))} (exact ID).\n`,
      table(
        ['ID', 'Name', 'Acronym', 'Block types', 'Status', 'Founded', 'Current members'],
        blocks().map((b) => [b.id, b.name, b._acronym, b.blocktype.join(', '), b.status + (b._active ? '' : ' (inactive)'), b.founded, b._current_member_count]),
      ),
    ].join('\n'),
  );
