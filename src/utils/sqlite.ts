import { createDbWorker } from "sql.js-httpvfs";
import type { WorkerHttpvfs } from "sql.js-httpvfs";
import { BASE_URL, DB_URL } from "@utils/constants";

let worker: WorkerHttpvfs | null = null;

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
  if (!worker) {
    worker = await initDB(DB_URL);
  }

  return await worker.db.query(query, params);
}

//
// const remoteURL =
//   'https://velivole.b-cdn.net/maptiler-osm-2017-07-03-v3.6.1-europe.mbtiles';
// const pool = await createSQLiteHTTPPool({ workers: 8 });
// await pool.open(remoteURL);
// // This will automatically use a free thread from the pool
// const tile = await pool.exec(
//     'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles ' +
//     'WHERE zoom_level = 10 AND tile_column = $col AND tile_row = $row',
//     { $col: 600, $row: 600 });
// console.log(tile[0].columnNames);
// console.log(tile[0].row);
// // This shutdowns the pool
// await pool.close();
