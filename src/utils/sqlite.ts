import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import {
  BASE_URL,
  DB_URL_PREFIX,
  LATEST_TIMESTAMP,
  EARLIEST_TIMESTAMP,
} from "@utils/constants";
import type {
  Length,
  Term,
  Query,
  Operator,
  Row,
  Rank,
  Params,
  Attribute,
  AttributeId,
  Stringable,
} from "@utils/types";
import { SCALES } from "@utils/constants";
import { hasError } from "@utils/input";
import { scaleFunctions } from "@utils/post_processing/scaling";
import { smootherFunctions } from "@utils/post_processing/smoothing";
import { consoleLogAsync } from "@utils/debug";
import { makeError } from "@utils/errors";

let workerPromise: Promise<WorkerHttpvfs> | null = null;

export async function initDB(dbUrlPrefix: string): Promise<WorkerHttpvfs> {
  const worker = await createDbWorker(
    [
      {
        from: "inline",
        config: {
          serverMode: "full",
          requestChunkSize: 1024,
          url: "/db/2025-09-30-trimmed.sqlite",
          //
          // serverMode: "chunked",
          // requestChunkSize: 1024,
          // databaseLengthBytes: 569713664,
          // serverChunkSize: 26214400,
          // urlPrefix: dbUrlPrefix,
          // suffixLength: 3,
        },
      },
    ],
    `${BASE_URL}/ext/sqlite.worker.js`,
    `${BASE_URL}/ext/sql-wasm.wasm`,
  );
  return worker;
}

export async function queryDb(
  query: string,
  params: Stringable[],
): Promise<any[]> {
  if (!workerPromise) {
    workerPromise = initDB(DB_URL_PREFIX);
  }
  const worker = await workerPromise;
  await consoleLogAsync(query, params);
  const result = await worker.db.query(query, params);
  return result;
}

// inclusive on both ends makes sense for the graph
const MONTHLY_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  monthly mo
  JOIN term t ON mo.term_id = t.id
WHERE
  t.text = ?
  AND mo.attr = ?
  AND mo.day >= ?
  AND mo.day <= ?
ORDER BY
  mo.day;`;

const TOTAL_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  total_monthly
WHERE
  term_len = ?
  AND attr = ?
  AND day >= ?
  AND day <= ?
ORDER BY
  day;`;

// but for ranks, we've queried ahead data which is exclusive on the right
const YEARLY_QUERY = `SELECT
  t.text AS term,
  yr.hits,
  yr.authors
FROM
  yearly yr
  JOIN term t ON yr.term_id = t.id
WHERE
  t.len = ?
  AND yr.attr = ?
  AND yr.day = ?
ORDER BY
  hits DESC;`;

// NOTE: this query is inefficient because i have to order by hits, which means reading the entire table to process the query
const WILDCARD_QUERY = `SELECT
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

const DAY_IN_MS = 24 * 60 * 60 * 1000; // stupidest hack of all time
const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000; // Offset in milliseconds

function localizeTimestamp(timestamp: number): number {
  return timestamp * 1000 + DAY_IN_MS;
}

function mergeRows(series: Row[][], operators: Operator[]): Row[] {
  const nonEmpty = series.filter((s) => s.length > 0);
  if (nonEmpty.length === 0) {
    return [];
  }

  const expectedLength = nonEmpty[0].length;
  const filteredSeries = nonEmpty.filter((s) => s.length === expectedLength);

  if (filteredSeries.length === 0) {
    return [];
  }
  if (filteredSeries.length === 1) {
    return filteredSeries[0];
  }

  const result: Row[] = [];

  for (let i = 0; i < expectedLength; i++) {
    const day = filteredSeries[0][i].day;
    let totalHits = 0;

    for (let j = 0; j < filteredSeries.length; j++) {
      const op = operators[j] ?? "+";
      const row = filteredSeries[j][i];

      if (!row) continue;

      if (op === "-") {
        totalHits -= row.hits;
      } else if (op === "+") {
        totalHits += row.hits;
      }
    }
    // TODO: NoSetMath error
    result.push({ day, hits: totalHits, authors: NaN, hpa: NaN });
  }
  return result;
}

function sumTerms(query: Query) {
  const terms = query.terms;
  if (terms.length === 0) {
    query.data = [];
    query.errors.push(makeError("NoResultsQuery", {}));
    return;
  }

  const nonEmpty = terms.filter(
    (t) => Array.isArray(t.data) && t.data.length > 0,
  );
  if (nonEmpty.length === 0) {
    query.data = [];
    query.errors.push(makeError("NoResultsQuery", {}));
    return;
  }

  const expectedLen = nonEmpty[0].data.length;
  const validTerms = nonEmpty.filter(
    (t) => t.data!.length === expectedLen && !hasError(t),
  );

  if (validTerms.length === 0) {
    query.data = [];
    return;
  }

  if (validTerms.length === 1) {
    query.data = validTerms[0].data;
    return;
  }

  const result: Row[] = [];

  for (let i = 0; i < expectedLen; i++) {
    const day = validTerms[0].data[i].day;
    let totalHits = 0;

    for (const term of validTerms) {
      const op = term.operator ?? "+";
      const row = term.data[i];

      if (!row) continue;

      if (op === "-") {
        totalHits -= row.hits;
      } else if (op === "+") {
        totalHits += row.hits;
      }
    }

    result.push({ day, hits: totalHits, authors: NaN, hpa: NaN });
  }

  query.data = result;
}

async function resolveTerm(term: Term, params: Params) {
  let resp = await queryDb(MONTHLY_QUERY, [
    term.text,
    term.attrId,
    params.start,
    params.end,
  ]);
  if (resp.length === 0) {
    const error = makeError("NoResultsTerm", { term: term.repr });
    term.errors.push(error);
    term.data = [];
    return;
  }

  resp = resp.map(
    (row: Row): Row => ({
      day: localizeTimestamp(row.day),
      hits: row.hits,
      authors: row.authors,
      hpa: row.authors ? row.hits / row.authors : 0,
    }),
  );

  const result: Row[] = [];
  let iResult = 0;
  let iCompare = 0;

  const totals = await fetchTotals(1, 0, params);

  // may be missing some periods - insert them
  while (iCompare < totals.length) {
    const comparisonDay = totals[iCompare].day;

    if (iResult < resp.length) {
      const resultDay = resp[iResult].day;

      // you can't directly compare dates...
      if (resultDay < comparisonDay) {
        iResult++;
      } else if (resultDay > comparisonDay) {
        result.push({ day: comparisonDay, hits: 0, authors: 0, hpa: 0 });
        iCompare++;
      } else {
        result.push(resp[iResult]);
        iResult++;
        iCompare++;
      }
    } else {
      result.push({ day: comparisonDay, hits: 0, authors: 0, hpa: 0 });
      iCompare++;
    }
  }

  term.data = result;
}

export async function resolveQuery(query: Query, params: Params) {
  if (params.start < EARLIEST_TIMESTAMP) {
    params.start = EARLIEST_TIMESTAMP;
  }
  if (params.end > LATEST_TIMESTAMP) {
    params.end = LATEST_TIMESTAMP;
  }

  if (hasError(query)) {
    query.data = []; // TODO: is this a good idea?
    // query.errors.push(makeError("NoResultsQuery", {}));
    return;
  }

  const termDataPromises = query.terms.map(async (term: Term) => {
    await resolveTerm(term, params);
  });
  await Promise.all(termDataPromises);

  sumTerms(query);

  // TODO: pass a term's length or attr into this? eh?
  const totals = await fetchTotals(1, 0, params);

  // NOTE:
  // If I want to show more fields in the tooltip later on, this will be
  // needed so the data doesn't appear to change from one graph view to
  // another. Right now I only show the current graph's data on the tooltip,
  // so no harm done.
  // for (const key of Object.keys(FIELDS)) {
  //   mergedRows = scaleFunctions[scale](mergedRows, totals, key);
  //   if (smoothing > 0 && SCALES[scale].smoothable) {
  //     const smootherFunction = smootherFunctions[smoother];
  //     mergedRows = smootherFunction(mergedRows, smoothing, key);
  //   }
  // }

  query.data = scaleFunctions[params.scale](query.data, totals, params.field);
  if (params.smoothing > 0 && SCALES[params.scale].smoothable) {
    const smootherFunction = smootherFunctions[params.smoother];
    query.data = smootherFunction(query.data, params.smoothing, params.field);
  }
}

async function fetchTotals(
  termLen: Length,
  attrId: AttributeId,
  params: Params,
): Promise<Row[]> {
  let result = await queryDb(TOTAL_QUERY, [
    1, // termLen,
    0, // attrId,
    params.start,
    params.end,
  ]);
  result = result.map(
    (row: Row): Row => ({
      day: localizeTimestamp(row.day),
      hits: row.hits,
      authors: row.authors,
      hpa: row.hits,
      // WARNING:
      // Technically, this should be (h/a) / (H/A) according to how the field is
      // defined. Here, I assign hpa to hits directly, because what I actually
      // want to display is "The hits/author of this word is what percent of the
      // entire language?" Which is (h/a) / (H).
      // The original function would yield "This word's hits/author is what percent of
      // the average hits per author?"
      // Total data is never directly visible to the user, so this *works*.
    }),
  );
  return result as Row[];
}

export async function fetchTopTerms(term: Term): Promise<string[]> {
  // term which has an attached wildcard
  const result = await queryDb(WILDCARD_QUERY, [
    term.len,
    // TODO: is it better to fetch terms by default attr? or given attr?
    term.attrId,
    // 0,
    term.text,
  ]);
  return result.map((term: { term: string }) => term.term);
}

export async function fetchYearly(
  termLen: Length,
  attr: Attribute,
  start: number,
  // end: number,
): Promise<Rank[]> {
  const result = await queryDb(YEARLY_QUERY, [
    termLen,
    attr,
    start,
    // end,
  ]);

  return result as Rank[];
}
