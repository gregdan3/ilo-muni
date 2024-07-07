import { createDbWorker, WorkerHttpvfs } from "sql.js-httpvfs";
import Chart from "chart.js/auto";

import {
  inputToPhrases,
  first_chart_build,
  fetch_usages,
  rebuild_chart,
  Row,
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
) {
  let phrases = inputToPhrases(input);
  let results = await fetch_usages(worker, phrases, min_sent_len);

  await rebuild_chart(chart, results);
}

document.addEventListener("DOMContentLoaded", async () => {
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
          url: "/db/2024-07-06-trimmed.sqlite",
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

  const form = document.getElementById("usageform")! as HTMLFormElement;
  form.addEventListener("change", async () => {
    const queryText = searchBox.value;
    const sentLen = Number(sentLenSlider.value);
    // @ts-ignore
    await user_request(worker, usageChart, queryText, sentLen);
  });
});
