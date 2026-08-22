import mongoose from "mongoose";
import dotenv from "dotenv";
import Bible from "../src/models/Bible.js";

dotenv.config();

const BOOKS = [
  "ஆதியாகமம்", "யாத்திராகமம்", "லேவியராகமம்", "எண்ணாகமம்", "உபாகமம்",
  "யோசுவா", "நியாயாதிபதிகள்", "ரூத்", "1 சாமுவேல்", "2 சாமுவேல்",
  "1 ராஜாக்கள்", "2 ராஜாக்கள்", "1 நாளாகமம்", "2 நாளாகமம்", "எஸ்றா",
  "நெகேமியா", "எஸ்தர்", "யோபு", "சங்கீதம்", "நீதிமொழிகள்",
  "பிரசங்கி", "உன்னதப்பாட்டு", "ஏசாயா", "எரேமியா", "புலம்பல்",
  "எசேக்கியேல்", "தானியேல்", "ஓசியா", "யோவேல்", "ஆமோஸ்",
  "ஒபதியா", "யோனா", "மீகா", "நாகூம்", "ஆபகூக்",
  "செப்பனியா", "ஆகாய்", "சகரியா", "மல்கியா", "மத்தேயு",
  "மாற்கு", "லூக்கா", "யோவான்", "அப்போஸ்தலர்", "ரோமர்",
  "1 கொரிந்தியர்", "2 கொரிந்தியர்", "கலாத்தியர்", "எபேசியர்", "பிலிப்பியர்",
  "கொலோசெயர்", "1 தெசலோனிக்கேயர்", "2 தெசலோனிக்கேயர்", "1 தீமோத்தேயு", "2 தீமோத்தேயு",
  "தீத்து", "பிலேமோன்", "எபிரெயர்", "யாக்கோபு", "1 பேதுரு",
  "2 பேதுரு", "1 யோவான்", "2 யோவான்", "3 யோவான்", "யூதா",
  "வெளிப்படுத்தின விசேஷம்"
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    const count = await Bible.countDocuments();
    if (count > 0) {
      console.log(`Bible already contains ${count} verses. Wiping...`);
      await Bible.deleteMany({});
    }

    console.log("Fetching JSON from GitHub...");
    const res = await fetch("https://raw.githubusercontent.com/godlytalias/Bible-Database/master/Tamil/bible.json");
    const data = await res.json();

    const verses = [];

    for (let b = 0; b < data.Book.length; b++) {
      const bookData = data.Book[b];
      const bookId = b + 1;
      const bookName = BOOKS[b];

      for (let c = 0; c < bookData.Chapter.length; c++) {
        const chapterData = bookData.Chapter[c];
        const chapter = c + 1;

        for (let v = 0; v < chapterData.Verse.length; v++) {
          const verseData = chapterData.Verse[v];
          const verse = v + 1;
          const text = verseData.Verse.trim();

          verses.push({
            bookId,
            bookName,
            chapter,
            verse,
            text
          });
        }
      }
    }

    console.log(`Parsed ${verses.length} verses. Inserting into database...`);
    await Bible.insertMany(verses, { ordered: false });
    console.log("Bible imported successfully!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
