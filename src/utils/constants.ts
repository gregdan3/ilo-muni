import { makeAugust } from "@utils/other";

export const BASE_URL = "/ilo-muni";
export const DB_URL_PREFIX = `${BASE_URL}/db/tp.`;
// export const DB_URL = `https://gregdan3.com/sqlite/2024-08-08-trimmed.sqlite`;

// these consts are just to build the important regexes
const ucsurRanges = "\u{F1900}-\u{F1977}\u{F1978}-\u{F1988}\u{F19A0}-\u{F19A3}";
const symTokens = "+\\-*/()";

export const PHRASE_DELIMS_RE = new RegExp(
  `\\s+|([${ucsurRanges}${symTokens}])`,
  "u",
);

// wildcard can make up a phrase, but the other syms cannot
export const PHRASE_RE = new RegExp(
  `^[a-z0-9* ${ucsurRanges}]+(?:_\\d)?$`,
  "u",
);
export const UCSUR_RE = new RegExp(`^[${ucsurRanges}]$`, "u");

// TODO: fetch from db at init? would make it not so much a constant
export const EARLIEST_YEAR = 2010;
// NOTE: the data goes back to 2010 but there is almost nothing there
// export const EARLIEST_YEAR = 2010;
export const LATEST_YEAR = 2024;

export const EARLIEST_TIMESTAMP = makeAugust(EARLIEST_YEAR).getTime() / 1000;
export const LATEST_TIMESTAMP = makeAugust(LATEST_YEAR).getTime() / 1000;

// start of june 1 in epoch time
// avoids the fact that july is incomplete in my dataset
// no equivalent EARLIEST because i can hand-pick a specific August that is acceptable
export const LATEST_ALLOWED_TIMESTAMP = 1719792000;

// absolutes should be preserved
// derivatives are impervious to smoothing
export const SCALES = {
  abs: { name: "Absolute", category: "simple", smoothable: false },
  rel: { name: "Relative", category: "simple", smoothable: true },
  cmsum: { name: "Cumulative", category: "simple", smoothable: false },
  logrel: { name: "Relative Log", category: "useful", smoothable: true },
  normrel: { name: "Relative Minmax", category: "useful", smoothable: true },
  normabs: { name: "Absolute Minmax", category: "useful", smoothable: false },
  logabs: {
    name: "Absolute Log",
    category: "weird or dupe",
    smoothable: false,
  },
  relentropy: {
    name: "Relative Entropy",
    category: "weird or dupe",
    smoothable: true,
  },
  entropy: {
    name: "Absolute Entropy",
    category: "weird or dupe",
    smoothable: true,
  },
  zscore: {
    name: "Relative Z-Score",
    category: "weird or dupe",
    smoothable: true,
  },
  deriv1: {
    name: "Absolute 1st Deriv",
    category: "weird or dupe",
    smoothable: false,
  },
  // deriv2: {
  //   name: "2nd Deriv Absolute",
  //   category: "weird or dupe",
  //   smoothable: false,
  // },
  relderiv1: {
    name: "Relative 1st Deriv",
    category: "weird or dupe",
    smoothable: false,
  },
  // relderiv2: {
  //   name: "2nd Deriv Relative",
  //   category: "weird or dupe",
  //   smoothable: false,
  // },
};

export const SMOOTHERS = {
  cwin: { name: "Centered Window", category: "simple" },
  exp: { name: "Exponential", category: "simple" },
  gauss: { name: "Gaussian", category: "simple" },
  med: { name: "Median", category: "simple" },
};
