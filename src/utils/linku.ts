import { Words } from "@kulupu-linku/sona";

const LINKU = "https://api.linku.la/v1/words?lang=en";
const SANDBOX = "https://api.linku.la/v1/sandbox?lang=en";

let dataPromise: Promise<Words> | null = null;

function loadLinkuJSON(jsonObj: string): Words {
  return JSON.parse(jsonObj);
}

async function fetchLinku() {
  let linkuWords, sandboxWords;
  try {
    const linkuData = await fetch(LINKU);
    linkuWords = loadLinkuJSON(await linkuData.text());
  } catch {
    linkuWords = {} as Words;
  }

  try {
    const sandboxData = await fetch(SANDBOX);
    sandboxWords = loadLinkuJSON(await sandboxData.text());
  } catch {
    sandboxWords = {} as Words;
  }

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
  } else {
    classes.push("unknown");
  }

  return classes;
}
