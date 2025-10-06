// URL params
import {
  SCALES,
  SMOOTHERS,
  LENGTHS,
  SMOOTHINGS,
  FIELDS,
  ATTRIBUTES,
} from "@utils/constants";

import type { QueryError } from "@utils/errors";

import { FORMATTERS } from "@utils/ui.ts";

export const lengths = LENGTHS.map((n: string): number => {
  return parseInt(n, 10);
});
export const smoothings = SMOOTHINGS.map((n: string): number => {
  return parseInt(n, 10);
});

// user input
export type Operator = "+" | "-";

export type Length = (typeof lengths)[number];
export type Attribute = keyof typeof ATTRIBUTES;
export type AttributeId = (typeof ATTRIBUTES)[Attribute];
export type Formatter = keyof typeof FORMATTERS;
export type FormatterFn = (typeof FORMATTERS)[Formatter];
export type Scale = keyof typeof SCALES;
export type ScaleData = (typeof SCALES)[Scale];
export type LengthParam = (typeof LENGTHS)[number];
export type Smoother = keyof typeof SMOOTHERS;
export type SmoothingParam = (typeof SMOOTHINGS)[number];

export type Axis = "linear" | "logarithmic";
export type Field = keyof typeof FIELDS;

export interface Row {
  day: number; // timestamp representing a date
  hits: number;
  authors: number;
  hpa: number;
}
export interface Result {
  term: string;
  data: Row[];
}
export interface Rank {
  term: string;
  hits: number;
  authors: number;
}

export interface QueryParams {
  term: Term;
  scale: Scale;
  smoothing: number;
  start: number;
  end: number;
}

export interface SearchURLParams {
  query: string;
  minSentLen: LengthParam | null;
  scale: Scale | null;
  smoothing: SmoothingParam | null;
  smoother: Smoother | null;
  field: Field | null;
  start: string | null;
  end: string | null;
}

export interface RanksURLParams {
  termLen: LengthParam | null;
  year: string | null;
}

// searchable term after split by operator and stripped of whitespace
export interface Term {
  raw: string; // the user's given input for the term
  repr: string; // the way we will print the input on the legend

  text: string; // a single term, no operators or annotations
  len: Length; // how many words are in the term
  attr: Attribute; // what context to search the term in
  attrId: AttributeId; // same but as id
  operator: Operator | null; // how the current term connects to the previous term
  hasWildcard: boolean; // whether a single * exists in raw/

  errors: QueryError[];
}

// searches after split by , and stripped of whitespace
export interface Query {
  raw: string; // unaltered user input, per term
  repr: string; // to be printed later

  terms: Term[];
  errors: QueryError[]; // if len(error) is > 1, only `raw` may have a value
}
