import {
  SCALES,
  SMOOTHERS,
  LENGTHS,
  SMOOTHINGS,
  SAMPLE_SEARCHES,
  FIELDS,
} from "@utils/constants";
import type {
  LengthParam,
  SmoothingParam,
  Scale,
  Smoother,
  SearchURLParams,
  RanksURLParams,
  Field,
} from "@utils/types";
import { randomElem, isValidTimestamp } from "@utils/other";

function coalesceLength(maybeLen: string): LengthParam | null {
  let len: LengthParam | null = null;
  if (maybeLen && LENGTHS.includes(maybeLen)) {
    len = maybeLen as LengthParam;
  }
  return len;
}

function coalesceSmoothing(
  maybeSmoothing: string | null,
): SmoothingParam | null {
  let smoothing: SmoothingParam | null = null;
  if (maybeSmoothing && SMOOTHINGS.includes(maybeSmoothing)) {
    smoothing = maybeSmoothing as SmoothingParam;
  }
  return smoothing;
}

function coalesceSmoother(maybeSmoother: string | null): Smoother | null {
  let smoother: Smoother | null = null;
  if (maybeSmoother && maybeSmoother in SMOOTHERS) {
    smoother = maybeSmoother as Smoother;
  }
  return smoother;
}

function coalesceField(maybeField: string | null): Field | null {
  let field: Field | null = null;
  if (maybeField && FIELDS.includes(maybeField)) {
    field = maybeField as Field;
  }
  return field;
}

function coalesceScale(maybeScale: string | null): Scale | null {
  let scale: Scale | null = null;
  if (maybeScale && maybeScale in SCALES) {
    scale = maybeScale as Scale;
  }
  return scale;
}

function coalesceTimestamp(maybeTimestamp: string | null): string | null {
  let timestamp = null;
  if (isValidTimestamp(maybeTimestamp)) {
    timestamp = maybeTimestamp as string;
  }
  return timestamp;
}

function coalesceRandomly(
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

  const fieldParam = urlParams.get("field") || "";
  const field = coalesceField(fieldParam);

  const smoothingParam = urlParams.get("smoothing") || "";
  const smoothing = coalesceSmoothing(smoothingParam);

  const smootherParam = urlParams.get("smoother") || "";
  const smoother = coalesceSmoother(smootherParam);

  const startParam = urlParams.get("start") || "";
  const start = coalesceTimestamp(startParam);

  const endParam = urlParams.get("end") || "";
  const end = coalesceTimestamp(endParam);

  // TODO: move field?
  return { query, scale, smoothing, field, smoother, minSentLen, start, end };
}

export function getRanksParams(): RanksURLParams {
  const urlParams = new URLSearchParams(window.location.search);

  const termLenParam = urlParams.get("termLen") || "";
  const termLen = coalesceLength(termLenParam);

  const minLenParam = urlParams.get("minSentLen") || "";
  const minSentLen = coalesceLength(minLenParam);

  const yearParam = urlParams.get("year") || "";
  const year = coalesceTimestamp(yearParam);

  return { termLen: termLen, minSentLen, year };
}

export function toURLParams(params: Record<string, string>) {
  const urlParams = new URLSearchParams();
  // const sortedKeys = Object.keys(params).sort();

  // for (const key of sortedKeys) {
  for (const key in params) {
    if (params[key]) {
      urlParams.append(key, params[key]);
    }
  }

  const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
  window.history.replaceState({}, "", newUrl);
}
