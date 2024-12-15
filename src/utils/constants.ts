import { makeAugust } from "@utils/other";

export const BASE_URL = "/ilo-muni";
export const DB_URL_PREFIX = `${BASE_URL}/db/tp.`;

// these consts are just to build the important regexes
const ucsurRanges = "\u{F1900}-\u{F1977}\u{F1978}-\u{F1988}\u{F19A0}-\u{F19A3}";
const symTokens = "+\\-*/()";

export const TERM_DELIMS_RE = new RegExp(
  `\\s+|([${ucsurRanges}${symTokens}])`,
  "u",
);

// wildcard can make up a term, but the other syms cannot
export const TERM_RE = new RegExp(`^[a-z0-9* ${ucsurRanges}]+(?:_\\d)?$`, "u");
export const UCSUR_RE = new RegExp(`^[${ucsurRanges}]$`, "u");

// TODO: fetch from db at init? would make it not so much a constant
export const EARLIEST_YEAR = 2001;
// NOTE: the data goes back to 2010 but there is almost nothing there
// export const EARLIEST_YEAR = 2010;
export const LATEST_YEAR = 2024;

export const EARLIEST_TIMESTAMP = makeAugust(EARLIEST_YEAR).getTime() / 1000;
export const LATEST_TIMESTAMP = makeAugust(LATEST_YEAR).getTime() / 1000;

// start of june 1 in epoch time
// avoids the fact that july is incomplete in my dataset
// no equivalent EARLIEST because i can hand-pick a specific August that is acceptable
export const LATEST_ALLOWED_TIMESTAMP = 1720569600; // 10 jul 2024 -> 7 aug 2024

export const defaultScale = "rel";
export const defaultSmoother = "cwin";
export const defaultSmoothing = "2";
export const defaultField = "hits";

export const LENGTHS = ["1", "2", "3", "4", "5", "6"];
export const SMOOTHINGS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "20",
  "30",
  "40",
  "50",
];

export const FIELDS = {
  hits: { label: "Hits", category: "data", summable: true },
  authors: { label: "Authors", category: "data", summable: false },
  hpa: { label: "Hits/Author", category: "data", summable: false },
};

export const SAMPLE_SEARCHES = [
  // duh
  "toki, pona, toki pona",
  "sitelen, pona, sitelen pona",
  // term trends
  "tomo tawa, ilo tawa",
  "sina seme, sina pilin seme, sina pali e seme",
  "kepeken ilo, kepeken e ilo",
  // synonyms
  "ale, ali, ale + ali",
  "lukin, oko, lukin + oko",
  // word groups
  "laso, loje, walo, jelo, pimeja",
  "soweli, waso, kala, akesi, pipi",
  "mi, ni, sina, ona",
  "li, e, la, pi",
  "pona, ike",
  "mu, kalama",
  "sinpin, monsi",
  "kasi, soko",
  "anpa, noka",
  "sewi, anpa",
  "sewi, lawa",
  "meli, mije, tonsi",
  "mute, wawa, sewi",
  "pu, ku, su",
  "sin, namako",
  "selo, sijelo",
  "noka, luka",
  "noka, anpa",
  "lawa, sewi",
  // phrase groups
  "pali e, lon e",
  "li seme, e seme, la seme",
  "seme li, seme e, seme la",
  "lon seme, tan seme, nasin seme, tenpo seme",
  "lon seme, ma seme",
  "kin la, poka la, sama la",
  "sona e toki, toki e toki, sona toki, toki sona",
  // modifier usage
  "mi wan, mi mute, mi ale",
  "sina wan, sina mute, sina ale",
  "wawa a, wawa mute, wawa sewi",
  "tenpo ni, tenpo lon",
  "tenpo weka, tenpo pini",
  "tenpo kama, tenpo pini",
  "tenpo weka, tenpo poka",
  "tenpo suno, tenpo pimeja",
  "tenpo suli, tenpo lili",
  // grammatical things
  // names
  "jan kekan, mun kekan",
  "epanja, kanse, tosi",
  "sonja, jan sonja",
  //langs + places
  "toki inli, ma inli",
  "toki sonko, ma sonko",
  "toki kanse, ma kanse",
  "toki epanja, ma epanja",
  "toki tosi, ma tosi",
  // alternate spellings
  "ma mesiko, ma mekiko",
  "ma losi, ma lusi",
  // disambiguation
  "san - kekan san",
  "inli - toki inli, epanja - toki epanja",
  "toki_1 - toki_2, pona_1 - pona_2",
  // correlations
  "ku, kijetesantakalu, epiku, misikeke",
  // periodic terms
  "suno pi toki pona",
  "tenpo monsuta",
  "tenpo pana, tenpo santa, tenpo sike sin",
  "tenpo lete, tenpo seli",
  // messages
  "ni kin li, sona kiwen",
];

// absolutes should be preserved
// derivatives are impervious to smoothing
export const SCALES = {
  abs: {
    label: "Absolute",
    category: "simple",
    smoothable: false,
    sums: false,
    axis: "linear",
    axisNums: "int", // truncated by thousands
    tooltipNums: "raw",
  },
  rel: {
    label: "Relative",
    category: "simple",
    smoothable: true,
    sums: false,
    axis: "linear",
    axisNums: "percent", // truncated to 2 significant digits
    tooltipNums: "longPercent", // truncated to 5 significant digits
  },
  cmsum: {
    label: "Cumulative",
    category: "simple",
    smoothable: false,
    sums: true,
    axis: "linear",
    axisNums: "int",
    tooltipNums: "raw",
  },
  logabs: {
    label: "Abs. Log",
    category: "useful",
    smoothable: false,
    sums: false,
    axis: "logarithmic",
    axisNums: "int",
    tooltipNums: "raw",
  },
  logrel: {
    label: "Rel. Log",
    category: "useful",
    smoothable: true,
    sums: false,
    axis: "logarithmic",
    axisNums: "percent",
    tooltipNums: "longPercent",
  },
  logcm: {
    label: "Cml. Log",
    category: "useful",
    smoothable: false,
    sums: true,
    axis: "logarithmic",
    axisNums: "int",
    tooltipNums: "raw",
  },
  normabs: {
    label: "Abs. Minmax",
    category: "useful",
    smoothable: false,
    sums: false,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "longRaw",
  },
  normrel: {
    label: "Rel. Minmax",
    category: "useful",
    smoothable: true,
    sums: false,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "longRaw",
  },
  normcm: {
    label: "Cml. Minmax",
    category: "useful",
    smoothable: false,
    sums: true,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "longRaw",
  },
  entropy: {
    label: "Abs. Entropy",
    category: "weird",
    smoothable: true,
    sums: false,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "raw",
  },
  relentropy: {
    label: "Rel. Entropy",
    category: "weird",
    smoothable: true,
    sums: false,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "raw",
  },
  deriv1: {
    label: "Abs. 1st Deriv",
    category: "weird",
    smoothable: false,
    sums: false,
    axis: "linear",
    axisNums: "int",
    tooltipNums: "raw",
  },
  // deriv2: {
  //   label: "2nd Deriv Absolute",
  //   category: "weird",
  //   smoothable: false,
  //   sums: false  ,
  //   axis: "linear",
  //   axisNums: "int",
  //   tooltipNums: "raw",
  // },
  relderiv1: {
    label: "Rel. 1st Deriv",
    category: "weird",
    smoothable: false,
    sums: false,
    axis: "linear",
    axisNums: "percent",
    tooltipNums: "longPercent",
  },
  // relderiv2: {
  //   label: "2nd Deriv Relative",
  //   category: "weird",
  //   smoothable: false,
  //   sums: false  ,
  //   axis: "linear",
  //   axisNums: "percent",
  //   tooltipNums: "longPercent",
  // },
  zscore: {
    label: "Rel. Z-Score",
    category: "weird",
    smoothable: true,
    sums: false,
    axis: "linear",
    axisNums: "raw",
    tooltipNums: "raw",
  },
} as const;

export const SMOOTHERS = {
  cwin: { label: "Window Avg", category: "recommended" },
  exp: { label: "Exponential", category: "weird" },
  gauss: { label: "Gaussian", category: "weird" },
  med: { label: "Median", category: "weird" },
  tri: { label: "Triangular", category: "weird" },
};
