import test from "node:test";
import assert from "node:assert/strict";
import {
  getAge,
  getCanonicalVerse,
  generateGreetingPrayer,
  formatGreetingCard,
  normalize,
  isValidTamilPrayer
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
  assert.ok(
    weddingVerse.reference.includes("ஆதியாகமம்") ||
    weddingVerse.reference.includes("மத்தேயு") ||
    weddingVerse.reference.includes("கொரிந்தியர்") ||
    weddingVerse.reference.includes("கொலோசெயர்") ||
    weddingVerse.reference.includes("சங்கீதம்") ||
    weddingVerse.reference.includes("பிரசங்கி") ||
    weddingVerse.reference.includes("எபேசியர்"),
    "Wedding verse matches canonical Scripture"
  );
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
  assert.ok(!card.includes("**"), "Must NOT use markdown double asterisks in WhatsApp format");
  assert.ok(card.includes("> _"), "Scripture must use WhatsApp quote and italic markers");
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

test("Formatting: formatGreetingCard seamlessly incorporates church message templates", () => {
  const card = formatGreetingCard({
    eventType: "birthday",
    member: { name: "சகோ. யோவான்" },
    verseText: "கர்த்தர் உன்னை எல்லாத் தீங்குக்கும் விலக்கிக் காப்பார் (சங்கீதம் 121:7)",
    verseRef: "சங்கீதம் 121:7",
    prayerText: "கர்த்தர் தாமே உங்கள் குடும்பத்தை ஆசீர்வதிப்பாராக.",
    templateText: "இன்று பிறந்த நாளை காணும் சகோதரர் யோவான், SPBC குடும்பத்தின் சார்பில் அன்புடன் வாழ்த்துகிறோம்."
  });

  assert.ok(card.includes("இனிய பிறந்தநாள் நல்வாழ்த்துகள்!"), "Header present");
  assert.ok(card.includes("சகோ. யோவான்"), "Name included");
  assert.ok(card.includes("வேத வசனம்:"), "Scripture section present");
  assert.ok(card.includes("வாழ்த்து:"), "Template greeting section present");
  assert.ok(card.includes("SPBC குடும்பத்தின் சார்பில்"), "Template text included");
  assert.ok(card.includes("ஜெபமும் ஆசீர்வாதமும்:"), "Prayer section present");
  assert.ok(card.includes("சேலம் ஆதி பாப்திஸ்து திருச்சபை (SPBC)"), "Church footer present");
});

test("AI & Scripture: Tone styles generate distinct valid Tamil blessings", async () => {
  const member = { name: "ரோஸ்லின்", isChild: false };
  const styles = ["pastoral", "heartfelt", "short", "formal"];

  for (const style of styles) {
    const text = await generateGreetingPrayer({
      member,
      eventType: "birthday",
      style,
      forceNew: true
    });
    assert.ok(text && text.length > 10, `Style ${style} must produce non-empty blessing`);
    assert.match(text, /[\u0B80-\u0BFF]/, `Style ${style} must produce Tamil text`);
  }
});

test("AI Quality Gate: isValidTamilPrayer rejects prompt template leaks and accepts valid blessings", () => {
  const leakedSample = `* Persona: Authorized, respected pastor of Salem Primitive Baptist Church (SPBC).
* Task: Write a beautiful, personalized Christian blessing/prayer in traditional, grammatically sound Tamil for a WhatsApp group.
* Occasion: Birthday.
* Celebrant: Lemuel Selvam (9 years old).
* Constraints: Only natural, fluent, elegant, authentic Tamil Christian phrasing.
* Core Blessing: May`;

  assert.equal(isValidTamilPrayer(leakedSample), false, "Must reject leaked prompt/CoT dumping");
  assert.equal(isValidTamilPrayer(""), false, "Must reject empty text");
  assert.equal(isValidTamilPrayer("Hello happy birthday to you!"), false, "Must reject English text");

  const genuineTamilPrayer = "கர்த்தராகிய இயேசு கிறிஸ்து இந்த அருமையான பிள்ளையை ஆசீர்வதித்து, ஞானத்திலும் அறிவிலும் தேவ கிருபையிலும் மேன்மேலும் வளரச் செய்வாராக.";
  assert.equal(isValidTamilPrayer(genuineTamilPrayer), true, "Must accept authentic Tamil Christian prayer");
});

test("Tamil Bible XML: Exact word-for-word scripture matches Tamil Bible.xml without mutation", async () => {
  const { getVerseFromXML } = await import("../src/services/tamilBibleService.js");

  const ps127 = getVerseFromXML("சங்கீதம் 127:3");
  assert.equal(
    ps127,
    "இதோ, பிள்ளைகள் கர்த்தரால் வரும் சுதந்தரம், கர்ப்பத்தின் கனி அவரால் கிடைக்கும் பலன்.",
    "Psalm 127:3 must match exact Tamil Bible.xml text"
  );

  const prov22 = getVerseFromXML("நீதிமொழிகள் 22:6");
  assert.equal(
    prov22,
    "பிள்ளையானவன் நடக்கவேண்டிய வழியிலே அவனை நடத்து; அவன் முதிர்வயதிலும் அதை விடாதிருப்பான்.",
    "Proverbs 22:6 must match exact Tamil Bible.xml text"
  );
});

