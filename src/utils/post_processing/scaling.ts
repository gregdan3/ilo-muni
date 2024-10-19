import type { Row } from "@utils/sqlite.ts";
import type { Axis } from "@utils/types.ts";

type AbsoluteScaler = (rows: Row[]) => Row[];
type RelativeScaler = (rows: Row[], totals: Row[]) => Row[];
type Scaler = AbsoluteScaler | RelativeScaler;

const getTotalHits = (rows: Row[]): number =>
  rows.reduce((sum, row) => sum + row.hits, 0);

const getStandardDeviation = (rows: Row[], mean: number): number => {
  const powerSum = rows.reduce((sum, row) => {
    const deviation = row.hits - mean;
    return sum + deviation * deviation;
  }, 0);

  const variance = powerSum / rows.length;
  return Math.sqrt(variance);
};

const absoluteScale: AbsoluteScaler = (rows: Row[]) => rows;

const relativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  rows.map((row: Row, i: number) => {
    const total = totals[i].hits;
    const hits = total > 0 ? row.hits / total : 0;

    return {
      ...row,
      hits,
    };
  });

const logarithmicAbsoluteScale: AbsoluteScaler = (rows: Row[]) =>
  rows.map((row: Row) => ({
    ...row,
    hits: Math.log(row.hits + 1),
  }));

const logarithmicRelativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  relativeScale(
    logarithmicAbsoluteScale(rows),
    logarithmicAbsoluteScale(totals),
  );

const normalizedScale: AbsoluteScaler = (rows: Row[]) => {
  const min = Math.min(...rows.map((row) => row.hits));
  const max = Math.max(...rows.map((row) => row.hits));

  if (min === max) {
    return rows.map((row: Row) => ({ ...row, hits: 0 }));
  }

  return rows.map((row: Row) => ({
    ...row,
    hits: (row.hits - min) / (max - min),
  }));
};

const normalizedRelativeScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  normalizedScale(relativeScale(rows, totals));

const absoluteDerivativeScale: AbsoluteScaler = (rows: Row[]) =>
  rows.map((row, i) => {
    const diff = i > 0 ? row.hits - rows[i - 1].hits : 0;

    return {
      ...row,
      hits: diff,
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
    cumSum += row.hits;

    return {
      ...row,
      hits: cumSum,
    };
  });
};

const normalizedCumulativeScale: AbsoluteScaler = (rows: Row[]) =>
  normalizedScale(cumulativeScale(rows));

const absoluteEntropyScale: AbsoluteScaler = (rows: Row[]) => {
  const totalHits = getTotalHits(rows);

  return rows.map((row) => {
    const probability = row.hits / totalHits;
    const entropy = probability ? -probability * Math.log2(probability) : 0;

    return {
      ...row,
      hits: entropy,
    };
  });
};

const relativeEntropyScale: RelativeScaler = (rows: Row[], totals: Row[]) =>
  absoluteEntropyScale(relativeScale(rows, totals));

const absoluteZScoreScale: AbsoluteScaler = (rows: Row[]) => {
  const average = getTotalHits(rows) / rows.length;
  const stdDeviation = getStandardDeviation(rows, average);

  return rows.map((row: Row) => ({
    ...row,
    hits: (row.hits - average) / stdDeviation,
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
