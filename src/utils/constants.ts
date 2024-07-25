import { makeAugust } from "@utils/other";

export const BASE_URL = "/ilo-muni";
export const DB_URL = `${BASE_URL}/db/2024-07-18-trimmed.sqlite`;
export const PHRASE_RE =
  /^[a-zA-Z0-9\uF1900-\uF1977\uF1978-\uF1988\uF19A0-\uF19A3* ]+(?:_\d)?$/;

// TODO: fetch from db at init
export const EARLIEST_YEAR = 2009;
export const LATEST_YEAR = 2024;

export const EARLIEST_TIMESTAMP = makeAugust(EARLIEST_YEAR).getTime() / 1000;
export const LATEST_TIMESTAMP = makeAugust(LATEST_YEAR).getTime() / 1000;
