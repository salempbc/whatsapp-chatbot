import { adminOnly } from "../guard.js";
import EventVerse from "../../models/EventVerse.js";
﻿import Bible from "../../models/Bible.js";

const bibleAliases = {
  "genesis": 1, "gen": 1, "ge": 1, "gn": 1, "exodus": 2, "exo": 2, "ex": 2, "leviticus": 3, "lev": 3, "le": 3, "lv": 3,
  "numbers": 4, "num": 4, "nu": 4, "nm": 4, "deuteronomy": 5, "deut": 5, "de": 5, "dt": 5,
  "joshua": 6, "josh": 6, "jos": 6, "judges": 7, "judg": 7, "jdg": 7, "jg": 7, "ruth": 8, "rut": 8, "ru": 8,
  "1 samuel": 9, "1 sam": 9, "1sam": 9, "1 sa": 9, "1sa": 9, "1sm": 9, "1 sm": 9, "2 samuel": 10, "2 sam": 10, "2sam": 10, "2 sa": 10, "2sa": 10, "2sm": 10, "2 sm": 10,
  "1 kings": 11, "1 kgs": 11, "1kgs": 11, "1 ki": 11, "1ki": 11, "2 kings": 12, "2 kgs": 12, "2kgs": 12, "2 ki": 12, "2ki": 12,
  "1 chronicles": 13, "1 chron": 13, "1 chr": 13, "1chr": 13, "1 ch": 13, "1ch": 13, "2 chronicles": 14, "2 chron": 14, "2 chr": 14, "2chr": 14, "2 ch": 14, "2ch": 14,
  "ezra": 15, "ezr": 15, "nehemiah": 16, "neh": 16, "ne": 16, "esther": 17, "est": 17, "esth": 17,
  "job": 18, "jb": 18, "psalms": 19, "psalm": 19, "ps": 19, "psa": 19, "proverbs": 20, "prov": 20, "pro": 20, "pr": 20,
  "ecclesiastes": 21, "ecc": 21, "eccles": 21, "ec": 21, "song of solomon": 22, "song": 22, "sos": 22, "canticles": 22,
  "isaiah": 23, "isa": 23, "is": 23, "jeremiah": 24, "jer": 24, "je": 24, "lamentations": 25, "lam": 25, "la": 25,
  "ezekiel": 26, "ezek": 26, "eze": 26, "daniel": 27, "dan": 27, "da": 27, "hosea": 28, "hos": 28, "ho": 28,
  "joel": 29, "jl": 29, "amos": 30, "am": 30, "obadiah": 31, "obad": 31, "ob": 31,
  "jonah": 32, "jon": 32, "jnh": 32, "micah": 33, "mic": 33, "mc": 33, "nahum": 34, "nah": 34, "na": 34,
  "habakkuk": 35, "hab": 35, "zephaniah": 36, "zeph": 36, "zep": 36, "zp": 36,
  "haggai": 37, "hag": 37, "hg": 37, "zechariah": 38, "zech": 38, "zec": 38, "zc": 38, "malachi": 39, "mal": 39, "ml": 39,
  "matthew": 40, "matt": 40, "mt": 40, "mark": 41, "mrk": 41, "mk": 41, "luke": 42, "luk": 42, "lk": 42,
  "john": 43, "joh": 43, "jn": 43, "acts": 44, "act": 44, "ac": 44, "romans": 45, "rom": 45, "ro": 45, "rm": 45,
  "1 corinthians": 46, "1 cor": 46, "1cor": 46, "1 co": 46, "1co": 46, "2 corinthians": 47, "2 cor": 47, "2cor": 47, "2 co": 47, "2co": 47,
  "galatians": 48, "gal": 48, "ga": 48, "ephesians": 49, "eph": 49, "philippians": 50, "phil": 50, "php": 50, "colossians": 51, "col": 51,
  "1 thessalonians": 52, "1 thess": 52, "1 the": 52, "1thess": 52, "1the": 52, "1 th": 52, "1th": 52,
  "2 thessalonians": 53, "2 thess": 53, "2 the": 53, "2thess": 53, "2the": 53, "2 th": 53, "2th": 53,
  "1 timothy": 54, "1 tim": 54, "1tim": 54, "1 ti": 54, "1ti": 54, "2 timothy": 55, "2 tim": 55, "2tim": 55, "2 ti": 55, "2ti": 55,
  "titus": 56, "tit": 56, "ti": 56, "philemon": 57, "philem": 57, "phm": 57, "hebrews": 58, "heb": 58,
  "james": 59, "jas": 59, "jm": 59, "1 peter": 60, "1 pet": 60, "1pet": 60, "1 pe": 60, "1pe": 60, "1 pt": 60, "1pt": 60,
  "2 peter": 61, "2 pet": 61, "2pet": 61, "2 pe": 61, "2pe": 61, "2 pt": 61, "2pt": 61,
  "1 john": 62, "1 joh": 62, "1joh": 62, "1 jn": 62, "1jn": 62, "1 jo": 62, "1jo": 62,
  "2 john": 63, "2 joh": 63, "2joh": 63, "2 jn": 63, "2jn": 63, "2 jo": 63, "2jo": 63,
  "3 john": 64, "3 joh": 64, "3joh": 64, "3 jn": 64, "3jn": 64, "3 jo": 64, "3jo": 64,
  "jude": 65, "jud": 65, "jd": 65, "revelation": 66, "rev": 66, "re": 66,

  // Tamil names 
  "ஆதியாகமம்": 1, "யாத்திராகமம்": 2, "லேவியராகமம்": 3, "எண்ணாகமம்": 4, "உபாகமம்": 5,
  "யோசுவா": 6, "நியாயாதிபதிகள்": 7, "ரூத்": 8, "1 சாமுவேல்": 9, "2 சாமுவேல்": 10,
  "1 ராஜாக்கள்": 11, "2 ராஜாக்கள்": 12, "1 நாளாகமம்": 13, "2 நாளாகமம்": 14, "எஸ்றா": 15,
  "நெகேமியா": 16, "எஸ்தர்": 17, "யோபு": 18, "சங்கீதம்": 19, "நீதிமொழிகள்": 20,
  "பிரசங்கி": 21, "உன்னதப்பாட்டு": 22, "ஏசாயா": 23, "எரேமியா": 24, "புலம்பல்": 25,
  "எசேக்கியேல்": 26, "தானியேல்": 27, "ஓசியா": 28, "யோவேல்": 29, "ஆமோஸ்": 30,
  "ஒபதியா": 31, "யோனா": 32, "மீகா": 33, "நாகூம்": 34, "ஆபகூக்": 35,
  "செப்பனியா": 36, "ஆகாய்": 37, "சகரியா": 38, "மல்கியா": 39, "மத்தேயு": 40,
  "மாற்கு": 41, "லூக்கா": 42, "யோவான்": 43, "அப்போஸ்தலர்": 44, "ரோமர்": 45,
  "1 கொரிந்தியர்": 46, "2 கொரிந்தியர்": 47, "கலாத்தியர்": 48, "எபேசியர்": 49, "பிலிப்பியர்": 50,
  "கொலோசெயர்": 51, "1 தெசலோனிக்கேயர்": 52, "2 தெசலோனிக்கேயர்": 53, "1 தீமோத்தேயு": 54, "2 தீமோத்தேயு": 55,
  "தீத்து": 56, "பிலேமோன்": 57, "எபிரெயர்": 58, "யாக்கோபு": 59, "1 பேதுரு": 60,
  "2 பேதுரு": 61, "1 யோவான்": 62, "2 யோவான்": 63, "3 யோவான்": 64, "யூதா": 65,
  "வெளிப்படுத்தின விசேஷம்": 66
};

const getBookId = (query) => {
  if (!query) return null;
  const normalized = query.toLowerCase().trim().replace(/\./g, "");
  
  if (bibleAliases[normalized]) return bibleAliases[normalized];
  
  for (const [key, val] of Object.entries(bibleAliases)) {
    if (key.startsWith(normalized)) return val;
  }
  return null;
};


export const fetchVerseText = async (query) => {
  const regex = /^(.+?)\s+(\d+)\s*[:\.]\s*(\d+)(?:\s*-\s*(\d+))?$/;
  const parts = query.match(regex);
  if (!parts) return null;

  const bookQuery = parts[1];
  const chapter = parseInt(parts[2], 10);
  const verseStart = parseInt(parts[3], 10);
  const verseEnd = parts[4] ? parseInt(parts[4], 10) : verseStart;

  const bookId = getBookId(bookQuery);
  if (!bookId) return null;

  const verses = await Bible.find({
    bookId,
    chapter,
    verse: { $gte: verseStart, $lte: verseEnd }
  }).sort({ verse: 1 });

  if (!verses || verses.length === 0) return null;

  let text = "";
  for (const v of verses) {
    if (verseStart !== verseEnd) {
       text += `${v.verse}. ${v.text} `;
    } else {
       text += `${v.text} `;
    }
  }

  const bookName = verses[0].bookName;
  const citation = verseStart === verseEnd ? `${bookName} ${chapter}:${verseStart}` : `${bookName} ${chapter}:${verseStart}-${verseEnd}`;
  
  return `${text.trim()} (${citation})`;
};

export const registerBible = (bot) => {
  bot.onText(/^\/addverse\s+(birthday|wedding|youth|elder)\s+(.+)$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const type = match[1].toLowerCase();
    const reference = match[2];

    const text = await fetchVerseText(reference);
    if (!text) {
      return bot.sendMessage(chatId, "⚠️ Could not resolve reference. Ensure it is formatted correctly (e.g. John 3:16)");
    }

    await EventVerse.create({ type, reference });
    bot.sendMessage(chatId, `✅ Saved custom ${type} verse!\n\n${text}`);
  }));

  bot.onText(/^\/listverses(?:\s+(birthday|wedding|youth|elder))?$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const type = match[1] ? match[1].toLowerCase() : null;
    
    const query = type ? { type } : {};
    const verses = await EventVerse.find(query);

    if (verses.length === 0) return bot.sendMessage(chatId, "No custom verses found.");

    let out = "📖 *Custom Verses Collection*\n\n";
    verses.forEach((v, i) => {
      out += `${i + 1}. [${v.type}] ${v.reference} (ID: ${v._id})\n`;
    });
    bot.sendMessage(chatId, out, { parse_mode: "Markdown" });
  }));

  bot.onText(/^\/delverse\s+([a-zA-Z0-9_]+)$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const id = match[1];

    try {
      await EventVerse.findByIdAndDelete(id);
      bot.sendMessage(chatId, "✅ Verse deleted from collection.");
    } catch {
      bot.sendMessage(chatId, "⚠️ Invalid ID.");
    }
  }));

  bot.onText(/^\/bible(?:\s+(.+))?$/i, adminOnly(async (msg, match) => {
    const chatId = msg.chat.id;
    const query = match[1];

    if (!query) {
      return bot.sendMessage(chatId, "📖 *How to use /bible*\nType `/bible <Book> <Chapter>:<Verse>`\n\nExample: `/bible John 3:16` or `/bible யோவான் 3:16`", { parse_mode: "Markdown" });
    }

    // Parse: Book Chapter:Verse or Book Chapter:Verse-EndVerse
    const regex = /^(.+?)\s+(\d+)\s*[:\.]\s*(\d+)(?:\s*-\s*(\d+))?$/;
    const parts = query.match(regex);

    if (!parts) {
      return bot.sendMessage(chatId, "⚠️ Invalid format. Example: `/bible John 3:16`", { parse_mode: "Markdown" });
    }

    const bookQuery = parts[1];
    const chapter = parseInt(parts[2], 10);
    const verseStart = parseInt(parts[3], 10);
    const verseEnd = parts[4] ? parseInt(parts[4], 10) : verseStart;

    const bookId = getBookId(bookQuery);
    if (!bookId) {
      return bot.sendMessage(chatId, `⚠️ Could not find a book matching "${bookQuery}".`);
    }

    try {
      const verses = await Bible.find({
        bookId,
        chapter,
        verse: { $gte: verseStart, $lte: verseEnd }
      }).sort({ verse: 1 });

      if (!verses || verses.length === 0) {
        return bot.sendMessage(chatId, `⚠️ Verse not found in TAOVBSI for that reference.`);
      }

      const bookName = verses[0].bookName;
      let text = `📖 *${bookName} ${chapter}:*`;
      
      if (verseStart === verseEnd) {
         text += `${verseStart}\n\n`;
      } else {
         text += `${verseStart}-${verseEnd}\n\n`;
      }

      for (const v of verses) {
        if (verseStart !== verseEnd) {
           text += `*${v.verse}.* ${v.text}\n`;
        } else {
           text += `${v.text}\n`;
        }
      }

      await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });

    } catch (err) {
      console.error(err);
      await bot.sendMessage(chatId, "⚠️ Database error while fetching the verse.");
    }
  }));
};
