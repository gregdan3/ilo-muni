import { WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";

const USAGE_QUERY = `select day, occurrences from frequency join phrase on frequency.phrase_id = phrase.id where phrase.text = ? and min_sent_len = ?`;

export interface Row {
  day: number;
  occurrences: number;
}
interface Result {
  // TODO
  phrase: string;
  data: Row[];
}

export function inputToPhrases(input: string): string[] {
  return Array.from(new Set(input.split(",").map((item) => item.trim())));
}

export function timestampToYYYYMM(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

export async function query_db(
  worker: WorkerHttpvfs,
  query: string,
  params: any[],
): Promise<Row[]> {
  return (await worker.db.query(query, params)) as Row[];
}

export async function fetch_usage(
  worker: WorkerHttpvfs,
  phrase: string,
  min_sent_len: number,
) {
  return await query_db(worker, USAGE_QUERY, [phrase, min_sent_len]);
}

export async function fetch_usages(
  worker: WorkerHttpvfs,
  phrases: string[],
  min_sent_len: number,
) {
  let results = await Promise.all(
    phrases.map(async (phrase) => {
      let rows = await fetch_usage(worker, phrase, min_sent_len);
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
      labels: data[0].data.map((value: Row) =>
        timestampToYYYYMM(value.day * 1000),
      ),
      datasets: data.map((result: Result) => ({
        label: `${result.phrase}`,
        data: result.data.map((row: Row) => row.occurrences),
      })),
    },
    options: {
      spanGaps: true,
      elements: { point: { radius: 0 } },
      line: { datasets: { normalized: true } },
    },
  });
  return chart;
}

export async function rebuild_chart(chart: Chart, data: Result[]) {
  chart.data.datasets = data.map((result: Result) => ({
    label: `${result.phrase}`,
    data: result.data.map((row: Row) => row.occurrences),
  }));
  chart.update();
}
