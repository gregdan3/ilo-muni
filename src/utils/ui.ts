import { SAMPLE_SEARCHES } from "@utils/constants";
import { randomElem } from "@utils/other";

export function randomQuery(): string {
  return randomElem(SAMPLE_SEARCHES);
}

export async function copyUrlToClipboard(): Promise<string> {
  try {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    return "URL copied to clipboard!";
  } catch (err) {
    return `Failed to copy URL: ${err}`;
  }
}
