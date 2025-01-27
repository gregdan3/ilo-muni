import { UCSUR_RE } from "@utils/constants";
import {
  EARLIEST_TIMESTAMP,
  LATEST_TIMESTAMP,
  MAX_LABEL_LEN,
} from "@utils/constants";

export function randomElem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function isValidTimestamp(timestamp: string | null): boolean {
  // TODO: it also needs to be one of the selectable timestamps, not just any in range
  if (!timestamp) {
    return false;
  }

  const parsedTimestamp = parseInt(timestamp, 10);
  if (parsedTimestamp < EARLIEST_TIMESTAMP) {
    return false;
  }
  if (parsedTimestamp > LATEST_TIMESTAMP) {
    return false;
  }
  return true;
}

export function makeAugust(year: number) {
  return new Date(Date.UTC(year, 7, 1));
}

export function isUCSUR(s: string): boolean {
  return UCSUR_RE.test(s);
}

export function countSubstring(toSearch: string, substring: string): number {
  if (substring.length === 0) {
    return 0; // Edge case: empty substring should return 0
  }

  let count = 0;
  let pos = toSearch.indexOf(substring);

  while (pos !== -1) {
    count++;
    pos = toSearch.indexOf(substring, pos + substring.length);
  }

  return count;
}

export function truncateLabel(
  label: string,
  maxLen: number = MAX_LABEL_LEN,
): string {
  return label.length > maxLen ? label.slice(0, maxLen - 2) + "..." : label;
}
