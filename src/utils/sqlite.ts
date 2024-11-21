import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import {
  BASE_URL,
  DB_URL_PREFIX,
  LATEST_ALLOWED_TIMESTAMP,
} from "@utils/constants";
import type {
  Scale,
  Length,
  Term,
  Query,
  Separator,
  Smoother,
  Row,
  Rank,
  Result,
  QueryParams,
} from "@utils/types";
import { consoleLogAsync } from "@utils/debug";
import { SCALES } from "@utils/constants";
import { scaleFunctions } from "@utils/post_processing/scaling.ts";
import { smootherFunctions } from "@utils/post_processing/smoothing.ts";

let workerPromise: Promise<WorkerHttpvfs> | null = null;

export async function initDB(dbUrlPrefix: string): Promise<WorkerHttpvfs> {
  const worker = await createDbWorker(
    [
      {
        // TODO: investigate
        from: "inline",
        config: {
          serverMode: "full",
          requestChunkSize: 1024,
          url: "/ilo-muni/db/2024-10-17-trimmed.sqlite",
          // serverMode: "chunked",
          // requestChunkSize: 1024,
          // databaseLengthBytes: 558073856,
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

/* TODO: queryresult? */
export async function queryDb(query: string, params: any[]): Promise<any[]> {
  if (!workerPromise) {
    workerPromise = initDB(DB_URL_PREFIX);
  }
  const worker = await workerPromise;

  await consoleLogAsync(query, params);
  return await worker.db.query(query, params);
}

// inclusive on both ends makes sense for the graph
const MONTHLY_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  monthly mo
  JOIN term p ON mo.term_id = p.id
WHERE
  p.text = ?
  AND mo.min_sent_len = ?
  AND mo.day >= ?
  AND mo.day <= ?
ORDER BY
  day;`;

const TOTAL_QUERY = `SELECT
  day,
  hits,
  authors
FROM
  total
WHERE
  term_len = ?
  AND min_sent_len = ?
  AND day >= ?
  AND day <= ?
ORDER BY
  day;`;

// but for ranks, we've queried ahead data which is exclusive on the right
const YEARLY_QUERY = `SELECT
  p.text AS term,
  yr.hits,
  yr.authors,
FROM
  yearly yr
  JOIN term p ON yr.term_id = p.id
WHERE
  p.len = ?
  AND yr.min_sent_len = ?
  AND yr.day = ?
ORDER BY
  hits DESC;`;

// NOTE: this query is inefficient because i have to order by hits, which means reading the entire table to process the query
const WILDCARD_QUERY = `SELECT
  p.text AS term
FROM
  term p
  JOIN yearly yr ON p.id = yr.term_id
WHERE
  p.len = ?
  AND yr.min_sent_len = ?
  AND yr.day = 0
  AND p.text GLOB ?
ORDER BY
  yr.authors DESC
LIMIT
  10;`;
// day=0 is all time in ranks table

const DAY_IN_MS = 24 * 60 * 60 * 1000; // stupidest hack of all time
const timezoneOffset = new Date().getTimezoneOffset() * 60 * 1000; // Offset in milliseconds

function localizeTimestamp(timestamp: number): number {
  return timestamp * 1000 + DAY_IN_MS;
}

function mergeRows(series: Row[][], separators: Separator[]): Row[] {
  if (series.length === 0 || series[0].length === 0) {
    return [];
  }
  // do not merge if it would be a no-op
  if (series.length === 1) {
    return series[0];
  }

  const result: Row[] = [];

  for (let i = 0; i < series[0].length; i++) {
    const day = series[0][i].day;
    let totalHits = 0;

    for (let j = 0; j < series.length; j++) {
      if (separators[j] === "-") {
        totalHits -= series[j][i].hits;
      } else {
        totalHits += series[j][i].hits;
      }
    }

    // NOTE: there are at least 2 items in `series` and authors cannot be summed
    result.push({ day, hits: totalHits, authors: NaN, hpa: NaN });
  }
  return result;
}

async function fetchOneRow(params: QueryParams): Promise<Row[] | null> {
  let resp = await queryDb(MONTHLY_QUERY, [
    params.term.text,
    params.term.minSentLen,
    params.start,
    params.end,
  ]);
  if (resp.length === 0) {
    return null; // for filtering in next func
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

  const totals = await fetchTotals(
    params.term.len,
    params.term.minSentLen,
    params.start,
    params.end,
  );

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

  return result;
}

export async function fetchManyRows(
  queries: Query[],
  scale: Scale,
  smoother: Smoother,
  smoothing: number,
  start: number,
  end: number,
): Promise<Result[]> {
  if (end > LATEST_ALLOWED_TIMESTAMP) {
    end = LATEST_ALLOWED_TIMESTAMP;
  }

  const queryPromises = queries.map(async (query: Query) => {
    const termDataPromises = query.terms.map(async (term: Term) => {
      const rows = await fetchOneRow({
        term,
        scale,
        smoothing,
        start,
        end,
      } as QueryParams);
      return rows !== null ? { rows, separator: term.separator } : null;
    });

    const termsData = await Promise.all(termDataPromises);

    if (termsData.some((term): boolean => term === null)) {
      return null;
    }

    let mergedRows = mergeRows(
      termsData.map((hit): Row[] => hit!.rows),
      termsData.map((hit): Separator => hit!.separator),
    );

    const totals = await fetchTotals(1, 1, start, end);
    mergedRows = scaleFunctions[scale](mergedRows, totals, "hits");
    mergedRows = scaleFunctions[scale](mergedRows, totals, "authors");
    if (smoothing > 0 && SCALES[scale].smoothable) {
      const smootherFunction = smootherFunctions[smoother];
      mergedRows = smootherFunction(mergedRows, smoothing, "hits");
      mergedRows = smootherFunction(mergedRows, smoothing, "authors");
    }

    return {
      term: query.repr,
      data: mergedRows,
    };
  });

  const resolvedResults = await Promise.all(queryPromises);

  return resolvedResults.filter((result) => result !== null) as Result[];
}

async function fetchTotals(
  termLen: Length,
  minSentLen: Length,
  start: number,
  end: number,
): Promise<Row[]> {
  // const minSentLen = 1; // params.term.minSentLen;
  // const termLen = 1; // params.term.length;
  // NOTE:
  // if (!CANNOT_SMOOTH.includes(params.scale)) {
  // Override minimum sentence length when non-absolute scale is set for totals.
  // This creates more comparable percentages,
  // because the percentages are made against the total number of words,
  // rather than among the words in sentences of a specific length.
  // Critically, searches like "toki_2 - toki_1" cannot produce negative values.
  // minSentLen = params.term.length;
  // termLen = params.term.length;
  // minSentLen = 1;
  // termLen = 1;
  // }

  // NOTE: Why not override termLen too?
  // Google measures percentages by their hits among same-length ngrams
  // This means percentages for different-length ngrams are **not** comparable
  // Demonstrating: https://books.google.com/ngrams/graph?content=%28kindergarten+-+child+care%29&year_start=1800
  // Granted, it is differently misleading to take them as a percentage of unigrams
  // But this would mean you couldn't go negative when subtracting longer ngrams from a shorter ngram contained within the longer ones
  // e.g. tenpo ni - tenpo ni la - lon tenpo ni
  // And this could be useful because in the above search, the resultant line would be "Percentage prevalence of 'tenpo ni' without the prevalence of 'tenpo ni la' or 'lon tenpo ni'"
  // Which right now you can only get in absolute mode

  let result = await queryDb(TOTAL_QUERY, [termLen, minSentLen, start, end]);
  result = result.map(
    (row: Row): Row => ({
      day: localizeTimestamp(row.day),
      hits: row.hits,
      authors: row.authors,
      hpa: 0,
    }),
  );
  return result as Row[];
}

export async function fetchTopTerms(term: Term): Promise<string[]> {
  // term which has an attached wildcard
  const result = await queryDb(WILDCARD_QUERY, [
    term.len,
    term.minSentLen,
    term.text,
  ]);
  return result.map((term: { term: string }) => term.term);
  // yes this is silly TODO: maybe wrong now
}

export async function fetchYearly(
  termLen: Length,
  minSentLen: Length,
  start: number,
  // end: number,
): Promise<Rank[]> {
  const result = await queryDb(YEARLY_QUERY, [
    termLen,
    minSentLen,
    start,
    // end,
  ]);

  return result as Rank[];
}
