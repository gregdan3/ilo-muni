import type { Axis, Row, Field } from "@utils/types.ts";

type ScalerFn = (rows: Row[], totals: Row[], key: Field) => Row[];

const getTotalOfRow = (rows: Row[], key: Field): number =>
  rows.reduce((sum: number, row: Row): number => sum + row[key], 0);

const getStandardDeviation = (
  rows: Row[],
  mean: number,
  key: Field,
): number => {
  const powerSum = rows.reduce((sum: number, row: Row): number => {
    const deviation = row[key] - mean;
    return sum + deviation * deviation;
  }, 0);

  const variance = powerSum / rows.length;
  return Math.sqrt(variance);
};

const absoluteScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => rows;

const relativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] =>
  rows.map((row: Row, i: number): Row => {
    const total = totals[i][key];
    const percentage = total > 0 ? row[key] / total : 0;

    return {
      ...row,
      [key]: percentage,
    };
  });

const normalizedScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => {
  const min = Math.min(...rows.map((row: Row) => row[key]));
  const max = Math.max(...rows.map((row: Row) => row[key]));

  if (min === max) {
    return rows.map((row: Row): Row => ({ ...row, [key]: 0 }));
  }

  return rows.map(
    (row: Row): Row => ({
      ...row,
      [key]: (row[key] - min) / (max - min),
    }),
  );
};

const normalizedRelativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => normalizedScale(relativeScale(rows, totals, key), totals, key);

const derivativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] =>
  rows.map((row: Row, i: number): Row => {
    const diff = i > 0 ? row[key] - rows[i - 1][key] : 0;

    return {
      ...row,
      [key]: diff,
    };
  });

const secondDerivativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => derivativeScale(derivativeScale(rows, totals, key), totals, key);

const relativeDerivativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => derivativeScale(relativeScale(rows, totals, key), totals, key);

const relativeSecondDerivativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] =>
  secondDerivativeScale(relativeScale(rows, totals, key), totals, key);

const cumulativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => {
  let cumSum = 0;

  return rows.map((row: Row): Row => {
    cumSum += row[key];

    return {
      ...row,
      [key]: cumSum,
    };
  });
};

const normalizedCumulativeScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => normalizedScale(cumulativeScale(rows, totals, key), totals, key);

const absoluteEntropyScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => {
  const total = getTotalOfRow(rows, key);

  return rows.map((row: Row): Row => {
    const probability = row[key] / total;
    const entropy = probability ? -probability * Math.log2(probability) : 0;

    return {
      ...row,
      [key]: entropy,
    };
  });
};

const relativeEntropyScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => absoluteEntropyScale(relativeScale(rows, totals, key), totals, key);

const absoluteZScoreScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => {
  const average = getTotalOfRow(rows, key) / rows.length;
  const stdDeviation = getStandardDeviation(rows, average, key);

  return rows.map(
    (row: Row): Row => ({
      ...row,
      [key]: (row[key] - average) / stdDeviation,
    }),
  );
};

const relativeZScoreScale: ScalerFn = (
  rows: Row[],
  totals: Row[],
  key: Field,
): Row[] => absoluteZScoreScale(relativeScale(rows, totals, key), totals, key);

export const scaleFunctions: {
  [key: string]: ScalerFn;
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
