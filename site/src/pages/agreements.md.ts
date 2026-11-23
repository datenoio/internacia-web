import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { REGISTRY_SCOPE_NOTE, agreementStatusLabel, agreementTypeLabel } from '../lib/agreements';
import { agreements } from '../lib/data';
import { frontMatter, table } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const GET: APIRoute = () =>
  markdown(
    [
      frontMatter({ type: 'index', section: 'trade_agreements', url: absolute(path('agreements/')), json: absolute(path('api/v1/agreements.json')), data_version: meta.data.version }),
      `# Trade agreements (${agreements().length})\n`,
      `The internacia-db trade agreements registry: free trade agreements, customs unions, preferential and partial-scope agreements and preference schemes, bilateral ones included. ${REGISTRY_SCOPE_NOTE} Records marked "catalogue" come from WTO RTA-IS or ADB ARIC and were not checked against the treaty text.\n`,
      `Card per record: ${absolute(path('agreements/{id}.md'))} (ID in lowercase); JSON: ${absolute(path('api/v1/agreements/{ID}.json'))} (exact ID).\n`,
      table(
        ['ID', 'Name', 'Type', 'Status', 'Signed', 'In force', 'Parties', 'Verification'],
        agreements().map((a) => [a.id, a._name, agreementTypeLabel(a.agreement_type), agreementStatusLabel(a.status), a.signed, a.in_force, a._party_count, a.verification]),
      ),
    ].join('\n'),
  );
