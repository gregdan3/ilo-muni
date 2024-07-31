import { EARLIEST_TIMESTAMP, LATEST_TIMESTAMP } from "@utils/constants";

const SAMPLE_SEARCHES = [
  // duh
  "toki, pona, toki pona",
  // phrase trends
  "tomo tawa, ilo tawa",
  "sina seme, sina pilin seme, sina pali e seme",
  // isolating phrases
  "toki_1 - toki_2, pona_1 - pona_2",
  // synonyms
  "lukin, oko, lukin + oko",
  "ale, ali, ale + ali",
  "ala, x, ala + x",
  "anu, y, anu + y",
  // word groups
  "laso, loje, walo, jelo, pimeja",
  "soweli, waso, kala, akesi, pipi",
  "sewi, poka, anpa, sinpin, monsi",
  "meli, mije, tonsi",
  "pu, ku, su",
  "sin, lukin, kin, namako, oko",
  "selo, sijelo",
  // modifier usage
  "wawa a, wawa mute, wawa suli, wawa sewi",
  "tenpo ni, tenpo pini, tenpo kama, tenpo mute, tenpo suli, tenpo poka",
  // grammatical things
  "kepeken ilo, kepeken e ilo",
  "kin la, poka la, sama la, namako la",
  "ale la, ala la",
  "pali e, lon e, mama e, kama e",
  // names
  "kekan, kekan san, jan kekan, mun kekan",
  "sonja, jan sonja",
  // disambiguation
  "san - kekan san",
  "toki - toki pona",
];

const scaleParams = ["relative", "absolute"];
const lengthParams = ["1", "2", "3", "4", "5", "6"];
const smoothingParams = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "20",
  "30",
  "40",
  "50",
];

export type ScaleParam = (typeof scaleParams)[number];
export type LengthParam = (typeof lengthParams)[number];
export type SmoothingParam = (typeof smoothingParams)[number];

export interface SearchURLParams {
  query: string;
  minSentLen: LengthParam;
  scale: ScaleParam;
  smoothing: SmoothingParam;
  start: string;
  end: string;
}

export interface RanksURLParams {
  phraseLen: LengthParam;
  minSentLen: LengthParam;
  year: string;
}

export function coalesceLength(
  maybeLen: string,
  defaultLen: LengthParam = "1",
): LengthParam {
  let len: LengthParam = defaultLen;
  if (maybeLen && lengthParams.includes(maybeLen)) {
    len = maybeLen as LengthParam;
  }
  return len;
}

function randomElem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isValidTimestamp(timestamp: string | null): boolean {
  if (!timestamp) {
    return false;
  }

  const parsedTimestamp = parseInt(timestamp, 10);
  if (parsedTimestamp < EARLIEST_TIMESTAMP) {
    return false;
  }
  if (parsedTimestamp > LATEST_TIMESTAMP) {
    return false;
  }
  return true;
}

export function coalesceSmoothing(
  maybeSmoothing: string | null,
  defaultSmoothing: SmoothingParam = "2",
): SmoothingParam {
  let smoothing: SmoothingParam = defaultSmoothing;
  if (maybeSmoothing && smoothingParams.includes(maybeSmoothing)) {
    smoothing = maybeSmoothing as SmoothingParam;
  }
  return smoothing;
}

export function coalesceScale(
  maybeScale: string | null,
  defaultScale: ScaleParam = "2",
): ScaleParam {
  let scale: ScaleParam = defaultScale;
  if (maybeScale && scaleParams.includes(maybeScale)) {
    scale = maybeScale as ScaleParam;
  }
  return scale;
}

export function coalesceTimestamp(
  maybeTimestamp: string | null,
  defaultTimestamp: string,
): string {
  let timestamp = defaultTimestamp;
  if (isValidTimestamp(maybeTimestamp)) {
    timestamp = maybeTimestamp as string;
  }

  return timestamp;
}

export function coalesceRandomly(
  maybeParam: string | null,
  // TODO: callable validation function for maybeParam
  defaultParams: string[],
): string {
  let param = randomElem(defaultParams);
  if (maybeParam) {
    param = maybeParam;
  }
  return param;
}

export function getSearchParams(): SearchURLParams {
  const urlParams = new URLSearchParams(window.location.search);

  const queryParam = urlParams.get("query");
  const query = coalesceRandomly(queryParam, SAMPLE_SEARCHES);

  const minLenParam = urlParams.get("minSentLen") || "";
  const minSentLen = coalesceLength(minLenParam, "1");

  const scaleParam = urlParams.get("scale");
  const scale = coalesceScale(scaleParam, "relative");

  const smoothingParam = urlParams.get("smoothing") || "";
  const smoothing = coalesceSmoothing(smoothingParam, "2");

  const startParam = urlParams.get("start") || "";
  const start = coalesceTimestamp(startParam, EARLIEST_TIMESTAMP.toString());

  const endParam = urlParams.get("end") || "";
  const end = coalesceTimestamp(endParam, LATEST_TIMESTAMP.toString());

  return { query, minSentLen, scale, smoothing, start, end };
}

export function getRanksParams(): RanksURLParams {
  const urlParams = new URLSearchParams(window.location.search);

  const phraseLenParam = urlParams.get("phraseLen") || "";
  const phraseLen = coalesceLength(phraseLenParam, "1");

  const minLenParam = urlParams.get("minSentLen") || "";
  const minSentLen = coalesceLength(minLenParam, "1");

  const yearParam = urlParams.get("year") || "";
  const year = coalesceTimestamp(yearParam, "0");

  return { phraseLen, minSentLen, year };
}

export function toURLParams(params: Record<string, string>) {
  const urlParams = new URLSearchParams();

  for (const key in params) {
    if (params[key]) {
      urlParams.append(key, params[key]);
    }
  }

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, "", newUrl);
}
