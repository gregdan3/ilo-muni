import type { Rank } from "@utils/sqlite";
import { isUCSUR } from "@utils/other";
import { getLinkuCategories } from "@utils/linku";

const colorMap: { [key: string]: string } = {
  core: "palegoldenrod",
  common: "skyblue",
  uncommon: "palevioletred",
  obscure: "mediumpurple",
  sandbox: "lightgray",
  ucsur: "lightgreen",
  unknown: "white",
};

function calcWidth(maxOccurrences: number, thisOccurrences: number): number {
  // neither value can be 0
  const adjustedThisOccurrences = Math.log(thisOccurrences);
  const adjustedMaxOccurrences = Math.log(maxOccurrences);

  return adjustedThisOccurrences / adjustedMaxOccurrences;
  // return thisOccurrences / maxOccurrences;
}

function truncateWord(word: string, maxLength: number = 40): string {
  if (word.length > maxLength) {
    return word.slice(0, maxLength - 2) + "...";
  }

  return word;
}

async function makeGradient(phrase: string) {
  // make a linear gradient with sharp cutoffs out of a list of words
  const words = phrase.split(/\s+/);
  const gradientStops: string[] = [];
  const totalWords = words.length;

  for (let i = 0; i < totalWords; i++) {
    const word = words[i];
    const classes = await getLinkuCategories(word);
    let colorClass = classes.find((cls) =>
      Object.prototype.hasOwnProperty.call(colorMap, cls),
    )!;
    if (isUCSUR(word)) {
      colorClass = "ucsur";
    }

    const color = colorMap[colorClass];

    const startPercent = (i / totalWords) * 100;
    const endPercent = ((i + 1) / totalWords) * 100;
    gradientStops.push(`${color} ${startPercent}%, ${color} ${endPercent}%`);
  }

  const gradient = `linear-gradient(to right, ${gradientStops.join(", ")})`;
  return gradient;
}

async function assignWordClasses(
  item: Rank,
  phraseLen: number,
  elem: HTMLElement,
) {
  if (isUCSUR(item.term)) {
    elem.classList.add("ucsur");
  }

  if (phraseLen === 1) {
    const classes = await getLinkuCategories(item.term);
    elem.classList.add(...classes);
  }
}

async function makeDivEntry(
  item: Rank,
  index: number,
  maxOccurrences: number,
  phraseLen: number,
): Promise<HTMLDivElement> {
  const rankItem = document.createElement("div");
  rankItem.classList.add("rankItem");

  const rankText = document.createElement("span");
  const word = truncateWord(item.term);
  rankText.textContent = `${index + 1}. ${word}: ${item.occurrences}`;

  const rankBar = document.createElement("span");
  rankBar.style.width = `${calcWidth(maxOccurrences, item.occurrences) * 60}%`;
  rankBar.classList.add("rankBar");

  await assignWordClasses(item, phraseLen, rankBar);

  rankItem.appendChild(rankText);
  rankItem.appendChild(rankBar);

  return rankItem;
}

async function makeTableEntry(
  item: Rank,
  index: number,
  maxOccurrences: number,
  phraseLen: number,
): Promise<HTMLTableRowElement> {
  const tableRow = document.createElement("tr");

  const rankData = document.createElement("td");
  rankData.textContent = `${index + 1}.`;
  tableRow.appendChild(rankData);
  rankData.classList.add("rankData");

  const occurrenceData = document.createElement("td");
  occurrenceData.textContent = item.occurrences.toString();
  tableRow.appendChild(occurrenceData);
  occurrenceData.classList.add("occurrenceData");

  const word = truncateWord(item.term);

  const barData = document.createElement("td");
  const barDiv = document.createElement("div");
  barDiv.textContent = word;
  barDiv.style.width = `${calcWidth(maxOccurrences, item.occurrences) * 100}%`;
  barData.classList.add("barData");
  barDiv.style.background = await makeGradient(item.term);

  await assignWordClasses(item, phraseLen, barDiv);
  barData.appendChild(barDiv);
  tableRow.appendChild(barData);

  return tableRow;
}

export async function reloadBarChart(
  div: HTMLDivElement,
  results: Rank[],
  phraseLen: number,
) {
  div.innerHTML = "";

  const rankTable = document.createElement("table");
  rankTable.style.width = `100%`;
  div.appendChild(rankTable);

  const maxOccurrences = results[0].occurrences;
  results.forEach(async (item, index: number) => {
    // const rankItem = await makeDivEntry(item, index, maxOccurrences, phraseLen);
    // div.appendChild(rankItem);
    const tableRow = await makeTableEntry(
      item,
      index,
      maxOccurrences,
      phraseLen,
    );
    rankTable.append(tableRow);
  });
}
