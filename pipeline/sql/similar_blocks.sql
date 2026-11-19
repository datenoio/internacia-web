-- Five intblocks with the highest Jaccard overlap of current member countries (SPEC §6.5, item 8).
-- Only blocks with at least three current country members take part, so tiny rosters do not
-- produce meaningless perfect matches.
WITH m AS (
    SELECT DISTINCT intblock_id AS id, country_code AS code
    FROM current_memberships
    WHERE include_type IN ('country', 'territory')
),
n AS (
    SELECT id, count(*) AS total FROM m GROUP BY id HAVING count(*) >= 3
),
mm AS (
    SELECT m.* FROM m JOIN n USING (id)
),
pairs AS (
    SELECT a.id AS id, b.id AS other, count(*) AS shared
    FROM mm AS a
    JOIN mm AS b ON a.code = b.code AND a.id <> b.id
    GROUP BY ALL
)
SELECT
    p.id,
    p.other,
    p.shared,
    round(p.shared / (na.total + nb.total - p.shared), 4) AS jaccard
FROM pairs AS p
JOIN n AS na ON na.id = p.id
JOIN n AS nb ON nb.id = p.other
QUALIFY row_number() OVER (PARTITION BY p.id ORDER BY jaccard DESC, p.shared DESC, p.other) <= 5
ORDER BY p.id, jaccard DESC, p.shared DESC, p.other
