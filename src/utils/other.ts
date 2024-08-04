import { UCSUR_RE } from "@utils/constants";

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
