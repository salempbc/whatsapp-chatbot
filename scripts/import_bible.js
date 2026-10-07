import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";
import Bible from "../src/models/Bible.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XML_PATH = path.resolve(__dirname, "../public/Tamil Bible.xml");

(async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is not defined in environment.");
      process.exit(1);
    }

    if (!fs.existsSync(XML_PATH)) {
      console.error(`❌ Tamil Bible.xml not found at ${XML_PATH}`);
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB.");

    const count = await Bible.countDocuments();
    if (count > 0) {
      console.log(`🧹 Bible already contains ${count} verses. Purging for clean re-import...`);
      await Bible.deleteMany({});
    }

    console.log(`📖 Reading and parsing Tamil Bible.xml (Canonical O.V. BSI)...`);
    const fileStream = fs.createReadStream(XML_PATH, "utf8");
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentBookId = 0;
    let currentBookName = "";
    let currentChapter = 0;
    const versesBatch = [];
    let totalImported = 0;
    const BATCH_SIZE = 2000;

    for await (const line of rl) {
      const bookMatch = line.match(/<BIBLEBOOK\s+bnumber="(\d+)"\s+bname="([^"]+)"/);
      if (bookMatch) {
        currentBookId = parseInt(bookMatch[1], 10);
        currentBookName = bookMatch[2].trim();
        continue;
      }

      const chapterMatch = line.match(/<CHAPTER\s+cnumber="(\d+)"/);
      if (chapterMatch) {
        currentChapter = parseInt(chapterMatch[1], 10);
        continue;
      }

      const verseMatch = line.match(/<VERS\s+vnumber="(\d+)">([^<]+)<\/VERS>/);
      if (verseMatch) {
        const verseNum = parseInt(verseMatch[1], 10);
        const text = verseMatch[2].trim();

        versesBatch.push({
          bookId: currentBookId,
          bookName: currentBookName,
          chapter: currentChapter,
          verse: verseNum,
          text
        });

        if (versesBatch.length >= BATCH_SIZE) {
          await Bible.insertMany(versesBatch, { ordered: false });
          totalImported += versesBatch.length;
          process.stdout.write(`⏳ Imported ${totalImported} verses...\r`);
          versesBatch.length = 0;
        }
      }
    }

    if (versesBatch.length > 0) {
      await Bible.insertMany(versesBatch, { ordered: false });
      totalImported += versesBatch.length;
    }

    console.log(`\n🎉 Successfully imported all ${totalImported} verses from Tamil Bible.xml into MongoDB!`);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Bible import failed:", err);
    process.exit(1);
  }
})();
