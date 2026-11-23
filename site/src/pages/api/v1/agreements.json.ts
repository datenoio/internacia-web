import type { APIRoute } from 'astro';
import { apiMeta, json } from '../../../lib/api';
import { agreements } from '../../../lib/data';
import { absolute, agreementJson, path } from '../../../lib/urls';

// Lite list of the trade agreements registry (contract 5.0): enough to pick an agreement and
// build its URLs.
export const GET: APIRoute = () =>
  json(
    {
      meta: apiMeta({ html: path('agreements/'), markdown: path('agreements.md') }),
      count: agreements().length,
      data: agreements().map((a) => ({
        id: a.id,
        _name: a._name,
        _acronym: a._acronym,
        agreement_type: a.agreement_type,
        status: a.status,
        signed: a.signed,
        in_force: a.in_force,
        ended: a.ended,
        intblock_id: a.intblock_id,
        wto_rta_id: a.wto_rta_id,
        aric_id: a.aric_id,
        verification: a.verification,
        _party_count: a._party_count,
        _json: absolute(agreementJson(a.id)),
      })),
    },
    false,
  );
