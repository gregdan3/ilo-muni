import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import {
  BASE_URL,
  DB_URL_PREFIX,
  LATEST_TIMESTAMP,
  FIELDS,
} from "@utils/constants";
import type {
  Scale,
  Field,
  Length,
  Term,
  Query,
  Operator,
  Smoother,
  Row,
  Rank,
  Result,
  Params,
  Attribute,
  AttributeId,
  Stringable,
  QueryResult,
} from "@utils/types";
import { SCALES } from "@utils/constants";
import { scaleFunctions } from "@utils/post_processing/scaling";
import { smootherFunctions } from "@utils/post_processing/smoothing";
import { consoleLogAsync } from "./debug";
import { makeError } from "./errors";

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
      if (operators[j] === "-") {
        totalHits -= series[j][i].hits;
      } else if (operators[j] === "+") {
        totalHits += series[j][i].hits;
      } else {
        // TODO: make an error?
      }
    }

    // TODO: NoSetMath error
    result.push({ day, hits: totalHits, authors: NaN, hpa: NaN });
  }
  return result;
}

async function resolveTerm(term: Term, params: Params): Promise<Row[]> {
  let resp = await queryDb(MONTHLY_QUERY, [
    term.text,
    term.attrId,
    params.start,
    params.end,
  ]);
  if (resp.length === 0) {
    const error = makeError("NoResultsTerm", { term: params.term.repr });
    term.errors.push(error);
    return []; // for filtering in next func
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

export async function resolveQuery(
  query: Query,
  params: Params,
): Promise<QueryResult> {
  if (params.end > LATEST_TIMESTAMP) {
    params.end = LATEST_TIMESTAMP;
  }
  const termDataPromises = query.terms.map(async (term: Term) => {
    const rows = await resolveTerm(term, params);
    return rows !== null ? { rows, operator: term.operator } : null;
  });
  const termsData = await Promise.all(termDataPromises);

  if (termsData.some((term): boolean => term === null)) {
    return null;
  }

  let mergedRows = mergeRows(
    termsData.map((hit): Row[] => hit!.rows),
    termsData.map((hit): Operator => hit!.operator),
  );

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

  mergedRows = scaleFunctions[params.scale](mergedRows, totals, params.field);
  if (params.smoothing > 0 && SCALES[params.scale].smoothable) {
    const smootherFunction = smootherFunctions[params.smoother];
    mergedRows = smootherFunction(mergedRows, params.smoothing, params.field);
  }

  return {
    query: query,
    data: mergedRows,
  };
}

export async function fetchManyRows(
  queries: Query[],
  params: Params,
): Promise<Result[]> {
  if (params.end > LATEST_TIMESTAMP) {
    params.end = LATEST_TIMESTAMP;
  }

  const queryPromises = queries.map(async (query: Query) => {
    const termDataPromises = query.terms.map(async (term: Term) => {
      const rows = await resolveTerm(term, params);
      return rows !== null ? { rows, operator: term.operator } : null;
    });

    const termsData = await Promise.all(termDataPromises);

    if (termsData.some((term): boolean => term === null)) {
      return null;
    }

    let mergedRows = mergeRows(
      termsData.map((hit): Row[] => hit!.rows),
      termsData.map((hit): Operator => hit!.operator),
    );

    // 0 is default attr
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

    mergedRows = scaleFunctions[params.scale](mergedRows, totals, params.field);
    if (params.smoothing > 0 && SCALES[params.scale].smoothable) {
      const smootherFunction = smootherFunctions[params.smoother];
      mergedRows = smootherFunction(mergedRows, params.smoothing, params.field);
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
  attrId: AttributeId,
  params: Params,
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
    0, // TODO: attr
    term.text,
  ]);
  return result.map((term: { term: string }) => term.term);
  // yes this is silly TODO: maybe wrong now
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
