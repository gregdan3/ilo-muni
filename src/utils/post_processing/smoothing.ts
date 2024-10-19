import type { Row } from "@utils/sqlite.ts";

export const smootherFunctions: {
  [key: string]: (rows: Row[], smoothing: number) => Row[];
} = {
  cwin: smoothCenterWindowAvg,
  exp: smoothExponential,
  gauss: smoothGaussian,
  med: smoothMedian,
  tri: (rows, smoothing) => {
    return smoothCenterWindowAvg(
      smoothCenterWindowAvg(rows, smoothing),
      smoothing,
    );
  },
};

function smoothCenterWindowAvg(rows: Row[], smoothing: number): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;

  let firstNonZero = 0;
  while (firstNonZero < len && rows[firstNonZero].hits === 0) {
    smoothed[firstNonZero].hits = 0;
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
      sum += rows[j].hits;
      count++;
    }

    smoothed[i].hits = sum / count;
  }

  return smoothed;
}

function smoothExponential(rows: Row[], smoothing: number): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));

  // 0 < alpha < 1 (well, <= 1)
  // Zero smoothing implies an alpha of 1, which actually doesn't do any smoothing!
  // So we don't even need any special case handling, which is very cool
  const alpha = 1 / (smoothing + 1);

  for (let i = 1; i < rows.length; i++) {
    smoothed[i].hits =
      alpha * rows[i].hits + (1 - alpha) * smoothed[i - 1].hits;
  }
  return smoothed;
}

function smoothGaussian(rows: Row[], smoothing: number): Row[] {
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
        sum += rows[index].hits * weight;
        kernelSum += weight;
      }
    }

    smoothed[i].hits = sum / kernelSum;
  }

  return smoothed;
}

function smoothMedian(rows: Row[], smoothing: number): Row[] {
  const smoothed: Row[] = rows.map((row: Row): Row => ({ ...row }));
  const len = rows.length;

  for (let i = 0; i < len; i++) {
    const window: number[] = [];
    for (
      let j = Math.max(0, i - smoothing);
      j <= Math.min(len - 1, i + smoothing);
      j++
    ) {
      window.push(rows[j].hits);
    }
    window.sort((a, b) => a - b);
    smoothed[i].hits = window[Math.floor(window.length / 2)];
  }

  return smoothed;
}
