import {
  EARLIEST_TIMESTAMP,
  LATEST_TIMESTAMP,
  SCALES,
  SMOOTHERS,
} from "@utils/constants";
import type {
  LengthParam,
  SmoothingParam,
  Scale,
  Smoother,
  SearchURLParams,
  RanksURLParams,
} from "@utils/types";
import { lengthParams, smoothingParams } from "@utils/types";

const SAMPLE_SEARCHES = [
  // duh
  "toki, pona, toki pona",
  "sitelen, pona, sitelen pona",
  // phrase trends
  "tomo tawa, ilo tawa",
  "sina seme, sina pilin seme, sina pali e seme",
  // isolating phrases
  "toki_1 - toki_2",
  // synonyms
  "ale, ali, ale + ali",
  "ala, x, ala + x",
  "anu, y, anu + y",
  // word groups
  "laso, loje, walo, jelo, pimeja",
  "soweli, waso, kala, akesi, pipi",
  "sewi, anpa",
  "sinpin, monsi",
  "meli, mije, tonsi",
  "pu, ku, su",
  "lukin, oko",
  "sin, namako",
  "selo, sijelo",
  // modifier usage
  "wawa a, wawa mute, wawa suli, wawa sewi",
  "tenpo ni, tenpo pini, tenpo kama, tenpo mute, tenpo suli, tenpo poka",
  // grammatical things
  "kepeken ilo, kepeken e ilo",
  "kin la, poka la, sama la, namako la",
  "pali e, lon e, mama e, kama e",
  // names
  "jan kekan, mun kekan",
  "sonja, jan sonja",
  "inli, toki inli",
  // disambiguation
  "san - kekan san",
  // periodic phrases
  "suno pi toki pona",
  "tenpo monsuta",
  "tenpo pana",
  "tenpo lete",
  "tenpo seli",
  // funney
  "sona kiwen",
];

function randomElem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isValidTimestamp(timestamp: string | null): boolean {
  // TODO: it also needs to be one of the selectable timestamps, not just any in range
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

export function coalesceLength(maybeLen: string): LengthParam | null {
  let len: LengthParam | null = null;
  if (maybeLen && lengthParams.includes(maybeLen)) {
    len = maybeLen as LengthParam;
  }
  return len;
}

export function coalesceSmoothing(
  maybeSmoothing: string | null,
): SmoothingParam | null {
  let smoothing: SmoothingParam | null = null;
  if (maybeSmoothing && smoothingParams.includes(maybeSmoothing)) {
    smoothing = maybeSmoothing as SmoothingParam;
  }
  return smoothing;
}

export function coalesceSmoother(
  maybeSmoother: string | null,
): Smoother | null {
  let smoother: Smoother | null = null;
  if (maybeSmoother && maybeSmoother in SMOOTHERS) {
    smoother = maybeSmoother as Smoother;
  }
  return smoother;
}

export function coalesceScale(maybeScale: string | null): Scale | null {
  let scale: Scale | null = null;
  if (maybeScale && maybeScale in SCALES) {
    scale = maybeScale as Scale;
  }
  return scale;
}

export function coalesceTimestamp(
  maybeTimestamp: string | null,
): string | null {
  let timestamp = null;
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
  const minSentLen = coalesceLength(minLenParam);

  const scaleParam = urlParams.get("scale");
  const scale = coalesceScale(scaleParam);

  const smoothingParam = urlParams.get("smoothing") || "";
  const smoothing = coalesceSmoothing(smoothingParam);

  const smootherParam = urlParams.get("smoother") || "";
  const smoother = coalesceSmoother(smootherParam);

  const startParam = urlParams.get("start") || "";
  const start = coalesceTimestamp(startParam);

  const endParam = urlParams.get("end") || "";
  const end = coalesceTimestamp(endParam);

  return { query, minSentLen, scale, smoothing, smoother, start, end };
}

export function getRanksParams(): RanksURLParams {
  const urlParams = new URLSearchParams(window.location.search);

  const phraseLenParam = urlParams.get("phraseLen") || "";
  const phraseLen = coalesceLength(phraseLenParam);

  const minLenParam = urlParams.get("minSentLen") || "";
  const minSentLen = coalesceLength(minLenParam);

  const yearParam = urlParams.get("year") || "";
  const year = coalesceTimestamp(yearParam);

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
