import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";

import {
  inputToPhrases,
  first_chart_build,
  fetch_usage,
  fetch_usages,
  rebuild_chart,
} from "./utils";

const workerUrl = new URL(
  "sql.js-httpvfs/dist/sqlite.worker.js",
  import.meta.url,
);
const wasmUrl = new URL("sql.js-httpvfs/dist/sql-wasm.wasm", import.meta.url);

async function user_request(
  worker: WorkerHttpvfs,
  chart: Chart,
  input: string,
  min_sent_len: number,
) {
  let phrases = inputToPhrases(input);
  let results = await fetch_usages(worker, phrases, min_sent_len);

  await rebuild_chart(chart, results);
}

document.addEventListener("DOMContentLoaded", async () => {
  const goButton = document.getElementById("go")! as HTMLInputElement;
  const searchBox = document.getElementById("searchbox")! as HTMLInputElement;
  const sentLenSlider = document.getElementById(
    "sent_len_slider",
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
          url: "/db/frequency.db",
          requestChunkSize: 1024, // TODO: reduce?
        },
      },
    ],
    workerUrl.toString(),
    wasmUrl.toString(),
  );

  let phrases = inputToPhrases(searchBox.value);
  let results = await fetch_usages(
    worker,
    phrases,
    Number(sentLenSlider.value),
  );
  let usageChart = await first_chart_build(usageCanvas, results);

  goButton.addEventListener("click", async () => {
    const queryText = searchBox.value;
    const sentLen = Number(sentLenSlider.value);
    await user_request(worker, usageChart, queryText, sentLen);
  });
});
