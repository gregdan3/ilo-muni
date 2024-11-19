import type { Row, Field } from "@utils/types.ts";

type SmootherFn = (rows: Row[], smoothing: number, key: Field) => Row[];

function smoothCenterWindowAvg(
  rows: Row[],
  smoothing: number,
  key: Field,
): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;

  let firstNonZero = 0;
  while (firstNonZero < len && rows[firstNonZero][key] === 0) {
    smoothed[firstNonZero][key] = 0;
    firstNonZero += 1;
    continue;
  }

  for (let i = firstNonZero; i < len; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - smoothing);
      j <= Math.min(len - 1, i + smoothing);
      j++
    ) {
      sum += rows[j][key];
      count++;
    }

    smoothed[i][key] = sum / count;
  }

  return smoothed;
}

function smoothExponential(rows: Row[], smoothing: number, key: Field): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));

  // 0 < alpha < 1 (well, <= 1)
  // Zero smoothing implies an alpha of 1, which actually doesn't do any smoothing!
  // So we don't even need any special case handling, which is very cool
  const alpha = 1 / (smoothing + 1);

  for (let i = 1; i < rows.length; i++) {
    smoothed[i][key] =
      alpha * rows[i][key] + (1 - alpha) * smoothed[i - 1][key];
  }
  return smoothed;
}

function smoothGaussian(rows: Row[], smoothing: number, key: Field): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;
  const kernelSize = smoothing * 2 + 1;
  const sigma = smoothing / 2;
  const gaussianKernel = Array.from({ length: kernelSize }, (_, i) => {
    const x = i - smoothing;
    return (
      Math.exp(-(x * x) / (2 * sigma * sigma)) /
      (sigma * Math.sqrt(2 * Math.PI))
    );
  });

  for (let i = 0; i < len; i++) {
    let sum = 0;
    let kernelSum = 0;

    for (let j = -smoothing; j <= smoothing; j++) {
      const index = i + j;
      if (index >= 0 && index < len) {
        const weight = gaussianKernel[j + smoothing];
        sum += rows[index][key] * weight;
        kernelSum += weight;
      }
    }

    smoothed[i][key] = sum / kernelSum;
  }

  return smoothed;
}

function smoothMedian(rows: Row[], smoothing: number, key: Field): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;

  for (let i = 0; i < len; i++) {
    const window: number[] = [];
    for (
      let j = Math.max(0, i - smoothing);
      j <= Math.min(len - 1, i + smoothing);
      j++
    ) {
      window.push(rows[j][key]);
    }
    window.sort((a, b) => a - b);
    smoothed[i][key] = window[Math.floor(window.length / 2)];
  }

  return smoothed;
}

export const smootherFunctions: {
  [key: string]: SmootherFn;
} = {
  cwin: smoothCenterWindowAvg,
  exp: smoothExponential,
  gauss: smoothGaussian,
  med: smoothMedian,
  tri: (rows, smoothing, key) => {
    return smoothCenterWindowAvg(
      smoothCenterWindowAvg(rows, smoothing, key),
      smoothing,
      key,
    );
  },
};
