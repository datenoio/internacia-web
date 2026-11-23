// llms.txt and llms-full.txt (SPEC §7.2), following https://llmstxt.org/.
import { blocktypes } from './data';
import { meta } from './meta';
import { absolute, path } from './urls';

const u = (p: string) => absolute(path(p));

export function llmsTxt(): string {
  const c = meta.counts;
  return `# Internacia

> Reference data on countries and territories, international organizations, agreements and
> country groupings ("intblocks"), with membership rosters, and a registry of trade agreements,
> bilateral ones included. A read-only view of internacia-db
> v${meta.data.version} (${meta.data.release_url}). Data: CC-BY-4.0 (country centroids: ODbL-1.0).

Every card exists in three forms with the same facts: HTML, Markdown and JSON.

## Rules for using this data

- Join memberships on IDs: country alpha-2 \`code\` and intblock \`id\`; never on names.
- \`borders\` holds ISO alpha-3 codes; resolve them through \`iso3code\`.
- ${c.countries} country records include non-ISO codes; ISO 3166-1 entries have \`code_status = official_iso3166_1\` (${c.iso_countries}).
- "Current" members: status not \`former_member\`, no \`left\` date, intblock neither \`historical\` nor dissolved.
- \`includes[].role\` (pipelines and corridors only) says what a country does on the route: \`origin\`, \`transit\`, \`destination\` or \`terminal\`; \`status\` still says how it relates to the record.
- \`institutional_design\` records what an organization's founding instrument lets it decide and enforce. An absent object or subfield means unknown, never "none".
- Border crossing status (\`_borders[].status\` on country cards) lists recorded closures only: no status does not mean a border is verified open. Most entries rest on official travel advice, which describes crossings for travellers, so a closed border can still carry some freight.
- Block type \`intorg\` is deprecated: select intergovernmental organizations with \`scope_category = igo\`, not by block type. \`eccurr\` and \`cuscurr\` are deprecated too: use \`economic\` or \`customs\` together with \`currency\`.
- Currency unions are the records whose first block type is \`currency\`, each with the countries that use the currency; dissolved unions and currency boards have status \`historical\`. A secondary \`currency\` type also marks organizations that administer a currency and central banks.
- Trade agreements (${c.trade_agreements} records, ${c.trade_agreements_in_force} in force) are a registry of their own: parties, status, dates and WTO RTA-IS or ADB ARIC IDs, no trade values. Two-party agreements are only there; since v5.0.0 their former intblock IDs (\`USKR\`, \`CETA\`, \`EUJP\`) redirect to the agreement under the same ID. Agreements with three or more parties are also intblocks (\`RCEP\`), which hold their roster.
- A country's trade agreements (\`_trade_agreements\` on country cards) are current coverage: a bloc party (the EU) counts its current members, with \`via\` set to the bloc. \`verification = catalogue\` records come from WTO RTA-IS or ADB ARIC only, whose statuses can lag. A \`preference_scheme\` lists grantors and beneficiaries as parties: two grantors are not partners under it.
- Enums are open: accept values you do not know.
- Fields starting with \`_\` are derived by this site; all others are internacia-db export fields.
- This is reference data, not a socioeconomic profile: no GDP, HDI or government type.
- Retired and renamed IDs: ${u('api/v1/aliases.json')}. "disambiguated" aliases must not be followed blindly.

## URL patterns

- Country card: ${u('countries/{code}/')} — Markdown ${u('countries/{code}.md')} — JSON ${u('api/v1/countries/{CODE}.json')}
- Intblock card: ${u('blocks/{id}/')} — Markdown ${u('blocks/{id}.md')} — JSON ${u('api/v1/blocks/{ID}.json')}
- Trade agreement card: ${u('agreements/{id}/')} — Markdown ${u('agreements/{id}.md')} — JSON ${u('api/v1/agreements/{ID}.json')}
- Block type: ${u('types/{key}/')} — ${u('types/{key}.md')} — ${u('api/v1/types/{key}.json')}
- Topic: ${u('topics/{key}/')} — ${u('topics/{key}.md')} — ${u('api/v1/topics/{key}.json')}
- Continent or subregion: ${u('geography/{slug}/')} — ${u('geography/{slug}.md')} — ${u('api/v1/geography/{slug}.json')}
- HTML and Markdown paths use lowercase codes and IDs; JSON paths use the exact code or ID.
- Examples: ${u('blocks/asean.md')}, ${u('api/v1/countries/FR.json')}, ${u('api/v1/blocks/G-20.json')}

## Which file answers which question

| Question | Smallest resource |
|---|---|
| Members of an organization, with ISO codes | ${u('blocks/{id}.md')} |
| Organizations a country belongs to | ${u('countries/{code}.md')} |
| Trade agreements of a country | ${u('countries/{code}.md')} (section "Trade agreements") |
| Parties to a trade agreement | ${u('agreements/{id}.md')} |
| Find a trade agreement ID | ${u('api/v1/agreements.json')} (${c.trade_agreements} records, lite) |
| Find an intblock ID by name or acronym | ${u('api/v1/blocks.json')} (${c.intblocks} records, lite) |
| List all countries with codes | ${u('countries.md')} or ${u('api/v1/countries.json')} |
| Every field of one record | ${u('api/v1/blocks/{ID}.json')}, ${u('api/v1/countries/{CODE}.json')} |
| Intblocks of a type or on a topic | ${u('types/{key}.md')}, ${u('topics/{key}.md')} |
| Countries of a continent or subregion | ${u('geography/{slug}.md')} |
| How complete a field is; which records lack it | ${u('stats.md')}, ${u('api/v1/stats.json')} |
| Bulk analysis (SQL) | internacia.duckdb from ${meta.data.release_url} |

## Indexes

- [Countries](${u('countries.md')}): ${c.countries} records
- [Organizations and groupings](${u('blocks.md')}): ${c.intblocks} records
- [Trade agreements](${u('agreements.md')}): ${c.trade_agreements} records
- [Block types](${u('types.md')}), [topics](${u('topics.md')}), [geography](${u('geography.md')})
- [Statistics and coverage](${u('stats.md')})
- Bulk JSON for analysis: ${u('api/v1/memberships.json')} (every current membership edge), ${u('api/v1/headquarters.json')}
- Interactive explorers for people (maps, timelines, comparisons): ${u('explore/')}
- [Data releases (Atom)](${u('feed.xml')})
- [JSON API index](${u('api/v1/index.json')}) — OpenAPI 3.1: ${u('api/v1/openapi.json')}
- [Data and downloads](${u('data.md')})
- [Embeds for other sites](${u('embed.md')}): membership map of an intblock (${u('embed/blocks/{id}/')}), memberships of a country (${u('embed/countries/{code}/')})
- [About, licence and methodology](${u('about.md')})

## Optional

- [Extended version of this file](${u('llms-full.txt')})
- [internacia-db documentation for SQL use](https://github.com/datenoio/internacia-db/blob/main/llms.txt)
`;
}

export function llmsFullTxt(aboutMd: string, dataMd: string): string {
  const types = blocktypes()
    .filter((t) => t._count > 0)
    .sort((a, b) => b._count - a._count)
    .map((t) => `| \`${t.id}\` | ${t.name}${t.deprecated ? ' (deprecated)' : ''} | ${t._count} | ${(t.description ?? '').replace(/\|/g, '\\|')} |`)
    .join('\n');
  return `${llmsTxt()}
## Block types

| Key | Name | Intblocks | Scope |
|---|---|---|---|
${types}

---

${dataMd}

---

${aboutMd}
`;
}
