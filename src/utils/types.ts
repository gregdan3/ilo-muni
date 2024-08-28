// URL params
import { SCALES, SMOOTHERS, LENGTHS, SMOOTHINGS } from "@utils/constants";

import { FORMATTERS } from "@utils/ui.ts";

export const lengths = LENGTHS.map((n: string): number => {
  return parseInt(n, 10);
});
export const smoothings = SMOOTHINGS.map((n: string): number => {
  return parseInt(n, 10);
});

export type Formatter = keyof typeof FORMATTERS;
export type Scale = keyof typeof SCALES;
export type ScaleData = (typeof SCALES)[Scale];
export type LengthParam = (typeof LENGTHS)[number];
export type Smoother = keyof typeof SMOOTHERS;
export type SmoothingParam = (typeof SMOOTHINGS)[number];
export type Axis = "linear" | "logarithmic";

export interface SearchURLParams {
  query: string;
  minSentLen: LengthParam | null;
  scale: Scale | null;
  smoothing: SmoothingParam | null;
  smoother: Smoother | null;
  start: string | null;
  end: string | null;
}

export interface RanksURLParams {
  phraseLen: LengthParam | null;
  minSentLen: LengthParam | null;
  year: string | null;
}

// user input
export type Separator = "+" | "-" | null;
export type Length = (typeof lengths)[number];

// searchable words/phrases after split by separator and stripped of whitespace
export interface Phrase {
  raw: string; // the user's given input for the phrase
  repr: string; // the way we will print the input on the legend

  term: string; // a single word or phrase, no separators or annotations
  length: Length; // how many words are in the phrase
  minSentLen: Length; // specified by user or overridden
  separator: Separator; // how the current phrase connects to the previous phrase
  hasWildcard: boolean; // whether a single * exists in raw/
}

// searches after split by , and stripped of whitespace
export interface Query {
  raw: string; // unaltered user input, per-phrase
  repr: string; // to be printed later
  phrases: Phrase[];
  // error: string[];
}

export interface QueryError {
  query: string; // raw of the query
  error: string;
}

export interface PackagedPhrases {
  phrases: Phrase[];
  errors: string[];
}

export interface ProcessedQueries {
  queries: Query[];
  errors: QueryError[];
}
