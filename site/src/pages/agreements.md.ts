import type { APIRoute } from 'astro';
import { markdown } from '../lib/api';
import { CATALOGUE_SOURCES, REGISTRY_SCOPE_NOTE, agreementStatusLabel, agreementTypeLabel } from '../lib/agreements';
import { agreements } from '../lib/data';
import { frontMatter, table } from '../lib/markdown';
import { meta } from '../lib/meta';
import { absolute, path } from '../lib/urls';

export const GET: APIRoute = () =>
  markdown(
    [
      frontMatter({ type: 'index', section: 'trade_agreements', url: absolute(path('agreements/')), json: absolute(path('api/v1/agreements.json')), data_version: meta.data.version }),
      `# Trade agreements (${agreements().length})\n`,
      `The internacia-db trade agreements registry: free trade agreements, customs unions, preferential and partial-scope agreements, preference schemes, investment treaties and trade relations agreements, bilateral ones included. ${REGISTRY_SCOPE_NOTE} Records marked "catalogue" come from a catalogue (${CATALOGUE_SOURCES}) and were not checked against the treaty text. Investment treaties and trade relations agreements grant no trade preferences: leave them out when counting trade agreements.\n`,
      `Card per record: ${absolute(path('agreements/{id}.md'))} (ID in lowercase); JSON: ${absolute(path('api/v1/agreements/{ID}.json'))} (exact ID).\n`,
      table(
        ['ID', 'Name', 'Type', 'Status', 'Signed', 'Provisional application', 'In force', 'Ended', 'Parties', 'Verification'],
        agreements().map((a) => [
          a.id,
          a._name,
          agreementTypeLabel(a.agreement_type),
          agreementStatusLabel(a.status),
          a.signed,
          a.provisional_application,
          a.in_force,
          a.ended,
          a._party_count,
          a.verification,
        ]),
      ),
    ].join('\n'),
  );
