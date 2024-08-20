import { SAMPLE_SEARCHES } from "@utils/constants";
import { randomElem } from "@utils/other";

export function randomQuery(): string {
  return randomElem(SAMPLE_SEARCHES);
}
