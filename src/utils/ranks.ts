import type { Rank } from "@utils/sqlite";
import { isUCSUR } from "@utils/other";
import { getLinkuCategories } from "@utils/linku";

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

  // const wordData = document.createElement("td");
  const word = truncateWord(item.term);
  // wordData.textContent = word;
  // tableRow.appendChild(wordData);
  // wordData.classList.add("wordData");

  const barData = document.createElement("td");
  const barDiv = document.createElement("div");
  barDiv.textContent = word;
  barDiv.style.width = `${calcWidth(maxOccurrences, item.occurrences) * 100}%`;
  barData.classList.add("barData");

  await assignWordClasses(item, phraseLen, barDiv);
  // await assignWordClasses(item, phraseLen, wordData);
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
