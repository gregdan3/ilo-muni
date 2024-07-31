import { Words } from "@kulupu-linku/sona";
import { consoleLogAsync } from "./debug";

const LINKU = "https://api.linku.la/v1/words?lang=en";
const SANDBOX = "https://api.linku.la/v1/sandbox?lang=en";

let dataPromise: Promise<Words> | null = null;

function loadLinkuJSON(jsonObj: string): Words {
  return JSON.parse(jsonObj);
}

async function fetchLinku() {
  const linkuData = await fetch(LINKU);
  const linkuWords = loadLinkuJSON(await linkuData.text());

  const sandboxData = await fetch(SANDBOX);
  const sandboxWords = loadLinkuJSON(await sandboxData.text());

  const merged = { ...linkuWords, ...sandboxWords };
  return merged;
}

export async function getLinkuCategories(word: string) {
  if (!dataPromise) {
    dataPromise = fetchLinku();
  }
  const data = await dataPromise;

  const classes = [];

  if (Object.prototype.hasOwnProperty.call(data, word)) {
    // TODO: what about duplicate words?
    const book = data[word].book.replace(/\s+/g, "-");
    const category = data[word].usage_category;
    classes.push(book, category);
  }

  return classes;
}
