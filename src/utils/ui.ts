import { SAMPLE_SEARCHES } from "@utils/constants";
import { randomElem } from "@utils/other";

export function randomQuery(): string {
  return randomElem(SAMPLE_SEARCHES);
}

export async function copyUrlToClipboard() {
  const url = window.location.href;

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(url);
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = url;
    textArea.style.position = "absolute";
    textArea.style.left = "-9999px";
    document.body.prepend(textArea);

    try {
      textArea.select();
      document.execCommand("copy");
    } catch (error) {
      console.error(error);
    } finally {
      textArea.remove();
    }
  }
}

export function formatInteger(n: number): string {
  const suffixes = ["", "K", "M", "B", "T"];
  const tier = (Math.log10(Math.abs(n)) / 3) | 0;

  if (tier <= 0) return n.toString();

  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = n / scale;

  return scaled.toFixed(1).replace(/\.0$/, "") + suffix;
}

export function formatRaw(n: number): string {
  return n.toString();
}

export function formatPercentage(n: number, sigDigits: number = 2): string {
  if (n === 0) return "0%";

  n *= 100;

  const absValue = Math.abs(n);
  const magnitude = Math.floor(Math.log10(absValue));
  const scale = Math.pow(10, magnitude - sigDigits + 1);

  const rounded = Math.round(n / scale) * scale;

  const formatted = rounded.toPrecision(sigDigits);

  return parseFloat(formatted).toString() + "%";
}

export const FORMATTERS = {
  raw: formatRaw,
  percent: (n: number) => formatPercentage(n, 2),
  rawPercent: (n: number) => formatPercentage(n, 5),
  int: formatInteger,
} as const;
