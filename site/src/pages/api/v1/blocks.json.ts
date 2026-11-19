import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { blocks } from '../../../lib/data';
import { absolute, blockJson, path } from '../../../lib/urls';

// Lite list (SPEC §7.4): enough to pick an intblock and build its URLs.
export const GET: APIRoute = () =>
  json(
    {
      meta: apiMeta({ html: path('blocks/'), markdown: path('blocks.md') }),
      count: blocks().length,
      data: blocks().map((b) => ({
        id: b.id,
        name: b.name,
        _acronym: b._acronym,
        blocktype: b.blocktype,
        status: b.status,
        scope_category: b.scope_category ?? null,
        geographic_scope: b.geographic_scope ?? null,
        founded: b.founded ?? null,
        headquarters_country: b.headquarters?.country ?? null,
        _active: b._active,
        _current_member_count: b._current_member_count,
        _json: absolute(blockJson(b.id)),
      })),
    },
    false,
  );
