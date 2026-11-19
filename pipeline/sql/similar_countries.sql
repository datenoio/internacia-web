-- Five most similar countries by Jaccard overlap of current memberships (SPEC §6.3, item 9).
WITH m AS (
    SELECT DISTINCT intblock_id, country_code AS code
    FROM current_memberships
    WHERE include_type IN ('country', 'territory')
),
n AS (
    SELECT code, count(*) AS total FROM m GROUP BY code
),
pairs AS (
    SELECT a.code AS code, b.code AS other, count(*) AS shared
    FROM m AS a
    JOIN m AS b ON a.intblock_id = b.intblock_id AND a.code <> b.code
    GROUP BY ALL
)
SELECT
    p.code,
    p.other,
    p.shared,
    round(p.shared / (na.total + nb.total - p.shared), 4) AS jaccard
FROM pairs AS p
JOIN n AS na ON na.code = p.code
JOIN n AS nb ON nb.code = p.other
QUALIFY row_number() OVER (PARTITION BY p.code ORDER BY jaccard DESC, p.shared DESC, p.other) <= 5
ORDER BY p.code, jaccard DESC, p.shared DESC, p.other
