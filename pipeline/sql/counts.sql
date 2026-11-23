-- Key figures for the home page and the footer (SPEC §6.1).
-- "ISO countries" are current ISO 3166-1 entries only (SPEC §4.4).
SELECT
    (SELECT count(*) FROM countries) AS countries,
    (SELECT count(*) FROM countries WHERE code_status = 'official_iso3166_1') AS iso_countries,
    (SELECT count(*) FROM intblocks) AS intblocks,
    (SELECT count(*) FROM blocktypes) AS blocktypes,
    (SELECT count(DISTINCT t.key) FROM (SELECT unnest(topics) AS t FROM intblocks)) AS topics,
    (SELECT count(*) FROM memberships) AS memberships,
    (SELECT count(*) FROM current_memberships) AS current_memberships,
    -- Trade agreements registry (contract 5.0); in_force is the agreement's own status.
    (SELECT count(*) FROM trade_agreements) AS trade_agreements,
    (SELECT count(*) FROM trade_agreements WHERE status = 'in_force') AS trade_agreements_in_force
