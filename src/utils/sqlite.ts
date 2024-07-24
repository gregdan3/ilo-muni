import { BASE_URL, DB_URL } from "@utils/constants";
import { createSQLiteHTTPPool, type SQLiteHTTPPool } from "sqlite-wasm-http";
import { consoleLogAsync } from "./debug";
import type { RowArray, SQLBindable } from "sqlite-wasm-http/sqlite3.js";

let pool: SQLiteHTTPPool | null = null;
const poolPromise: Promise<SQLiteHTTPPool> | null = null;

async function initDB(dbUrl: string): Promise<SQLiteHTTPPool> {
  const pool = await createSQLiteHTTPPool({
    workers: 1,
    httpOptions: {
      maxPageSize: 1024,
      timeout: 30000,
      cacheSize: 32768,
    },
  });

  await consoleLogAsync("pool before open", pool);
  await pool.open(dbUrl);
  return pool;
}

export async function queryDb(
  query: string,
  params: SQLBindable[],
): Promise<RowArray[]> {
  if (!pool) {
    pool = await initDB(DB_URL);
  }

  return await pool.exec(query, params);
}
