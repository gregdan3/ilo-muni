import { UCSUR_RE } from "@utils/constants";

export function makeAugust(year: number) {
  return new Date(Date.UTC(year, 7, 1));
}

export function isUCSUR(s: string): boolean {
  return UCSUR_RE.test(s);
}
