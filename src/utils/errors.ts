export const ERROR_RESULTS = ["ignore", "fail"];
export type ErrorResult = (typeof ERROR_RESULTS)[number];
export interface QueryError {
  message: string;
  tokenIndex?: number;
  result: ErrorResult;
}
export const ERRORS: Record<string, QueryError> = {
  DuplicateOperator: {
    message:
      'Duplicate operator "${token}" found after operator "${operator} (ignoring)"',
    result: "ignore",
  },
  DuplicateWildcard: {
    message: "Query may not have more than one wildcard",
    result: "fail",
  },
  LeadingWildcard: {
    message: "Query may not start with wildcard",
    result: "fail",
  },
  DuplicateAttribute: {
    message: "Term may not have more than one attribute",
    result: "fail", // we can't know which the user meant
  },
  EarlyAttribute: {
    message:
      'Found attribute before end of term on token "${token} (ignoring)"',
    result: "ignore",
  },
  EmptyAttribute: {
    message: 'Found underscore but no attribute in token "${token}" (ignoring)',
    result: "ignore",
  },
  InvalidAttribute: {
    message: 'Found invalid attribute "${attr}" in token "${token}" (ignoring)',
    result: "ignore",
  },
  InvalidToken: {
    message: 'Token "${token}" is invalid',
    result: "fail",
  },
  NoResults: {
    message: "",
    result: "fail",
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
  params: Record<string, any>,
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
