import { WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { htmlLegendPlugin } from "./plugins";

const USAGE_QUERY = `SELECT day, occurrences FROM frequency JOIN phrase ON frequency.phrase_id = phrase.id WHERE phrase.text = ? AND min_sent_len = ? ORDER BY day`;
const RANGE_QUERY = `SELECT MIN(day) AS first_month, MAX(day) AS last_month FROM total`;
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

function graphableDate(timestamp: number): Date {
  return new Date(timestamp * 1000 + DAY_IN_MS);
}

function countWords(phrase: string): number {
  return phrase.split(" ").length;
  // FIXME: incorrect count for UCSUR text
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

function roundForGraph(num: number): number {
  if (num >= 1) {
    return num;
  }
  const exponent = Math.floor(Math.log10(Math.abs(num))) + 1;
  const multiplier = Math.pow(10, 5 - exponent);
  return Math.floor(num * multiplier) / multiplier;
}

async function _make_relative(phrase_occs: Row[], total_occs: Row[]) {
  // holy hell i hate this function
  let iPhrase = 0;
  for (let iTotal = 0; iTotal < total_occs.length; iTotal++) {
    if (iPhrase >= total_occs.length) {
      break;
    }

    if (phrase_occs[iPhrase].day > total_occs[iTotal].day) {
      continue; // phrase is ahead of total
    }
    if (phrase_occs[iPhrase].day < total_occs[iTotal].day) {
      iPhrase++;
    }

    if (
      phrase_occs[iPhrase].day.getTime() === total_occs[iTotal].day.getTime()
    ) {
      phrase_occs[iPhrase].occurrences /= total_occs[iTotal].occurrences;
    }
  }
  return phrase_occs;
}
export async function make_relative(
  worker: WorkerHttpvfs,
  results: Result[],
  min_sent_len: number,
): Promise<Result[]> {
  results = await Promise.all(
    results.map(async (res: Result): Promise<Result> => {
      let phrase_len = countWords(res.phrase);
      let adjusted_min_sent_len = Math.max(phrase_len, min_sent_len);

      let totals = await fetch_total_occurrences(
        worker,
        phrase_len,
        adjusted_min_sent_len,
      );
      res.data = await _make_relative(res.data, totals);
      return res;
    }),
  );

  return results;
}

async function fetch_one_occurrences(
  worker: WorkerHttpvfs,
  phrase: string,
  min_sent_len: number,
): Promise<Row[]> {
  let result = await query_db(worker, USAGE_QUERY, [phrase, min_sent_len]);
  result = result.map(
    (row: { day: number; occurrences: number }): Row => ({
      day: graphableDate(row.day),
      occurrences: row.occurrences,
    }),
  );

  return result;
}

export async function fetch_many_occurrences(
  worker: WorkerHttpvfs,
  phrases: string[],
  min_sent_len: number,
): Promise<Result[]> {
  let results = await Promise.all(
    phrases.map(async (phrase) => {
      let adjusted_min_sent_len = Math.max(min_sent_len, countWords(phrase));
      // NOTE: this fixes a UX issue
      // if the user's min sent len is 1, but they search "toki pona", they should get it
      // but phrases always have a min sent len >= their phrase len

      let rows = await fetch_one_occurrences(
        worker,
        phrase,
        adjusted_min_sent_len,
      );
      if (rows.length === 0) {
        return null;
      }

      return {
        phrase: phrase,
        data: rows,
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
  let result = await query_db(worker, OCCUR_QUERY, [phrase_len, min_sent_len]);
  result = result.map(
    (row: { day: number; occurrences: number }): Row => ({
      day: graphableDate(row.day),
      occurrences: row.occurrences,
    }),
  );
  return result as Row[];
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
    plugins: [htmlLegendPlugin],
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
          // beforeFit: function (axis) {
          //   // @ts-ignore
          //   let lbs: string[] = axis.chart.config.data.labels!;
          //   let len = lbs.length - 1;
          //   axis.ticks.push({ value: len, label: lbs[len] });
          // },
        },
      },
      elements: {
        point: { radius: 1, hoverRadius: 5 },
        line: { tension: 0.25 },
      },
      spanGaps: DAY_IN_MS * 32, // placeholder until i fill with 0
      parsing: {
        xAxisKey: "day",
        yAxisKey: "occurrences",
      },
      hover: {
        mode: "nearest",
        axis: "x",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        // @ts-ignore: it can't know about user-created plugins
        htmlLegend: {
          containerID: "usageLegend",
        },
        tooltip: {
          mode: "nearest",
          axis: "x",
          intersect: false,
          position: "nearest",
          callbacks: {
            label: (ctx) => {
              // @ts-ignore
              let occurrences = roundForGraph(ctx.raw.occurrences);
              return `${ctx.dataset.label}: ${occurrences}`;
            },
          },
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
  }));
  chart.update();
}
