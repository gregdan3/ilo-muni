import { WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";

const USAGE_QUERY = `SELECT day, occurrences FROM frequency JOIN phrase ON frequency.phrase_id = phrase.id WHERE phrase.text = ? AND min_sent_len = ?`;
const RANGE_QUERY = `SELECT MIN(day) AS first_month, MAX(day) AS last_month FROM total`;
const DAY_IN_MS = 24 * 60 * 60 * 1000; // stupidest hack of all time

// NOTE: This query solves the occurrences=0 problem, but query sizes jump from 1-8kb to 3-5mb.
// const USAGE_QUERY = `
// WITH all_days AS (
//     SELECT DISTINCT day
//     FROM frequency
// )
// SELECT
//     ad.day,
//     COALESCE(f.occurrences, 0) AS occurrences
// FROM
//     all_days ad
// LEFT JOIN (
//     SELECT day, occurrences
//     FROM frequency
//     JOIN phrase ON frequency.phrase_id = phrase.id
//     WHERE phrase.text = ? AND min_sent_len = ?
// ) f ON ad.day = f.day
// ORDER BY ad.day;
// `;

export interface Row {
  day: Date;
  occurrences: number;
}
interface Result {
  phrase: string;
  data: Row[];
}

export async function consoleLogAsync(
  message: string,
  other?: any,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0)).then(() =>
    console.info(message, other),
  );
}

export function inputToPhrases(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== ""),
    ),
  ).slice(0, 20); // TODO: make this choice elsewhere?
}

function dateToYYYYMM(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

function countWords(phrase: string): number {
  return phrase.split(" ").length;
}

async function query_db(
  worker: WorkerHttpvfs,
  query: string,
  params: any[],
): Promise<any[]> {
  return await worker.db.query(query, params);
}

async function fetch_range(worker: WorkerHttpvfs) {
  return await query_db(worker, RANGE_QUERY, []);
}

async function fetch_usage(
  worker: WorkerHttpvfs,
  phrase: string,
  min_sent_len: number,
): Promise<Row[]> {
  let result = await query_db(worker, USAGE_QUERY, [phrase, min_sent_len]);
  result = result.map((row: { day: number; occurrences: number }) => ({
    day: new Date(row.day * 1000 + DAY_IN_MS),
    occurrences: row.occurrences,
  }));

  return result;
}

export async function fetch_usages(
  worker: WorkerHttpvfs,
  phrases: string[],
  min_sent_len: number,
) {
  let results = await Promise.all(
    phrases.map(async (phrase) => {
      let adjusted_min_sent_len = Math.max(min_sent_len, countWords(phrase));
      // NOTE: this fixes a UX issue
      // if the user's min sent len is 1, but they search "toki pona", they should get it
      // but phrases always have a min sent len >= their phrase len

      let rows = await fetch_usage(worker, phrase, adjusted_min_sent_len);
      return {
        phrase: phrase,
        data: rows,
      };
    }),
  );
  return results;
}

export async function first_chart_build(
  canvas: HTMLCanvasElement,
  data: Result[],
) {
  let chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: data.map((result: Result) => ({
        label: result.phrase,
        data: result.data,
      })),
    },
    options: {
      line: { datasets: { normalized: true } },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            round: "month",
            tooltipFormat: "MMM yyyy",
          },
        },
      },
      elements: {
        point: { radius: 0 },
        line: { tension: 0.25 },
      },
      spanGaps: false,
      parsing: {
        xAxisKey: "day",
        yAxisKey: "occurrences",
      },
      plugins: {
        tooltip: {
          mode: "nearest",
          axis: "x",
          intersect: false,
          position: "nearest",
        },
      },
    },
  });
  return chart;
}

export async function rebuild_chart(
  chart: Chart<"line", Row[], unknown>,
  data: Result[],
) {
  // @ts-ignore
  chart.data.datasets = data.map((result: Result) => ({
    label: result.phrase,
    data: result.data,
    // data: result.data.map((row: Row) => {
    //   row.occurrences, row.day;
    // }),
  }));
  chart.update();
}
