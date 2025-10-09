import type { Stringable } from "@utils/types";

export const ERROR_RESULTS = ["ignore", "fail"];
export type ErrorResult = (typeof ERROR_RESULTS)[number];
export interface QueryError {
  message: string;
  tokenIndex?: number;
  result: ErrorResult;
}
export const ERRORS: Record<string, QueryError> = {
  DuplicateQuery: {
    message: "Duplicate query",
    result: "error", // the one marked duplicate will not be graphed
  },
  DuplicateOperator: {
    message:
      'Duplicate operator "${token}" found after operator "${operator}" (ignoring)',
    result: "warn",
  },

  DuplicateWildcard: {
    message: "Query may not have more than one wildcard",
    result: "error",
  },
  LeadingWildcard: {
    message: "Query may not start with wildcard",
    result: "error",
  },
  NoResultsWildcard: {
    message: 'No results for wildcard "${wildcard}"',
    result: "error",
  },
  MultiTermWildcard: {
    message: "Cannot add or subtract wildcards in two or more terms",
    result: "error",
  },
  NoWildcard: {
    message: "Term was marked as having a wildcard but has none??",
    result: "error",
  },

  DuplicateAttribute: {
    message: "Term may not have more than one attribute",
    result: "error", // we can't know which the user meant, so give up
  },
  EarlyAttribute: {
    message:
      'Found attribute before end of term on token "${token}" (ignoring)',
    result: "warn",
  },
  EmptyAttribute: {
    message: 'Found underscore but no attribute in token "${token}" (ignoring)',
    result: "warn",
  },
  InvalidAttribute: {
    message: 'Found invalid attribute "${attr}" in token "${token}" (ignoring)',
    result: "warn",
  },
  InvalidToken: {
    message: 'Token "${token}" is invalid',
    result: "error",
  },
  NoResultsTerm: {
    message: 'No results for term "${term}"',
    result: "warn",
  },
  NoResultsQuery: {
    message: "No results for this query",
    result: "error",
  },
  NoSetMath: {
    message: "Cannot add or subtract authors (ignoring)",
    result: "warn",
  },
};

function subst(template: string, values: Record<string, string>) {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => {
    if (values[key] === undefined) {
      throw new Error(`Missing value for key "${key}"`);
    }
    return values[key];
  });
}

export function makeError(
  name: keyof typeof ERRORS,
  params: Record<string, Stringable>,
  tokenIndex?: number,
  result?: ErrorResult,
): QueryError {
  const template = ERRORS[name];
  return {
    message: subst(template.message, params),
    result: result ? result : template.result,
    tokenIndex,
  };
}
