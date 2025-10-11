// inclusive on both ends makes sense for the graph
export const SERIES_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  TABLENAME s
  JOIN term t ON s.term_id = t.id
WHERE
  t.text = ?
  AND s.attr = ?
  AND s.day >= ?
  AND s.day <= ?
ORDER BY
  s.day;`;

export const TOTAL_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  TABLENAME
WHERE
  term_len = ?
  AND attr = ?
  AND day >= ?
  AND day <= ?
ORDER BY
  day;`;

// NOTE: this query is inefficient because i have to order by hits, which means reading the entire table to process the query
export const WILDCARD_QUERY = `SELECT
  t.text AS term
FROM
  term t
  JOIN yearly yr ON t.id = yr.term_id
WHERE
  t.len = ?
  AND yr.attr = ?
  AND yr.day = 0
  AND t.text GLOB ?
ORDER BY
  yr.hits DESC
LIMIT
  10;`;
// day=0 is all time in ranks table
