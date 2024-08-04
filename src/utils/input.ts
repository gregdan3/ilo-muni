import { PHRASE_RE, PHRASE_DELIMS_RE } from "@utils/constants";

import type {
  Separator,
  Length,
  Phrase,
  Query,
  QueryError,
  ProcessedQueries,
} from "@utils/types";

function queryRepr(phrases: Phrase[]): string {
  return phrases
    .map((phrase) => {
      if (phrase.separator) {
        return phrase.separator + " " + phrase.repr;
      }
      return phrase.repr;
    })
    .join(" ");
}

function countWords(phrase: string): number {
  // NOTE: this would fail to count UCSUR, but it is only used after split
  return phrase.split(/\s+/).length;
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
  const result = query.trim().split(PHRASE_DELIMS_RE);
  return result.filter((token) => token.length > 0);
}

function toPhrases(query: string, givenMinSentLen: Length): Phrase[] {
  const phrases: Phrase[] = [];
  let separator: Separator = null;
  let currentPhrase: string[] = [];
  let hasWildcard = false;

  const tokens = toQueryTokens(query);
  // TODO: stack based operator resolution?
  // separate resolver?

  // TODO: finally on for loop?
  tokens.forEach((token) => {
    if (token === "+" || token === "-") {
      if (currentPhrase.length > 0) {
        // throws out trailing operators
        phrases.push(
          createPhrase(
            currentPhrase.join(" "),
            separator,
            givenMinSentLen,
            hasWildcard,
          ),
        );
        // reset
        currentPhrase = [];
        hasWildcard = false;
      }
      separator = token as Separator;
    } else if (token === "*") {
      hasWildcard = true;
      currentPhrase.push(token);
      // TODO: check for multiple wildcards
    } else if (PHRASE_RE.test(token)) {
      // TODO: what if this fails
      currentPhrase.push(token);
    }
  });

  if (currentPhrase.length > 0) {
    phrases.push(
      createPhrase(
        currentPhrase.join(" "),
        separator,
        givenMinSentLen,
        hasWildcard,
      ),
    );
  }

  return phrases;
}

function createPhrase(
  combinedPhrase: string,
  separator: Separator,
  givenMinSentLen: Length,
  hasWildcard: boolean,
): Phrase {
  const [termWithMin, minLen] = combinedPhrase.split("_");
  const term = termWithMin.trim();
  const length = countWords(term) as Length;
  const parsedMinLen = minLen ? (parseInt(minLen, 10) as Length) : length;
  let repr = combinedPhrase;
  let minSentLen = Math.max(length, givenMinSentLen) as Length;

  if (minLen && parsedMinLen != minSentLen) {
    minSentLen = parsedMinLen;
  } else {
    repr = term;
  }

  return {
    raw: combinedPhrase,
    repr,
    term,
    length,
    minSentLen,
    separator,
    hasWildcard,
  };
}

function toQueries(input: string, givenMinSentLen: Length): ProcessedQueries {
  const rawPhrases = splitOnDelim(input, ",");
  const queries = rawPhrases.map((query: string): Query => {
    const phrases = toPhrases(query, givenMinSentLen);
    return { raw: query, repr: queryRepr(phrases), phrases: phrases };
  });
  return { queries, errors: [] };
}

function dedupeQueries(queries: Query[]): ProcessedQueries {
  const seen = new Set<string>();
  const errors: QueryError[] = [];
  queries = queries.filter((query) => {
    if (seen.has(query.repr)) {
      errors.push({ query: query, error: "Duplicate query" });
      return false;
    } else {
      seen.add(query.repr);
      return true;
    }
  });

  return { queries, errors };
}

export function inputToQueries(
  input: string,
  givenMinSentLen: Length,
): ProcessedQueries {
  input = cleanInput(input);

  const { queries, errors: initErrors } = toQueries(input, givenMinSentLen);

  const { queries: dedupedQueries, errors: dupeErrors } =
    dedupeQueries(queries);

  return {
    queries: dedupedQueries,
    errors: initErrors.concat(dupeErrors),
  };
}
