import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";

import {
  inputToPhrases,
  first_chart_build,
  fetch_many_occurrences,
  rebuild_chart,
  make_relative,
  Row,
  consoleLogAsync,
} from "./utils";

const workerUrl = new URL(
  "sql.js-httpvfs/dist/sqlite.worker.js",
  import.meta.url,
);
const wasmUrl = new URL("sql.js-httpvfs/dist/sql-wasm.wasm", import.meta.url);

async function user_request(
  worker: WorkerHttpvfs,
  chart: Chart<"line", Row[], unknown>,
  input: string,
  min_sent_len: number,
  relative: boolean,
) {
  let phrases = inputToPhrases(input);
  if (phrases.length === 0) {
    return;
  }

  let results = await fetch_many_occurrences(worker, phrases, min_sent_len);
  if (results.length === 0) {
    // TODO: tell user nothing came back
    return;
  }
  if (results.length < phrases.length) {
    // TODO: tell user some (which) words were not found
  }

  if (relative) {
    results = await make_relative(worker, results, min_sent_len);
  }

  await rebuild_chart(chart, results);
}

document.addEventListener("DOMContentLoaded", async () => {
  const searchBox = document.getElementById("searchBox")! as HTMLInputElement;
  const sentLenSlider = document.getElementById(
    "sentLenRange",
  )! as HTMLInputElement;
  const relCheckbox = document.getElementById(
    "relCheckbox",
  )! as HTMLInputElement;

  const usageCanvas = document.getElementById("usage")! as HTMLCanvasElement;
  const ranksCanvas = document.getElementById("ranks")! as HTMLCanvasElement;

  const worker = await createDbWorker(
    [
      {
        // TODO: investigate
        from: "inline",
        config: {
          serverMode: "full",
          url: "/db/2024-07-07-trimmed.sqlite",
          requestChunkSize: 1024, // TODO: reduce?
        },
      },
    ],
    workerUrl.toString(),
    wasmUrl.toString(),
  );

  let phrases = inputToPhrases(searchBox.value);
  let results = await fetch_many_occurrences(
    worker,
    phrases,
    Number(sentLenSlider.value),
  );
  let usageChart = await first_chart_build(usageCanvas, results);

  const form = document.getElementById("usageForm")! as HTMLFormElement;
  form.addEventListener("change", async () => {
    const queryText = searchBox.value;
    const sentLen = Number(sentLenSlider.value);
    const relative = relCheckbox.checked;
    // @ts-ignore
    await user_request(worker, usageChart, queryText, sentLen, relative);
  });
});
