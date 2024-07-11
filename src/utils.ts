import { WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";
import { TooltipItem, ChartTypeRegistry } from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { htmlLegendPlugin, verticalLinePlugin } from "./plugins";

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

export async function consoleLogAsync(
  message: string,
  other?: any,
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0)).then(() =>
    console.info(message, other),
  );
}

function cleanAndSplit(input: string, delimiter: string): string[] {
  return input
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function inputToPhrases(input: string): string[][] {
  input = input.toLowerCase();
  const phrases = cleanAndSplit(input, ",");
  const uniquePhrases = Array.from(new Set(phrases));
  const phraseGroups = uniquePhrases.map((phrase) =>
    cleanAndSplit(phrase, "+"),
  );
  return phraseGroups.slice(0, 20);
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

function roundForGraph(num: number): number {
  if (num >= 1) {
    return num;
  }
  if (num === 0) {
    return num;
  }
  const exponent = Math.floor(Math.log10(Math.abs(num))) + 1;
  const multiplier = Math.pow(10, 5 - exponent);
  return Math.floor(num * multiplier) / multiplier;
}

function mergeOccurrences(rows: Row[][]): Row[] {
  if (rows.length === 0 || rows[0].length === 0) {
    return [];
  }

  const result: Row[] = [];

  for (let i = 0; i < rows[0].length; i++) {
    const day = rows[0][i].day;
    let totalOccurrences = 0;

    for (let j = 0; j < rows.length; j++) {
      totalOccurrences += rows[j][i].occurrences;
    }
    result.push({ day, occurrences: totalOccurrences });
  }
  return result;
}

async function makeRelative(phrase_occs: Row[], total_occs: Row[]) {
  for (let i = 0; i < phrase_occs.length; i++) {
    phrase_occs[i].occurrences /= total_occs[i].occurrences;
  }
  return phrase_occs;
}
async function fetch_one_occurrences(
  worker: WorkerHttpvfs,
  phrase: string,
  min_sent_len: number,
  relative: boolean,
): Promise<Row[] | null> {
  const totals = await fetch_total_occurrences(worker, 1, min_sent_len);
  // it's possible to have periods with no occurrences for an increased sent len
  // but that isn't really a big deal; they'd fill with 0 anyway

  let resp = await query_db(worker, USAGE_QUERY, [phrase, min_sent_len]);
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
    result = await makeRelative(result, totals);
  }

  return result;
}

export async function fetch_many_occurrences(
  worker: WorkerHttpvfs,
  phrases: string[][],
  min_sent_len: number,
  relative: boolean,
): Promise<Result[]> {
  let results = await Promise.all(
    phrases.map(async (phrase: string[]) => {
      const phrase_occurrences = [];
      for (const segment of phrase) {
        const adjusted_min_sent_len = Math.max(
          min_sent_len,
          countWords(segment),
        );
        const rows = await fetch_one_occurrences(
          worker,
          segment,
          adjusted_min_sent_len,
          relative,
        );
        if (rows === null) {
          return null;
        }
        phrase_occurrences.push(rows);
      }
      const merged_rows = mergeOccurrences(phrase_occurrences);

      return {
        phrase: phrase.join(" + "),
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
  const chart = new Chart(canvas, {
    type: "line",
    data: {
      datasets: data.map((result: Result) => ({
        label: result.phrase,
        data: result.data,
      })),
    },
    plugins: [htmlLegendPlugin, verticalLinePlugin],
    options: {
      animation: { duration: 100, easing: "easeInOutQuint" },
      line: {
        datasets: { normalized: true },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "month",
            round: "month",
            tooltipFormat: "MMM yyyy",
          },
          // beforeFit: function (axis) {
          //   // @ts-expect-error
          //   let lbs: string[] = axis.chart.config.data.labels!;
          //   let len = lbs.length - 1;
          //   axis.ticks.push({ value: len, label: lbs[len] });
          // },
        y: {
          beginAtZero: true,
        },
      },
      elements: {
        point: { radius: 0, hoverRadius: 5 },
        line: { tension: 0.4 },
      },
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
        // @ts-expect-error: registration can't fix inline config
        htmlLegend: {
          containerID: "usageLegend",
        },
        zoom: {
          limits: {
            x: { min: "original", max: "original" },
            y: { min: "original", max: "original" },
          },
          zoom: {
            wheel: {
              enabled: false,
            },
            pinch: {
              enabled: true,
            },
            drag: {
              enabled: true,
              backgroundColor: "rgba(220, 220, 255, 0.3)",
              borderColor: "rgba(150, 150, 255, 0.8)",
              borderWidth: 2,
            },
            mode: "x",
            // scaleMode: "x",
            // overScaleMode: "x",
          },
        },
        tooltip: {
          mode: "nearest",
          axis: "x",
          intersect: false,
          position: "cursor",
          animation: false,
          yAlign: "center",
          itemSort: function (
            a: TooltipItem<keyof ChartTypeRegistry>,
            b: TooltipItem<keyof ChartTypeRegistry>,
          ): number {
            // @ts-expect-error: it doesn't know about `raw`
            return b.raw.occurrences - a.raw.occurrences;
          },
          callbacks: {
            label: (ctx: TooltipItem<keyof ChartTypeRegistry>) => {
              // @ts-expect-error: it doesn't know about `raw`
              const occurrences = roundForGraph(ctx.raw.occurrences);
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
  chart.data.datasets = data.map((result: Result) => ({
    label: result.phrase,
    data: result.data,
  }));
  chart.update();
}
