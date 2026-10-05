import test from "node:test";
import assert from "node:assert/strict";
import {
  getAge,
  getCanonicalVerse,
  generateGreetingPrayer,
  formatGreetingCard,
  normalize
} from "../src/services/aiService.js";
import { GREETING_STATUS } from "../src/models/GreetingLog.js";

test("AI & Scripture: getCanonicalVerse returns authentic Scripture references without hallucination", async () => {
  const bdayVerse = await getCanonicalVerse("birthday");
  assert.ok(bdayVerse.reference, "Must contain a canonical reference");
  assert.ok(bdayVerse.text.includes(bdayVerse.reference), "Text must cite the canonical reference");

  const youthVerse = await getCanonicalVerse("birthday", { dob: "2010-01-01" });
  assert.ok(youthVerse.reference.includes("சங்கீதம்") || youthVerse.reference.includes("தீமோத்தேயு") || youthVerse.reference.includes("யோசுவா") || youthVerse.reference.includes("பிலிப்பியர்") || youthVerse.reference.includes("பிரசங்கி"), "Youth verse matches curated Scripture");

  const elderVerse = await getCanonicalVerse("birthday", { dob: "1950-01-01" });
  assert.ok(elderVerse.reference.includes("சங்கீதம்") || elderVerse.reference.includes("ஏசாயா") || elderVerse.reference.includes("நீதிமொழிகள்"), "Elder verse matches curated Scripture");

  const weddingVerse = await getCanonicalVerse("wedding");
  assert.ok(weddingVerse.reference.includes("ஆதியாகமம்") || weddingVerse.reference.includes("மத்தேயு") || weddingVerse.reference.includes("கொரிந்தியர்") || weddingVerse.reference.includes("கொலோசெயர்"));
});

test("AI & Scripture: Offline fallback generates valid, reverent Tamil Christian blessings", async () => {
  const origKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;

  const member = { name: "சகோ. யோவான்", role: "சபை உறுப்பினர்", isChild: false };
  const blessing = await generateGreetingPrayer({
    member,
    eventType: "birthday",
    style: "pastoral",
    verseText: "கர்த்தர் உன்னை ஆசீர்வதித்து காக்கக்கடவர்",
    verseRef: "எண்ணாகமம் 6:24"
  });

  assert.ok(blessing.length > 20, "Blessing must contain substantial Tamil text");
  assert.match(blessing, /[\u0B80-\u0BFF]/, "Must contain authentic Tamil Unicode characters");
  assert.ok(!blessing.includes("undefined"), "Must not leak undefined variables");

  const weddingBlessing = await generateGreetingPrayer({
    member: { name: "சகோ. டேவிட்", spouseName: "சகோதரி. சாரா" },
    eventType: "wedding",
    style: "heartfelt"
  });
  assert.ok(weddingBlessing.includes("திருமண") || weddingBlessing.includes("இல்லற"), "Must address marriage");

  process.env.GEMINI_API_KEY = origKey;
});

test("Formatting: formatGreetingCard produces structured, WhatsApp-ready message", () => {
  const card = formatGreetingCard({
    eventType: "birthday",
    member: { name: "ரூபன்" },
    verseText: "கர்த்தர் என் மேய்ப்பராயிருக்கிறார் (சங்கீதம் 23:1)",
    verseRef: "சங்கீதம் 23:1",
    prayerText: "கர்த்தர் உங்கள் புதிய வயதிலே தம்முடைய விசேஷித்த கிருபையினால் ஆசீர்வதிப்பாராக."
  });

  assert.ok(card.includes("இனிய பிறந்தநாள் நல்வாழ்த்துகள்!"), "Header present");
  assert.ok(card.includes("ரூபன்"), "Name included");
  assert.ok(card.includes("வேத வசனம்:"), "Scripture section present");
  assert.ok(card.includes("ஜெபமும் ஆசீர்வாதமும்:"), "Prayer section present");
  assert.ok(card.includes("சேலம் ஆதி பாப்திஸ்து திருச்சபை (SPBC)"), "Church attribution footer present");
});

test("Lifecycle: Greeting statuses adhere to expected administrative transitions", () => {
  const expectedStatuses = [
    "PENDING",
    "GENERATING",
    "READY_FOR_REVIEW",
    "EDITED",
    "SKIPPED",
    "MARKED_AS_SHARED",
    "FAILED"
  ];
  for (const s of expectedStatuses) {
    assert.equal(GREETING_STATUS[s], s);
  }
});

test("Tamil Unicode: Text normalization preserves Tamil combining diacritics and glyphs", () => {
  const sample = "  கர்த்தர் \n\r   உன்னை   ஆசீர்வதிப்பாராக!  ";
  const cleaned = normalize(sample);
  assert.equal(cleaned, "கர்த்தர்\nஉன்னை ஆசீர்வதிப்பாராக!");
});
