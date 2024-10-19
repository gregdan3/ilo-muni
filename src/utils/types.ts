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
export type FormatterFn = (typeof FORMATTERS)[Formatter];
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
  termLen: LengthParam | null;
  minSentLen: LengthParam | null;
  year: string | null;
}

// user input
export type Separator = "+" | "-" | null;
export type Length = (typeof lengths)[number];

// searchable term after split by separator and stripped of whitespace
export interface Term {
  raw: string; // the user's given input for the term
  repr: string; // the way we will print the input on the legend

  text: string; // a single term, no separators or annotations
  len: Length; // how many words are in the term
  minSentLen: Length; // specified by user or overridden
  separator: Separator; // how the current term connects to the previous term
  hasWildcard: boolean; // whether a single * exists in raw/
}

// searches after split by , and stripped of whitespace
export interface Query {
  raw: string; // unaltered user input, per term
  repr: string; // to be printed later
  terms: Term[];
  // error: string[];
}

export interface QueryError {
  query: string; // raw of the query
  error: string;
}

export interface PackagedTerms {
  terms: Term[];
  errors: string[];
}

export interface ProcessedQueries {
  queries: Query[];
  errors: QueryError[];
}
