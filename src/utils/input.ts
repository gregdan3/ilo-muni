import { TERM_RE, TERM_DELIMS_RE } from "@utils/constants";
import { fetchTopTerms } from "@utils/sqlite";

import type {
  Separator,
  Length,
  Term,
  Query,
  QueryError,
  ProcessedQueries,
  PackagedTerms,
} from "@utils/types";

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

function countWords(term: string): number {
  // NOTE: this would fail to count UCSUR, but it is only used after split
  return term.split(/\s+/).length;
}

function cleanInput(input: string): string {
  input = input.toLowerCase();
  input = input.replace(/(.)\1+/g, "$1");
  // NOTE: UCSUR text is not replaced because I don't provide the unicode flag
  input = input.trim();
  return input;
}

function splitOnDelim(input: string, delimiter: string): string[] {
  return input
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function toQueryTokens(query: string): string[] {
  const result = query.trim().split(TERM_DELIMS_RE);
  return result.filter((token) => token !== undefined && token.length > 0);
}

function toTerms(query: string, givenMinSentLen: Length): PackagedTerms {
  const terms: Term[] = [];
  const errors: string[] = [];
  let separator: Separator = null;
  let currentTerm: string[] = [];
  let hasWildcard = false;

  const tokens = toQueryTokens(query);
  // TODO: stack based operator resolution?
  // separate resolver?

  // TODO: finally on for loop?
  tokens.forEach((token) => {
    if (token === "+" || token === "-") {
      if (currentTerm.length > 0) {
        // throws out trailing operators
        terms.push(
          createTerm(
            currentTerm.join(" "),
            separator,
            givenMinSentLen,
            hasWildcard,
          ),
        );
        // reset
        currentTerm = [];
        hasWildcard = false;
      }
      separator = token as Separator;
    } else if (token.startsWith("*")) {
      if (currentTerm.length == 0) {
        const error = `term may not begin with a wildcard`;
        errors.push(error);
      }
      if (hasWildcard) {
        const error = `term may not have more than one wildcard`;
        errors.push(error);
      }

      hasWildcard = true;
      currentTerm.push(token);
    } else if (TERM_RE.test(token)) {
      currentTerm.push(token);
    } else {
      const error = `term must be letters, numbers, or UCSUR text`;
      errors.push(error);
    }
  });

  if (currentTerm.length > 0) {
    terms.push(
      createTerm(
        currentTerm.join(" "),
        separator,
        givenMinSentLen,
        hasWildcard,
      ),
    );
  }

  return { terms, errors };
}

function createTerm(
  combinedTerm: string,
  separator: Separator,
  givenMinSentLen: Length,
  hasWildcard: boolean,
): Term {
  const [termWithMin, minLen] = combinedTerm.split("_");
  const term = termWithMin.trim();
  const length = countWords(term) as Length;
  const parsedMinLen = minLen ? (parseInt(minLen, 10) as Length) : length;
  let repr = combinedTerm;
  let minSentLen = Math.max(length, givenMinSentLen) as Length;

  if (minLen && parsedMinLen != minSentLen) {
    minSentLen = parsedMinLen;
  } else {
    repr = term;
  }

  return {
    raw: combinedTerm,
    repr,
    text: term,
    len: length,
    minSentLen,
    separator,
    hasWildcard,
  };
}

function toQueries(input: string, givenMinSentLen: Length): ProcessedQueries {
  const rawTerms = splitOnDelim(input, ",");
  const queries: Query[] = [];
  const errors: QueryError[] = [];
  rawTerms.map((query: string) => {
    const { terms, errors: termErrors } = toTerms(query, givenMinSentLen);
    const constructedQuery = {
      raw: query,
      repr: queryRepr(terms),
      terms: terms,
    };

    if (termErrors.length > 0) {
      errors.push({
        query: constructedQuery.raw,
        error: termErrors.join("; "),
      });
      return;
    }

    queries.push(constructedQuery);
  });

  return { queries, errors };
}

function dedupeQueries(queries: Query[]): ProcessedQueries {
  const seen = new Set<string>();
  const errors: QueryError[] = [];
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

async function expandWildcards(queries: Query[]): Promise<ProcessedQueries> {
  const expandedQueries: Query[] = [];
  const errors: QueryError[] = [];

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
    } else {
      // cannot have more than one wildcard per query
      errors.push({
        query: query.raw,
        error: "Only one wildcard allowed per query",
      });
    }
  }

  return { queries: expandedQueries, errors };
}

export async function inputToQueries(
  input: string,
  givenMinSentLen: Length,
): Promise<ProcessedQueries> {
  input = cleanInput(input);

  const { queries, errors: initErrors } = toQueries(input, givenMinSentLen);

  const { queries: expandedQueries, errors: wildcardErrors } =
    await expandWildcards(queries);

  const { queries: dedupedQueries, errors: dupeErrors } =
    dedupeQueries(expandedQueries);

  return {
    queries: dedupedQueries,
    errors: initErrors.concat(dupeErrors, wildcardErrors),
  };
}
