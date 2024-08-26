import type { Row } from "@utils/sqlite.ts";
import type { Axis } from "@utils/types.ts";

type AbsoluteScaler = (rows: Row[]) => Row[];
type RelativeScaler = (rows: Row[], totals: Row[]) => Row[];
type Scaler = AbsoluteScaler | RelativeScaler;

const getTotalOccurrences = (rows: Row[]): number =>
  rows.reduce((sum, row) => sum + row.occurrences, 0);

const getStandardDeviation = (rows: Row[], mean: number): number => {
  const powerSum = rows.reduce((sum, row) => {
    const deviation = row.occurrences - mean;
    return sum + deviation * deviation;
  }, 0);

  const variance = powerSum / rows.length;
  return Math.sqrt(variance);
};

const absoluteScale: AbsoluteScaler = (rows: Row[]) => rows;

const relativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  rows.map((row: Row, i: number) => {
    const total = totals[i].occurrences;
    const occurrences = total > 0 ? row.occurrences / total : 0;

    return {
      ...row,
      occurrences,
    };
  });

const logarithmicAbsoluteScale: AbsoluteScaler = (rows: Row[]) =>
  rows.map((row: Row) => ({
    ...row,
    occurrences: Math.log(row.occurrences + 1),
  }));

const logarithmicRelativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  relativeScale(
    logarithmicAbsoluteScale(rows),
    logarithmicAbsoluteScale(totals),
  );

const normalizedScale: AbsoluteScaler = (rows: Row[]) => {
  const min = Math.min(...rows.map((row) => row.occurrences));
  const max = Math.max(...rows.map((row) => row.occurrences));

  if (min === max) {
    return rows.map((row: Row) => ({ ...row, occurrences: 0 }));
  }

  return rows.map((row: Row) => ({
    ...row,
    occurrences: (row.occurrences - min) / (max - min),
  }));
};

const normalizedRelativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  normalizedScale(relativeScale(rows, totals));

const absoluteDerivativeScale: AbsoluteScaler = (rows: Row[]) =>
  rows.map((row, i) => {
    const diff = i > 0 ? row.occurrences - rows[i - 1].occurrences : 0;

    return {
      ...row,
      occurrences: diff,
    };
  });

const absoluteSecondDerivativeScale: AbsoluteScaler = (rows: Row[]) =>
  absoluteDerivativeScale(absoluteDerivativeScale(rows));

const relativeDerivativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  absoluteDerivativeScale(relativeScale(rows, totals));

const relativeSecondDerivativeScale: RelativeScaler = (
  rows: Row[],
  totals: Row[],
) => absoluteSecondDerivativeScale(relativeScale(rows, totals));

const cumulativeScale: AbsoluteScaler = (rows: Row[]) => {
  let cumSum = 0;

  return rows.map((row) => {
    cumSum += row.occurrences;

    return {
      ...row,
      occurrences: cumSum,
    };
  });
};

const normalizedCumulativeScale: AbsoluteScaler = (rows: Row[]) =>
  normalizedScale(cumulativeScale(rows));

const absoluteEntropyScale: AbsoluteScaler = (rows: Row[]) => {
  const totalOccurrences = getTotalOccurrences(rows);

  return rows.map((row) => {
    const probability = row.occurrences / totalOccurrences;
    const entropy = probability ? -probability * Math.log2(probability) : 0;

    return {
      ...row,
      occurrences: entropy,
    };
  });
};

const relativeEntropyScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  absoluteEntropyScale(relativeScale(rows, totals));

const absoluteZScoreScale: AbsoluteScaler = (rows: Row[]) => {
  const average = getTotalOccurrences(rows) / rows.length;
  const stdDeviation = getStandardDeviation(rows, average);

  return rows.map((row: Row) => ({
    ...row,
    occurrences: (row.occurrences - average) / stdDeviation,
  }));
};

const relativeZScoreScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  absoluteZScoreScale(relativeScale(rows, totals));

export const scaleFunctions: {
  [key: string]: Scaler;
} = {
  abs: absoluteScale,
  rel: relativeScale,
  logabs: absoluteScale,
  logrel: relativeScale,
  normabs: normalizedScale,
  normrel: normalizedRelativeScale,
  deriv1: absoluteDerivativeScale,
  deriv2: absoluteSecondDerivativeScale,
  relderiv1: relativeDerivativeScale,
  relderiv2: relativeSecondDerivativeScale,
  cmsum: cumulativeScale,
  logcm: cumulativeScale,
  normcm: normalizedCumulativeScale,
  entropy: absoluteEntropyScale,
  relentropy: relativeEntropyScale,
  zscore: relativeZScoreScale,
};

export const axes: { [key: string]: Axis } = {
  abs: "linear",
  rel: "linear",
  logabs: "logarithmic",
  logrel: "logarithmic",
  normabs: "linear",
  normrel: "linear",
  deriv1: "linear",
  deriv2: "linear",
  relderiv1: "linear",
  relderiv2: "linear",
  cmsum: "linear",
  normcm: "linear",
  logcm: "logarithmic",
  entropy: "linear",
  relentropy: "linear",
  zscore: "linear",
};
