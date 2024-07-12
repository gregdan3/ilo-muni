function cleanAndSplit(input: string, delimiter: string): string[] {
  return input
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export function inputToPhrases(input: string): string[][] {
  input = input.toLowerCase();
  const phrases = cleanAndSplit(input, ",");
  const uniquePhrases = Array.from(new Set(phrases));
  const phraseGroups = uniquePhrases.map((phrase) =>
    cleanAndSplit(phrase, "+"),
  );
  return phraseGroups.slice(0, 20);
}
