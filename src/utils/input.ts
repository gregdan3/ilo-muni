import {
  TERM_RE,
  TOKEN_DELIMS_RE,
  TERM_DELIMS_RE,
  ATTRIBUTES,
} from "@utils/constants";
import { fetchTopTerms } from "@utils/sqlite";

import type { Operator, Term, Query, Attribute } from "@utils/types";

import { makeError } from "@utils/errors";
import type { QueryError } from "@utils/errors";

function splitOnDelim(input: string, delimiter: string): string[] {
  return input
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function queryRepr(query: Query): string;
function queryRepr(terms: Term[]): string;
function queryRepr(arg: Query | Term[]): string {
  const terms = Array.isArray(arg) ? arg : arg.terms;
  return terms
    .map((term) =>
      term.operator ? term.operator + " " + term.repr : term.repr,
    )
    .join(" ");
}

function markDupeQueries(queries: Query[]) {
  const seen = new Set<string>();
  let error: QueryError;
  queries.map((query) => {
    if (seen.has(query.repr)) {
      error = makeError("DuplicateQuery", {});
      query.errors.push(error);
    } else {
      seen.add(query.repr);
    }
  });
}

async function expandWildcardQuery(query: Query): Promise<Query[]> {
  // returns expanded queries, or original query if error
  const wildcardTerms = query.terms.filter((term) => term.hasWildcard);
  let error: QueryError;

  if (wildcardTerms.length > 1) {
    error = makeError("MultiTermWildcard", {});
    query.errors.push(error);
    return [query];
  }

  // if (wildcardTerms.length === 0) {
  //   error = makeError("NoWildcard", { wildcard: wildcardTerm.repr });
  //   query.errors.push(error);
  //   return [query];
  // }

  const wildcardTerm = wildcardTerms[0];
  const topTerms = await fetchTopTerms(wildcardTerm);
  if (topTerms.length === 0) {
    error = makeError("NoResultsWildcard", { wildcard: wildcardTerm.repr });
    query.errors.push(error);
    return [query];
  }

  return topTerms.map((topTerm): Query => {
    const newQuery = {
      ...query,
      terms: query.terms.map((term) =>
        term === wildcardTerm
          ? { ...term, text: topTerm, repr: topTerm }
          : term,
      ),
    };
    newQuery.repr = queryRepr(newQuery);
    return newQuery;
  });
}

function parseTerm(input: string): Term {
  const raw = input;
  let rawAttr: string = "";
  let attr: Attribute = "";
  let operator: Operator | null = null;
  let hasWildcard = false;
  const errors: QueryError[] = [];

  let error: QueryError;

  let tokens: string[] = input.split(TOKEN_DELIMS_RE);
  tokens = tokens
    .map((token) => token?.trim())
    .filter((token) => token !== undefined && token.length > 0);
  const tokensLen = tokens.length - 1; // for indexing
  const termTokens: string[] = [];

  for (let [index, token] of tokens.entries()) {
    if (token === "+" || token === "-") {
      if (operator !== null) {
        error = makeError("DuplicateOperator", { token, operator }, index);
        errors.push(error);
        continue;
      }
      // TODO: order?
      operator = token;
      continue;
    }

    if (token.includes("*")) {
      if (token.startsWith("*") && index === 0) {
        error = makeError("LeadingWildcard", {}, index);
        errors.push(error);
      }
      // >1 wildcard per term is fine
      // more than one per query is not
      // if (hasWildcard === true) {
      //   error = makeError("DuplicateWildcard", {}, index);
      //   errors.push(error);
      // }
      hasWildcard = true;
    }

    if (token.includes("_")) {
      if (index !== tokensLen) {
        // attr must be on last token of term
        error = makeError("EarlyAttribute", { token }, index);
        errors.push(error);
      }
      if (token.at(-1) === "_") {
        // can't be empty
        error = makeError("EmptyAttribute", { token }, index);
        errors.push(error);
      }
      const iAttr = token.indexOf("_") + 1;
      rawAttr = token.substring(iAttr).toUpperCase();
      if (rawAttr in ATTRIBUTES) {
        attr = rawAttr as Attribute;
      } else {
        error = makeError("InvalidAttribute", { attr: rawAttr, token }, index);
        errors.push(error);
      }
      // the only time token will be redefined
      token = token.substring(0, iAttr - 1);
    }
    if (!TERM_RE.test(token)) {
      error = makeError("InvalidToken", { token }, index);
      errors.push(error);
    }

    termTokens.push(token);
  }

  const text = termTokens.join(" ");
  const len = termTokens.length;
  const repr = attr ? text + "_" + attr : text;
  const attrId = ATTRIBUTES[attr];
  const term: Term = {
    raw,
    repr,
    text,
    len, // this can be zero - caller's responsibility to clean out
    attr,
    attrId,
    operator,
    hasWildcard,
    errors,
  };
  return term;
}

function parseTerms(query: string): Term[] {
  const rawTerms = query.split(TERM_DELIMS_RE);
  const terms = rawTerms
    .map((term) => parseTerm(term))
    .filter((term) => term !== undefined && term !== null && term!.len > 0);

  return terms;
}

function cleanQuery(input: string): string {
  input = input.trim();
  input = input.toLowerCase();
  // NOTE: used to remove consecutive duplicates, but stopped
  // because it would destroy attributes
  // NOTE: UCSUR text is not reduced without the Unicode flag (intended)
  // text = text.replace(/(.)\1+/g, "$1");
  return input;
}

function parseQuery(input: string): Query {
  const raw = input;
  input = cleanQuery(input);

  const terms = parseTerms(input);
  const repr = queryRepr(terms);
  const errors = terms.flatMap((t) => t.errors);
  const query: Query = {
    raw,
    repr,
    terms,
    errors,
  };
  return query;
}
function parseQueries(input: string): Query[] {
  const queries: Query[] = [];

  const rawQueries = splitOnDelim(input, ",");
  for (const q of rawQueries) {
    const query = parseQuery(q);
    queries.push(query);
  }
  return queries;
}

export async function parseInput(input: string): Promise<Query[]> {
  const parsed = parseQueries(input);
  const expanded: Query[] = [];

  // if the wildcards expand successfully, their originals will be thrown out
  for (const q of parsed) {
    if (hasWildcard(q) && !canRun(q)) {
      expanded.push(...(await expandWildcardQuery(q)));
    } else {
      expanded.push(q);
    }
  }
  markDupeQueries(expanded);
  return expanded;
}

function canRun(query: Query): boolean {
  return (
    query.errors.some((e) => e.result === "error") ||
    query.terms.some((t) => t.errors.some((e) => e.result === "error"))
  );
}

function hasWildcard(query: Query): boolean {
  return query.terms.some((t) => t.hasWildcard);
}
