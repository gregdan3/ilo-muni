import type { Row } from "@utils/sqlite.ts";
import type { Axis } from "@utils/types.ts";

type Scaler = (rows: Row[], totals: Row[], key: keyof Row) => Row[];

const getTotalOfRow = (rows: Row[], key: keyof Row = "hits"): number =>
  rows.reduce((sum, row) => sum + row[key], 0);

const getStandardDeviation = (
  rows: Row[],
  mean: number,
  key: keyof Row = "hits",
): number => {
  const powerSum = rows.reduce((sum, row) => {
    const deviation = row[key] - mean;
    return sum + deviation * deviation;
  }, 0);

  const variance = powerSum / rows.length;
  return Math.sqrt(variance);
};

const absoluteScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => rows;

const relativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) =>
  rows.map((row: Row, i: number) => {
    const total = totals[i][key];
    const percentage = total > 0 ? row[key] / total : 0;

    return {
      ...row,
      [key]: percentage,
    };
  });

const normalizedScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => {
  const min = Math.min(...rows.map((row) => row[key]));
  const max = Math.max(...rows.map((row) => row[key]));

  if (min === max) {
    return rows.map((row: Row) => ({ ...row, [key]: 0 }));
  }

  return rows.map((row: Row) => ({
    ...row,
    [key]: (row[key] - min) / (max - min),
  }));
};

const normalizedRelativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => normalizedScale(relativeScale(rows, totals, key), totals, key);

const derivativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) =>
  rows.map((row, i) => {
    const diff = i > 0 ? row[key] - rows[i - 1][key] : 0;

    return {
      ...row,
      [key]: diff,
    };
  });

const secondDerivativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => derivativeScale(derivativeScale(rows, totals, key), totals, key);

const relativeDerivativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => derivativeScale(relativeScale(rows, totals, key), totals, key);

const relativeSecondDerivativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => secondDerivativeScale(relativeScale(rows, totals, key), totals, key);

const cumulativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => {
  let cumSum = 0;

  return rows.map((row) => {
    cumSum += row[key];

    return {
      ...row,
      [key]: cumSum,
    };
  });
};

const normalizedCumulativeScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => normalizedScale(cumulativeScale(rows, totals, key), totals, key);

const absoluteEntropyScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits", // TODO:
) => {
  const total = getTotalOfRow(rows, key);

  return rows.map((row) => {
    const probability = row[key] / total;
    const entropy = probability ? -probability * Math.log2(probability) : 0;

    return {
      ...row,
      [key]: entropy,
    };
  });
};

const relativeEntropyScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => absoluteEntropyScale(relativeScale(rows, totals, key), totals, key);

const absoluteZScoreScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => {
  const average = getTotalOfRow(rows) / rows.length;
  const stdDeviation = getStandardDeviation(rows, average);

  return rows.map((row: Row) => ({
    ...row,
    [key]: (row[key] - average) / stdDeviation,
  }));
};

const relativeZScoreScale: Scaler = (
  rows: Row[],
  totals: Row[],
  key: keyof Row = "hits",
) => absoluteZScoreScale(relativeScale(rows, totals, key), totals, key);

export const scaleFunctions: {
  [key: string]: Scaler;
} = {
  abs: absoluteScale,
  rel: relativeScale,
  logabs: absoluteScale,
  logrel: relativeScale,
  normabs: normalizedScale,
  normrel: normalizedRelativeScale,
  deriv1: derivativeScale,
  deriv2: secondDerivativeScale,
  relderiv1: relativeDerivativeScale,
  relderiv2: relativeSecondDerivativeScale,
  cmsum: cumulativeScale,
  logcm: cumulativeScale,
  normcm: normalizedCumulativeScale,
  entropy: absoluteEntropyScale,
  relentropy: relativeEntropyScale,
  zscore: relativeZScoreScale,
};
