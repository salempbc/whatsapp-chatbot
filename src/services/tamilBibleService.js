import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let bibleData = null;

const bookAliases = {
  "1 கொரிந்தியர்": "I கொரிந்தியர்",
  "2 கொரிந்தியர்": "II கொரிந்தியர்",
  "1 தீமோத்தேயு": "I தீமோத்தேயு",
  "2 தீமோத்தேயு": "II தீமோத்தேயு",
  "1 சாமுவேல்": "I சாமுவேல்",
  "2 சாமுவேல்": "II சாமுவேல்",
  "1 இராஜாக்கள்": "I இராஜாக்கள்",
  "2 இராஜாக்கள்": "II இராஜாக்கள்",
  "1 நாளாகமம்": "I நாளாகமம்",
  "2 நாளாகமம்": "II நாளாகமம்",
  "1 தெசலோனிக்கேயர்": "I தெசலோனிக்கேயர்",
  "2 தெசலோனிக்கேயர்": "II தெசலோனிக்கேயர்",
  "1 பேதுரு": "I பேதுரு",
  "2 பேதுரு": "II பேதுரு",
  "1 யோவான்": "I யோவான்",
  "2 யோவான்": "II யோவான்",
  "3 யோவான்": "III யோவான்"
};

/**
 * Initializes and parses Tamil Bible.xml into memory.
 * Runs once lazily (~50ms).
 */
export const loadTamilBible = () => {
  if (bibleData) return bibleData;

  const xmlPath = path.resolve(__dirname, "../../public/Tamil Bible.xml");
  if (!fs.existsSync(xmlPath)) {
    console.warn("⚠️ Tamil Bible.xml not found at", xmlPath);
    return null;
  }

  const xml = fs.readFileSync(xmlPath, "utf8");
  const bible = {};

  const bookRegex = /<BIBLEBOOK [^>]*bnumber="(\d+)"\s+bname="([^"]+)">([\s\S]*?)<\/BIBLEBOOK>/g;
  let bMatch;
  while ((bMatch = bookRegex.exec(xml)) !== null) {
    const bname = bMatch[2].trim();
    const bContent = bMatch[3];
    bible[bname] = {};

    const chRegex = /<CHAPTER [^>]*cnumber="(\d+)">([\s\S]*?)<\/CHAPTER>/g;
    let cMatch;
    while ((cMatch = chRegex.exec(bContent)) !== null) {
      const cnum = parseInt(cMatch[1], 10);
      const cContent = cMatch[2];
      bible[bname][cnum] = {};

      const vRegex = /<VERS [^>]*vnumber="(\d+)">([\s\S]*?)<\/VERS>/g;
      let vMatch;
      while ((vMatch = vRegex.exec(cContent)) !== null) {
        const vnum = parseInt(vMatch[1], 10);
        bible[bname][cnum][vnum] = vMatch[2].trim();
      }
    }
  }

  bibleData = bible;
  return bibleData;
};

/**
 * Retrieves the exact verse text from Tamil Bible.xml.
 * Returns null if reference cannot be found.
 */
export const getVerseFromXML = (ref) => {
  if (!ref) return null;
  const bible = loadTamilBible();
  if (!bible) return null;

  // Handle Psalm 127:3 canonical child verse mapping
  if (ref.startsWith("சங்கீதம் 127:3") || ref.startsWith("சங்கீதம் 127:4")) {
    const text = bible["சங்கீதம்"]?.[127]?.[4] || bible["சங்கீதம்"]?.[127]?.[3];
    if (text) return text;
  }

  const m = ref.match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return null;

  let [, book, chStr, vStartStr, vEndStr] = m;
  book = book.trim();
  const xmlBook = bookAliases[book] || book;
  const ch = parseInt(chStr, 10);
  const vStart = parseInt(vStartStr, 10);
  const vEnd = vEndStr ? parseInt(vEndStr, 10) : vStart;

  if (!bible[xmlBook] || !bible[xmlBook][ch]) return null;

  const parts = [];
  for (let v = vStart; v <= vEnd; v++) {
    const text = bible[xmlBook][ch][v];
    if (text) parts.push(text);
  }

  return parts.length ? parts.join(" ") : null;
};
