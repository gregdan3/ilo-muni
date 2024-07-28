import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import { BASE_URL, DB_URL } from "@utils/constants";
import type { Length, Phrase, Query, Separator } from "@utils/input";

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
  return await worker.db.query(query, params);
}

// inclusive on both ends makes sense for the graph
const USAGE_QUERY = `SELECT day, occurrences FROM frequency JOIN phrase ON frequency.phrase_id = phrase.id WHERE phrase.text = ? AND min_sent_len = ? AND day >= ? AND day <= ?  ORDER BY day`;
const TOTAL_QUERY = `SELECT day, occurrences FROM total WHERE phrase_len = ? AND min_sent_len = ? AND day >= ? AND day <= ? ORDER BY day`;
const RANKS_QUERY = `SELECT p.text, r.occurrences FROM ranks r JOIN phrase p ON r.phrase_id = p.id WHERE p.len = ? AND r.min_sent_len = ? AND r.day = ? ORDER BY occurrences DESC;`;
// but for ranks, we've queried ahead data which is exclusive on the right

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
  relative: boolean;
  smoothing: number;
  start: number;
  end: number;
}

function graphableDate(timestamp: number): Date {
  return new Date(timestamp * 1000 + DAY_IN_MS);
}

function mergeOccurrences(rows: Row[][], separators: Separator[]): Row[] {
  if (rows.length === 0 || rows[0].length === 0) {
    return [];
  }

  const result: Row[] = [];

  for (let i = 0; i < rows[0].length; i++) {
    const day = rows[0][i].day;
    let totalOccurrences = 0;

    for (let j = 0; j < rows.length; j++) {
      if (separators[j] === "-") {
        totalOccurrences -= rows[j][i].occurrences;
      } else {
        totalOccurrences += rows[j][i].occurrences;
      }
    }
    result.push({ day, occurrences: totalOccurrences });
  }
  return result;
}

function makeSmooth(phraseOccs: Row[], smoothing: number): Row[] {
  const smoothed: Row[] = phraseOccs.map((row) => ({ ...row }));
  const len = phraseOccs.length;

  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - smoothing);
      j <= Math.min(len - 1, i + smoothing);
      j++
    ) {
      sum += phraseOccs[j].occurrences;
      count++;
    }

    smoothed[i].occurrences = sum / count;
  }

  return smoothed;
}

function makeRelative(phrase_occs: Row[], total_occs: Row[]): Row[] {
  for (let i = 0; i < phrase_occs.length; i++) {
    const total = total_occs[i].occurrences;
    total
      ? (phrase_occs[i].occurrences /= total)
      : (phrase_occs[i].occurrences = 0);
  }
  return phrase_occs;
}

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

  if (params.relative) {
    result = makeRelative(result, totals);
  }

  if (params.smoothing > 0 && params.relative) {
    result = makeSmooth(result, params.smoothing);
  }

  return result;
}

export async function fetchManyOccurrenceSet(
  queries: Query[],
  relative: boolean,
  smoothing: number,
  start: number,
  end: number,
): Promise<Result[]> {
  const queryPromises = queries.map(async (query: Query) => {
    const phraseOccurrencesPromises = query.phrases.map(
      async (phrase: Phrase) => {
        const rows = await fetchOneOccurrenceSet({
          phrase,
          relative,
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
  if (params.relative) {
    // Override minimum sentence length when relative is set for fetching totals.
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
