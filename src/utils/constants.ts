import { makeAugust } from "@utils/other";

export const BASE_URL = "/ilo-muni";
export const DB_URL = `${BASE_URL}/db/2024-07-29-trimmed.sqlite`;
export const PHRASE_RE =
  /^[a-z\u{F1900}-\u{F1977}\u{F1978}-\u{F1988}\u{F19A0}-\u{F19A3}* ]+(?:_\d)?$/iu;
export const UCSUR_RE =
  /^[\u{F1900}-\u{F1977}\u{F1978}-\u{F1988}\u{F19A0}-\u{F19A3}]$/u;

// TODO: fetch from db at init? would make it not so much a constant
export const EARLIEST_YEAR = 2015;
// NOTE: the data goes back to 2010 but there is almost nothing there
// export const EARLIEST_YEAR = 2010;
export const LATEST_YEAR = 2024;

export const EARLIEST_TIMESTAMP = makeAugust(EARLIEST_YEAR).getTime() / 1000;
export const LATEST_TIMESTAMP = makeAugust(LATEST_YEAR).getTime() / 1000;

// start of june 1 in epoch time
// avoids the fact that july is incomplete in my dataset
// no equivalent EARLIEST because i can hand-pick a specific August that is acceptable
export const LATEST_ALLOWED_TIMESTAMP = 1717200000;
