import { queryDb } from "@utils/sqlite";
import type { WorkerHttpvfs } from "sql.js-httpvfs";

import type { Query, Separator } from "@utils/input";

const USAGE_QUERY = `SELECT day, occurrences FROM frequency JOIN phrase ON frequency.phrase_id = phrase.id WHERE phrase.text = ? AND min_sent_len = ? ORDER BY day`;
const OCCUR_QUERY = `SELECT day, occurrences FROM total WHERE phrase_len = ? AND min_sent_len = ? ORDER BY day`;
const DAY_IN_MS = 24 * 60 * 60 * 1000; // stupidest hack of all time

export interface Row {
  day: Date;
  occurrences: number;
}
export interface Result {
  phrase: string;
  data: Row[];
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
    phrase_occs[i].occurrences /= total_occs[i].occurrences;
  }
  return phrase_occs;
}

async function fetchOneOccurrenceSet(
  worker: WorkerHttpvfs,
  phrase: string,
  min_sent_len: number,
  relative: boolean,
  smoothing: number,
): Promise<Row[] | null> {
  const totals = await fetch_total_occurrences(worker, 1, min_sent_len);
  // it's possible to have periods with no occurrences for an increased sent len
  // but that isn't really a big deal; they'd fill with 0 anyway

  let resp = await queryDb(worker, USAGE_QUERY, [phrase, min_sent_len]);
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
  if (relative) {
    result = makeRelative(result, totals);
  }

  if (smoothing > 0 && relative) {
    result = makeSmooth(result, smoothing);
  }

  return result;
}

export async function fetchManyOccurrenceSet(
  worker: WorkerHttpvfs,
  queries: Query[],
  relative: boolean,
  smoothing: number,
): Promise<Result[]> {
  let results = await Promise.all(
    queries.map(async (query: Query) => {
      const phrase_occurrences = [];
      const separators = [] as Separator[];

      for (const phrase of query.phrases) {
        const rows = await fetchOneOccurrenceSet(
          worker,
          phrase.term,
          phrase.minSentLen,
          relative,
          smoothing,
        );
        if (rows === null) {
          return null;
        }
        phrase_occurrences.push(rows);
        separators.push(phrase.separator); // TODO: kinda gross?
      }
      const merged_rows = mergeOccurrences(phrase_occurrences, separators);

      return {
        phrase: query.repr,
        data: merged_rows,
      };
    }),
  );

  results = results.filter((result) => result !== null);

  // ts isn't smart enough to know i've removed all the nulls?
  return results as Result[];
}

async function fetch_total_occurrences(
  worker: WorkerHttpvfs,
  phrase_len: number,
  min_sent_len: number,
): Promise<Row[]> {
  let result = await queryDb(worker, OCCUR_QUERY, [phrase_len, min_sent_len]);
  result = result.map(
    (row: { day: number; occurrences: number }): Row => ({
      day: graphableDate(row.day),
      occurrences: row.occurrences,
    }),
  );
  return result as Row[];
}
