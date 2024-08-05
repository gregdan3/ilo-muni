import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import { BASE_URL, DB_URL, LATEST_ALLOWED_TIMESTAMP } from "@utils/constants";
import type { Scale, Length, Phrase, Query, Separator } from "@utils/types";
import { consoleLogAsync } from "@utils/debug";
import { CANNOT_SMOOTH } from "./constants";

let workerPromise: Promise<WorkerHttpvfs> | null = null;

export async function initDB(dbUrl: string): Promise<WorkerHttpvfs> {
  const worker = await createDbWorker(
    [
      {
        // TODO: investigate
        from: "inline",
        config: {
          serverMode: "full",
          url: dbUrl,
          requestChunkSize: 1024, // TODO: reduce?
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
    workerPromise = initDB(DB_URL);
  }
  const worker = await workerPromise;

  await consoleLogAsync(query, params);
  return await worker.db.query(query, params);
}

// inclusive on both ends makes sense for the graph
const USAGE_QUERY = `SELECT
  day,
  occurrences
FROM
  frequency
  JOIN phrase ON frequency.phrase_id = phrase.id
WHERE
  phrase.text = ?
  AND min_sent_len = ?
  AND day >= ?
  AND day <= ?
ORDER BY
  day;`;

const TOTAL_QUERY = `SELECT
  day,
  occurrences
FROM
  total
WHERE
  phrase_len = ?
  AND min_sent_len = ?
  AND day >= ?
  AND day <= ?
ORDER BY
  day;`;

// but for ranks, we've queried ahead data which is exclusive on the right
const RANKS_QUERY = `SELECT
  p.text AS term,
  r.occurrences
FROM
  ranks r
  JOIN phrase p ON r.phrase_id = p.id
WHERE
  p.len = ?
  AND r.min_sent_len = ?
  AND r.day = ?
ORDER BY
  occurrences DESC;`;

// NOTE: this query is inefficient because i have to order by occurrences, which means reading the entire table to process the query
const WILDCARD_QUERY = `SELECT
  p.text AS term
FROM
  phrase p
  JOIN ranks r ON p.id = r.phrase_id
WHERE
  p.len = ?
  AND r.min_sent_len = ?
  AND r.day = 0
  AND p.text GLOB ?
ORDER BY
  r.occurrences DESC
LIMIT
  10;`;
// day=0 is all time in ranks table
//

const DAY_IN_MS = 24 * 60 * 60 * 1000; // stupidest hack of all time

export interface Row {
  day: Date;
  occurrences: number;
}
export interface Result {
  term: string;
  data: Row[];
}
export interface Rank {
  term: string;
  occurrences: number;
}

export interface QueryParams {
  // TODO: is date or number a better interface?
  phrase: Phrase;
  scale: Scale;
  smoothing: number;
  start: number;
  end: number;
}

function graphableDate(timestamp: number): Date {
  return new Date(timestamp * 1000 + DAY_IN_MS);
}

function mergeOccurrences(series: Row[][], separators: Separator[]): Row[] {
  if (series.length === 0 || series[0].length === 0) {
    return [];
  }

  const result: Row[] = [];

  for (let i = 0; i < series[0].length; i++) {
    const day = series[0][i].day;
    let totalOccurrences = 0;

    for (let j = 0; j < series.length; j++) {
      if (separators[j] === "-") {
        totalOccurrences -= series[j][i].occurrences;
      } else {
        totalOccurrences += series[j][i].occurrences;
      }
    }
    result.push({ day, occurrences: totalOccurrences });
  }
  return result;
}

function makeSmooth(rows: Row[], smoothing: number): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;

  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - smoothing);
      j <= Math.min(len - 1, i + smoothing);
      j++
    ) {
      sum += rows[j].occurrences;
      count++;
    }

    smoothed[i].occurrences = sum / count;
  }

  return smoothed;
}

function makeRel(rows: Row[], totals: Row[]): Row[] {
  for (let i = 0; i < rows.length; i++) {
    const total = totals[i].occurrences;
    total ? (rows[i].occurrences /= total) : (rows[i].occurrences = 0);
  }
  return rows;
}

function makeLogAbs(rows: Row[]): Row[] {
  for (let i = 0; i < rows.length; i++) {
    const occurrences = rows[i].occurrences;
    rows[i].occurrences = Math.log(occurrences + 1);
  }
  return rows;
}

function makeLogRel(rows: Row[], totals: Row[]): Row[] {
  for (let i = 0; i < rows.length; i++) {
    const total = totals[i].occurrences;
    const occurrences = rows[i].occurrences;
    rows[i].occurrences = Math.log(occurrences + 1) / Math.log(total + 1);
    // +1 avoids log(1) = 0 and log(0) = undef
  }
  return rows;
}

function makeNormal(rows: Row[]): Row[] {
  const min = Math.min(...rows.map((row) => row.occurrences));
  const max = Math.max(...rows.map((row) => row.occurrences));

  return rows.map(
    (row: Row): Row => ({
      ...row,
      occurrences: (row.occurrences - min) / (max - min),
    }),
  );
}

function makeDerivative(rows: Row[]): Row[] {
  return rows.map((row, i) => {
    if (i === 0) return { ...row, occurrences: 0 };
    const diff = row.occurrences - rows[i - 1].occurrences;
    return { ...row, occurrences: diff };
  });
}
function makeCumulativeSum(rows: Row[]): Row[] {
  let cumulative = 0;
  return rows.map((row) => {
    cumulative += row.occurrences;
    return { ...row, occurrences: cumulative };
  });
}

function makeEntropy(rows: Row[]): Row[] {
  const totalOccurrences = rows.reduce((sum, row) => sum + row.occurrences, 0);
  return rows.map((row) => {
    const probability = row.occurrences / totalOccurrences;
    const entropy = probability ? -probability * Math.log2(probability) : 0;
    return { ...row, occurrences: entropy };
  });
}

function makeZScore(phrases: Row[]): Row[] {
  const mean =
    phrases.reduce((sum, row) => sum + row.occurrences, 0) / phrases.length;
  const stdDev = Math.sqrt(
    phrases.reduce((sum, row) => sum + Math.pow(row.occurrences - mean, 2), 0) /
      phrases.length,
  );

  return phrases.map((row) => ({
    ...row,
    occurrences: (row.occurrences - mean) / stdDev,
  }));
}

const scaleFunctions: {
  [key: string]: (rows: Row[], totals?: Row[]) => Row[];
} = {
  abs: (rows) => rows,
  rel: (rows, totals) => makeRel(rows, totals!),
  logabs: (rows) => makeLogAbs(rows),
  logrel: (rows, totals) => makeLogRel(rows, totals!),
  normabs: (rows) => makeNormal(rows),
  normrel: (rows, totals) => makeNormal(makeRel(rows, totals!)),
  deriv1: (rows) => makeDerivative(rows),
  deriv2: (rows) => makeDerivative(makeDerivative(rows)),
  relderiv1: (rows, totals) => makeDerivative(makeRel(rows, totals!)),
  relderiv2: (rows, totals) =>
    makeDerivative(makeDerivative(makeRel(rows, totals!))),
  cmsum: (rows) => makeCumulativeSum(rows),
  entropy: (rows) => makeEntropy(rows),
  relentropy: (rows, totals) => makeEntropy(makeRel(rows, totals!)),
  zscore: (rows, totals) => makeZScore(makeRel(rows, totals!)),
};

async function fetchOneOccurrenceSet(
  params: QueryParams,
): Promise<Row[] | null> {
  let resp = await queryDb(USAGE_QUERY, [
    params.phrase.term,
    params.phrase.minSentLen,
    params.start,
    params.end,
  ]);
  if (resp.length === 0) {
    return null; // for filtering in next func
  }

  resp = resp.map(
    (row: { day: number; occurrences: number }): Row => ({
      day: graphableDate(row.day),
      occurrences: row.occurrences,
    }),
  );

  let result: Row[] = [];
  let iResult = 0;
  let iCompare = 0;

  const totals = await fetchTotalOccurrences(params);

  while (iCompare < totals.length) {
    const comparisonDay = totals[iCompare].day;

    if (iResult < resp.length) {
      const resultDay = resp[iResult].day;

      // you can't directly compare dates...
      if (resultDay < comparisonDay) {
        iResult++;
      } else if (resultDay > comparisonDay) {
        result.push({ day: comparisonDay, occurrences: 0 });
        iCompare++;
      } else {
        result.push(resp[iResult]);
        iResult++;
        iCompare++;
      }
    } else {
      result.push({ day: comparisonDay, occurrences: 0 });
      iCompare++;
    }
  }

  // TODO: move scale functions to *after* many occurrence math
  result = scaleFunctions[params.scale](result, totals);

  if (params.smoothing > 0 && !CANNOT_SMOOTH.includes(params.scale)) {
    result = makeSmooth(result, params.smoothing);
  }

  return result;
}

export async function fetchManyOccurrenceSet(
  queries: Query[],
  scale: Scale,
  smoothing: number,
  start: number,
  end: number,
): Promise<Result[]> {
  if (end > LATEST_ALLOWED_TIMESTAMP) {
    end = LATEST_ALLOWED_TIMESTAMP;
  }

  const queryPromises = queries.map(async (query: Query) => {
    const phraseOccurrencesPromises = query.phrases.map(
      async (phrase: Phrase) => {
        const rows = await fetchOneOccurrenceSet({
          phrase,
          scale,
          smoothing,
          start,
          end,
        } as QueryParams);
        return rows !== null ? { rows, separator: phrase.separator } : null;
      },
    );

    const phraseOccurrences = await Promise.all(phraseOccurrencesPromises);

    if (phraseOccurrences.some((occurrence): boolean => occurrence === null)) {
      return null;
    }

    const mergedRows = mergeOccurrences(
      phraseOccurrences.map((occurrence): Row[] => occurrence!.rows),
      phraseOccurrences.map((occurrence): Separator => occurrence!.separator),
    );

    return {
      term: query.repr,
      data: mergedRows,
    };
  });

  const resolvedResults = await Promise.all(queryPromises);

  return resolvedResults.filter((result) => result !== null) as Result[];
}

async function fetchTotalOccurrences(params: QueryParams): Promise<Row[]> {
  let minSentLen = params.phrase.minSentLen;
  if (params.scale !== "absolute") {
    // Override minimum sentence length when non-absolute scale is set for totals.
    // This creates more comparable percentages,
    // because the percentages are made against the total number of words,
    // rather than among the words in sentences of a specific length.
    // Critically, searches like "toki_2 - toki_1" cannot produce negative values.
    minSentLen = params.phrase.length;
  }

  // NOTE: Why not override phraseLen too?
  // Google measures percentages by their number of occurrences among same-length ngrams
  // This means percentages for different-length ngrams are **not** comparable
  // Demonstrating: https://books.google.com/ngrams/graph?content=%28kindergarten+-+child+care%29&year_start=1800
  // Granted, it is differently misleading to take them as a percentage of unigrams
  // But this would mean you couldn't go negative when subtracting longer ngrams from a shorter ngram contained within the longer ones
  // e.g. tenpo ni - tenpo ni la - lon tenpo ni
  // And this could be useful because in the above search, the resultant line would be "Percentage prevalence of 'tenpo ni' without the prevalence of 'tenpo ni la' or 'lon tenpo ni'"
  // Which right now you can only get in absolute mode

  let result = await queryDb(TOTAL_QUERY, [
    params.phrase.length,
    minSentLen,
    params.start,
    params.end,
  ]);
  result = result.map(
    (row: { day: number; occurrences: number }): Row => ({
      day: graphableDate(row.day),
      occurrences: row.occurrences,
    }),
  );
  return result as Row[];
}

export async function fetchTopPhrases(phrase: Phrase): Promise<string[]> {
  // phrase which has an attached wildcard
  const result = await queryDb(WILDCARD_QUERY, [
    phrase.length,
    phrase.minSentLen,
    phrase.term,
  ]);
  return result.map((term: { term: string }) => term.term);
  // yes this is silly
}

export async function fetchRanks(
  phraseLen: Length,
  minSentLen: Length,
  start: number,
  // end: number,
): Promise<Rank[]> {
  const result = await queryDb(RANKS_QUERY, [
    phraseLen,
    minSentLen,
    start,
    // end,
  ]);

  return result as Rank[];
}
