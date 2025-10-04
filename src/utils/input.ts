import {
  TERM_RE,
  TOKEN_DELIMS_RE,
  ATTRIBUTES,
  TERM_DELIMS_RE,
} from "@utils/constants";
import { fetchTopTerms } from "@utils/sqlite";

import type { Separator, Length, Term, Query, Error } from "@utils/types";

function countWords(term: string): number {
  // NOTE: this would fail to count UCSUR, but it is only used after split
  return term.split(/\s+/).length;
}

function splitOnDelim(input: string, delimiter: string): string[] {
  return input
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function countSubstring(s: string, match: string): number {
  if (!match) return 0;
  let count = 0;
  let pos = 0;

  while (true) {
    pos = s.indexOf(match, pos);
    if (pos === -1) break;
    count++;
    pos += match.length;
  }

  return count;
}

function queryRepr(terms: Term[]): string {
  return terms
    .map((term) => {
      if (term.separator) {
        return term.separator + " " + term.repr;
      }
      return term.repr;
    })
    .join(" ");
}

function createTerm(
  rawTerm: string,
  separator: Separator,
  hasWildcard: boolean,
): Term {
  let [text, rawAttr] = rawTerm.split("_");
  text = text.trim();

  const length = countWords(text) as Length;
  const repr = rawTerm;

  let attr = ATTRIBUTES[rawAttr]!;
  if (!attr) {
    attr = ATTRIBUTES.all;
  }

  return {
    raw: rawTerm,
    repr,
    text: text,
    len: length,
    attr: attr,
    separator,
    hasWildcard,
    errors: [],
  };
}

function dedupeQueries(queries: Query[]): ProcessedQueries {
  const seen = new Set<string>();
  const errors: Error[] = [];
  queries = queries.filter((query) => {
    if (seen.has(query.repr)) {
      errors.push({ query: query.repr, error: "Duplicate query" });
      return false;
    } else {
      seen.add(query.repr);
      return true;
    }
  });

  return { queries, errors };
}

async function expandWildcards(queries: Query[]): Promise<Query[]> {
  const expandedQueries: Query[] = [];

  for (const query of queries) {
    // Find all terms with wildcards
    const wildcardTerms = query.terms.filter((term) => term.hasWildcard);

    if (wildcardTerms.length === 0) {
      expandedQueries.push(query);
    } else if (wildcardTerms.length === 1) {
      const wildcardTerm = wildcardTerms[0];
      const topTerms = await fetchTopTerms(wildcardTerm);
      if (topTerms.length === 0) {
        errors.push({
          query: query.raw,
          error: "No results for this wildcard.",
        });
        continue;
      }

      for (const topTerm of topTerms) {
        const newQuery = {
          ...query,
          terms: query.terms.map(
            (term: Term): Term =>
              term === wildcardTerm
                ? { ...term, text: topTerm, repr: topTerm }
                : term,
          ),
        };
        // TODO: kinda a mixed responsibility thing right
        newQuery.repr = queryRepr(newQuery.terms);
        expandedQueries.push(newQuery);
      }
    }
  }

  return queries;
}

function errCheckTerm(term: Term) {
  const errs: Error[] = [];
  const text = term.repr!;
  if (countSubstring(text, "_") > 1) {
    errs.push({ message: "Only one one attribute allowed per query." });
  }
  if (countSubstring(text, "*") > 1) {
    errs.push({ message: "Only one wildcard allowed per query." });
  }

  if (text.indexOf("_") === 0) {
    errs.push({ message: "Query may not begin with attribute." });
  }
  if (text.indexOf("_") === text.length) {
    errs.push({ message: "No attribute is specified." });
  }
  if (text.indexOf("*") === 0) {
    errs.push({ message: "Query may not begin with wildcard." });
  }
  term.errors.push(...errs);
}

function parseTerm(term: Term) {
  errCheckTerm(term);
  if (term.errors.length > 0) {
    return;
  }

  let text = term.raw;
  let attr = "";

  // TODO: removal of consecutive duplicates breaks this a bit
  const iAttr = text.lastIndexOf("_");
  if (iAttr > -1) {
    attr = text.substring(iAttr).toUpperCase();
    text = text.substring(0, iAttr);

    attr = ATTRIBUTES[attr]!;
    if (!attr) {
      attr = ATTRIBUTES.all;
    }
  }

  let tokens: string[] = text.split(TOKEN_DELIMS_RE);
  tokens = tokens.filter((token) => token !== undefined && token.length > 0);
  console.log(tokens);

  const termTokens: string[] = [];
  tokens.forEach((token) => {
    if (TERM_RE.test(token)) {
      termTokens.push(token);
      // continue;
    }

    // if (token === "+" || token === "-") {
    //   if (termTokens.length > 0) {
    //     // throws out trailing operators
    //     term = createTerm(termTokens.join(" "), separator, hasWildcard);
    //     termsTokens.push(term);
    //     // reset
    //     // termTokens = [];
    //     // hasWildcard = false;
    //   }
    //   separator = token as Separator;
    // } else if (token.startsWith("*")) {
    //   if (termTokens.length == 0) {
    //     const error = `term may not begin with a wildcard`;
    //     errors.push(error);
    //   }
    //   if (hasWildcard) {
    //     const error = `term may not have more than one wildcard`;
    //     errors.push(error);
    //   }
    //
    //   hasWildcard = true;
    //   termTokens.push(token);
    // } else if (TERM_RE.test(token)) {
    //   termTokens.push(token);
    // } else {
    //   const error = `term must be letters, numbers, or UCSUR text`;
    //   errors.push(error);
    // }
  });

  // if (termTokens.length > 0) {
  //   terms.push(createTerm(termTokens.join(" "), separator, hasWildcard));
  // }

  term.text = tokens.join(" ");
  term.len = tokens.length;
  term.attr = 0;
}

function parseTerms(query: Query) {
  const terms: Term[] = [];
  const rawTerms = query.repr!.split(TERM_DELIMS_RE);
  // TODO: does this preserve operators
  // if so, they need to be on the left
  for (let t of rawTerms) {
    t = t.trim();
    const term: Term = {
      raw: t,
      repr: t,
      text: null,
      len: null,
      attr: null,
      separator: null,
      hasWildcard: false,
      errors: [],
    };
    parseTerm(term);

    terms.push(term);
  }
  query.terms = terms;
}

function cleanQuery(query: Query) {
  let text = query.raw;

  text = text.toLowerCase();
  // removing consecutive duplicates
  // NOTE: UCSUR text is not replaced because I don't provide the unicode flag
  // text = text.replace(/(.)\1+/g, "$1");
  text = text.trim();
  // text = text + attr;

  query.repr = text;
  return query;
}

function parseQueries(input: string): Query[] {
  const queries: Query[] = [];

  const rawQueries = splitOnDelim(input, ",");
  for (let q of rawQueries) {
    q = q.trim();
    const query: Query = {
      raw: q,
      repr: q,
      terms: [],
      errors: [],
    };
    cleanQuery(query);
    parseTerms(query);

    queries.push(query);
  }

  return queries;
}

export async function parseInput(input: string): Promise<Query[]> {
  const queries = parseQueries(input);
  await expandWildcards(queries);
  dedupeQueries(queries);

  return queries;
}
