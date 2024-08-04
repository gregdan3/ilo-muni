// URL params
export const scales = [
  "rel",
  "abs",
  "logrel",
  "logabs",
  "normrel",
  "normabs",
  "deriv1",
  // "deriv2",
  "relderiv1",
  // "relderiv2",
  "cmsum",
  "entropy",
  "relentropy",
  "zscore",
];
export const lengthParams = ["1", "2", "3", "4", "5", "6"];
export const lengths = lengthParams.map((n: string): number => {
  return parseInt(n, 10);
});
export const smoothingParams = [
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

export type Scale = (typeof scales)[number];
export type LengthParam = (typeof lengthParams)[number];
export type SmoothingParam = (typeof smoothingParams)[number];

export interface SearchURLParams {
  query: string;
  minSentLen: LengthParam;
  scale: Scale;
  smoothing: SmoothingParam;
  start: string;
  end: string;
}

export interface RanksURLParams {
  phraseLen: LengthParam;
  minSentLen: LengthParam;
  year: string;
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
// TODO: what if

// searches after split by , and stripped of whitespace
export interface Query {
  raw: string; // unaltered user input, per-phrase
  repr: string; // to be printed later
  phrases: Phrase[];
  // error: string[];
}

export interface QueryError {
  query: Query;
  error: string;
}

export interface ProcessedQueries {
  queries: Query[];
  errors: QueryError[];
}
