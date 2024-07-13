import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import { BASE_URL } from "@utils/constants";

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
export async function queryDb(
  worker: WorkerHttpvfs,
  query: string,
  params: any[],
): Promise<any[]> {
  return await worker.db.query(query, params);
}
