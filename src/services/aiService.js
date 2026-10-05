import mongoose from "mongoose";
import EventVerse from "../models/EventVerse.js";
import AICache from "../models/aiCache.js";
import { fetchVerseText } from "../bot/handlers/bible.js";

/* ===============================
   TAMIL BIBLE ENGINE - TAOVBSI
   Canonical Scripture Curated Verses
   =============================== */

/* ===== BIRTHDAY VERSES (Canonical & Reverent) ===== */
const birthdayVerses = [
  {
    ref: "எண்ணாகமம் 6:24-26",
    text: "கர்த்தர் உன்னை ஆசீர்வதித்து, உன்னைக் காக்கக்கடவர். கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரகாசிக்கப்பண்ணி, உன்மேல் கிருபையாயிருக்கக்கடவர். கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரசன்னமாக்கி, உனக்குச் சமாதானம் கட்டளையிடக்கடவர்."
  },
  {
    ref: "நீதிமொழிகள் 3:5-6",
    text: "உன் சுயபுத்தியின்மேல் சாயாமல், உன் முழு இருதயத்தோடும் கர்த்தரில் நம்பிக்கையாயிருந்து, உன் வழிகளிலெல்லாம் அவரை நினைத்துக்கொள்; அப்பொழுது அவர் உன் பாதைகளைச் செவ்வைப்படுத்துவார்."
  },
  {
    ref: "சங்கீதம் 23:1-3",
    text: "கர்த்தர் என் மேய்ப்பராயிருக்கிறார்; நான் தாழ்ச்சியடையேன். அவர் என்னைப்புல்லுள்ள இடங்களில் கிடத்தி, அமர்ந்த தண்ணீரண்டையில் என்னைக் கொண்டுபோய் விடுகிறார். அவர் என் ஆத்துமாவைத் தேற்றி, தம்முடைய நாமத்தினிமித்தம் என்னை நீதியின் பாதைகளில் நடத்துகிறார்."
  },
  {
    ref: "சங்கீதம் 37:5",
    text: "உன் வழியைக் கர்த்தருக்கு ஒப்புவித்து, அவர்மேல் நம்பிக்கையாயிரு; அவரே காரியத்தை வாய்க்கப்பண்ணுவார்."
  },
  {
    ref: "சங்கீதம் 121:7-8",
    text: "கர்த்தர் உன்னை எல்லாத் தீங்குக்கும் விலக்கிக் காப்பார்; அவர் உன் ஆத்துமாவைக் காப்பார். கர்த்தர் உன் போக்கையும் உன் வரத்தையும் இதுமுதற்கொண்டு என்றென்றைக்கும் காப்பார்."
  },
  {
    ref: "ஏசாயா 40:31",
    text: "கர்த்தருக்குக் காத்திருக்கிறவர்களோ புதுப்பெலன் அடைந்து, கழுகுகளைப்போலச் சட்டைகளை அடித்து எழும்புவார்கள்; அவர்கள் ஓடினாலும் இளைப்படையார்கள், நடந்தாலும் சோர்ந்துபோகார்கள்."
  },
  {
    ref: "எரேமியா 29:11",
    text: "நான் உங்கள்மேல் நினைத்திருக்கிற நினைவுகளை நான் அறிவேன் என்று கர்த்தர் சொல்லுகிறார்; அவைகள் தீமைக்கல்ல, சமாதானத்துக்கேதுவான நினைவுகளே; உங்கள் முடிவு நன்மையாயிருக்கும்படிக்கு நம்பிக்கையை உங்களுக்கு அளிக்கிற நினைவுகளே."
  },
  {
    ref: "சங்கீதம் 20:4",
    text: "உன் இருதயத்தின் விருப்பத்தின்படி உனக்குத் தந்தருளி, உன் ஆலோசனைகளையெல்லாம் நிறைவேற்றுவாராக."
  },
  {
    ref: "நீதிமொழிகள் 9:11",
    text: "என்னாலே உன் நாட்கள் பெருகும்; உன் ஆயுசின் வருஷங்கள் விருத்தியாகும்."
  },
  {
    ref: "சங்கீதம் 91:1-2",
    text: "உன்னதமானவரின் மறைவிலிருக்கிறவன் சர்வவல்லவருடைய நிழலில் தங்குவான். நான் கர்த்தரை நோக்கி: நீர் என் அடைக்கலம், என் கோட்டை, என் தேவன், நான் நம்பியிருக்கிறவர் என்று சொல்லுவேன்."
  },
  {
    ref: "சங்கீதம் 103:2-5",
    text: "என் ஆத்துமாவே, கர்த்தரை ஸ்தோத்திரி; அவர் செய்த சகல உபகாரங்களையும் மறவாதே. அவர் உன் அக்கிரமங்களையெல்லாம் மன்னித்து, உன் நோய்களையெல்லாம் குணமாக்கி, உன் பிராணனை அழிவுக்கு விலக்கி மீட்டு, உன்னைக் கிருபையினாலும் இரக்கங்களினாலும் முடிசூட்டுகிறார்."
  },
  {
    ref: "3 யோவான் 1:2",
    text: "பிரியமானவனே, உன் ஆத்துமா வாழ்கிறதுபோல நீ எல்லாவற்றிலும் வாழ்ந்து சுகமாயிருக்கும்படி வேண்டுகிறேன்."
  }
];

/* ===== CHILDREN & BABY DEDICATION VERSES ===== */
const childrenVerses = [
  {
    ref: "சங்கீதம் 127:3",
    text: "இதோ, பிள்ளைகள் கர்த்தரால் வரும் சுதந்திரம்; கர்ப்பத்தின் கனி அவர் அளிக்கும் பலன்."
  },
  {
    ref: "நீதிமொழிகள் 22:6",
    text: "பாலன் நடக்கவேண்டிய வழியிலே அவனை நடத்து; அவன் முதிர்வயதுமட்டும் அதிலிருந்து விலகாதிருப்பான்."
  },
  {
    ref: "ஏசாயா 54:13",
    text: "உன் பிள்ளைகளெல்லாரும் கர்த்தரால் போதிக்கப்பட்டிருப்பார்கள்; உன் பிள்ளைகளுடைய சமாதானம் பெரிதாயிருக்கும்."
  },
  {
    ref: "சங்கீதம் 139:14",
    text: "நான் பிரமிக்கத்தக்க அதிசயமாய் உண்டாக்கப்பட்டபடியால், உம்மைத் துதிப்பேன்; உமது கிரியைகள் அதிசயமானவைகள், அது என் ஆத்துமாவுக்கு நன்றாய் தெரியும்."
  }
];

/* ===== YOUTH VERSES (under 25) ===== */
const youthVerses = [
  {
    ref: "சங்கீதம் 119:9",
    text: "வாலிபன் தன் வழியை எதினால் சுத்தம்பண்ணுவான்? உமது வசனத்தின்படி தன்னைக் காத்துக்கொள்ளுவதினால்தானே."
  },
  {
    ref: "1 தீமோத்தேயு 4:12",
    text: "உன் இளமையைக்குறித்து ஒருவனும் உன்னை அசட்டைபண்ணாதபடிக்கு, வார்த்தையிலும், நடக்கையிலும், அன்பிலும், ஆவியிலும், விசுவாசத்திலும், கற்பிலும், விசுவாசிகளுக்கு மாதிரியாயிரு."
  },
  {
    ref: "யோசுவா 1:9",
    text: "பலங்கொண்டு திடமனதாயிரு என்று நான் உனக்குக் கட்டளையிடவில்லையா? திகையாதே, கலங்காதே; நீ போகும் இடமெல்லாம் உன் தேவனாகிய கர்த்தர் உன்னோடே இருக்கிறார்."
  },
  {
    ref: "பிலிப்பியர் 4:13",
    text: "என்னைப் பெலப்படுத்துகிற கிறிஸ்துவினாலே எல்லாவற்றையுஞ்செய்ய எனக்குப் பெலனுண்டு."
  },
  {
    ref: "பிரசங்கி 12:1",
    text: "நீ உன் வாலிபப்பிராயத்திலே உன் சிருஷ்டிகரை நினை; தீங்குநாட்கள் வராததற்குமுன்னும், எனக்குப் பிரியமானவைகளல்ல என்று நீ சொல்லும் வருஷங்கள் சேராததற்குமுன்னும் அவரை நினை."
  }
];

/* ===== ELDER VERSES (60 and above) ===== */
const elderVerses = [
  {
    ref: "சங்கீதம் 92:12-14",
    text: "நீதிமான் பனைமரத்தைப்போல் செழிப்பான்; லீபனோனிலுள்ள கேதுருமரம்போல் வளருவான். கர்த்தருடைய ஆலயத்திலே நாட்டப்பட்டவர்களாய், நம்முடைய தேவனுடைய பிரகாரங்களிலே செழிப்பார்கள். அவர்கள் முதிர்வயதிலும் கனிகொடுத்து, சாரமும் பசுமையுமாயிருப்பார்கள்."
  },
  {
    ref: "ஏசாயா 46:4",
    text: "உங்கள் முதிர்வயதுவரைக்கும் நான் அவர்தாமே, நரைவயதுமட்டும் நான் உங்களைத் தாங்குவேன்; நான் உண்டாக்கினேன், நான் சுமப்பேன், நான் தப்புவிப்பேன்."
  },
  {
    ref: "சங்கீதம் 71:18",
    text: "தேவனே, நான் முதிர்வயதும் நரையுமுள்ளவனாகுமட்டும் என்னைக்கைவிடாதிரும்; தலைமுறைக்கு உமது புயத்தையும், வரப்போகிற யாவருக்கும் உமது வல்லமையையும் நான் அறிவிக்குமட்டும் கைவிடாதிரும்."
  },
  {
    ref: "நீதிமொழிகள் 16:31",
    text: "நரைமயிர் மகிமையான கிரீடம், அது நீதியின் வழியில் காணப்படும்."
  }
];

/* ===== WEDDING VERSES (Marriage & Unity) ===== */
const weddingVerses = [
  {
    ref: "ஆதியாகமம் 2:24",
    text: "இதினிமித்தம் புருஷன் தன் தகப்பனையும் தன் தாயையும் விட்டு, தன் மனைவியோடே இசைந்திருப்பான்; அவர்கள் ஒரே மாம்சமாயிருப்பார்கள்."
  },
  {
    ref: "மத்தேயு 19:6",
    text: "இப்படி இருக்கிறபடியினால், அவர்கள் இருவராயிராமல், ஒரே மாம்சமாயிருக்கிறார்கள்; ஆகையால், தேவன் இணைத்ததை மனுஷன் பிரிக்காதிருக்கக்கடவன்."
  },
  {
    ref: "1 கொரிந்தியர் 13:4-7",
    text: "அன்பு நீடிய சாந்தமும் தயவுமுள்ளது; அன்புக்குப் பொறாமையில்லை; அன்பு தன்னைப் புகழாது, இறுமாப்பாயிராது. அன்பு சகலத்தையும் தாங்கும், சகலத்தையும் விசுவாசிக்கும், சகலத்தையும் நம்பும், சகலத்தையும் சகிக்கும்."
  },
  {
    ref: "1 கொரிந்தியர் 13:13",
    text: "இப்பொழுது விசுவாசம், நம்பிக்கை, அன்பு இம்மூன்றும் நிலைத்திருக்கிறது; இவைகளில் அன்பே பெரியது."
  },
  {
    ref: "கொலோசெயர் 3:14",
    text: "இவை எல்லாவற்றின்மேலும், பூரணசற்குணத்தின் கட்டாகிய அன்பைத் தரித்துக்கொள்ளுங்கள்."
  },
  {
    ref: "சங்கீதம் 128:1-3",
    text: "கர்த்தருக்குப் பயந்து, அவர் வழிகளில் நடக்கிறவன் எவனோ, அவன் பாக்கியவான். உன் கைப்பிரயாசத்தை நீ சாப்பிடுவாய்; உனக்குப் பாக்கியமும் நன்மையும் உண்டாயிருக்கும். உன் மனைவி உன் வீட்டோரங்களில் கனிதரும் திராட்சக்கொடியைப்போல் இருப்பாள்; உன் பிள்ளைகள் உன் பந்தியைச் சுற்றிலும் ஒலிவமரக் கன்றுகளைப்போல் இருப்பார்கள்."
  },
  {
    ref: "பிரசங்கி 4:9-12",
    text: "ஒன்றாயிருப்பதைப்பார்க்கிலும் இருவர் கூடி இருப்பது நலம்; முப்புரிநூல் சீக்கிரமாய் அறாது."
  },
  {
    ref: "எபேசியர் 5:33",
    text: "எப்படியும், உங்களில் அவனவன் தன்மேல் அன்பு Berry செய்வதுபோல, தன் மனைவிமேலும் அன்பு கூரக்கடவன்; மனைவியும் புருஷனிடத்தில் பயபக்தியாயிருக்கக்கடவள்."
  }
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const normalize = (t) => {
  if (!t) return "";
  return t
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
};

export const getAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};

/**
 * Retrieve canonical scripture verse for an event
 */
export const getCanonicalVerse = async (eventType, member = null) => {
  const age = member ? getAge(member.dob) : null;
  let type = eventType;

  if (eventType === "birthday") {
    if (member?.isChild || (age !== null && age < 13)) type = "child";
    else if (age !== null && age <= 25) type = "youth";
    else if (age !== null && age >= 60) type = "elder";
  }

  // 1. Check custom database event verses (if MongoDB is connected)
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const customVerses = await EventVerse.find({ type });
      if (customVerses && customVerses.length > 0) {
        const chosen = pick(customVerses);
        const text = await fetchVerseText(chosen.reference);
        if (text) {
          return {
            reference: chosen.reference,
            text: normalize(text)
          };
        }
      }
    } catch (err) {
      console.warn("⚠️ Failed reading custom EventVerse, using canonical default:", err.message);
    }
  }

  // 2. Curated fallbacks with exact stored references
  if (type === "child") {
    const item = pick(childrenVerses);
    return { reference: item.ref, text: `${item.text} (${item.ref})` };
  }
  if (type === "youth") {
    const item = pick(youthVerses);
    return { reference: item.ref, text: `${item.text} (${item.ref})` };
  }
  if (type === "elder") {
    const item = pick(elderVerses);
    return { reference: item.ref, text: `${item.text} (${item.ref})` };
  }
  if (type === "wedding") {
    const item = pick(weddingVerses);
    return { reference: item.ref, text: `${item.text} (${item.ref})` };
  }

  const item = pick(birthdayVerses);
  return { reference: item.ref, text: `${item.text} (${item.ref})` };
};

/* Curated offline Tamil pastoral blessings by style when Gemini is disabled or unreachable */
const fallbackBlessings = {
  pastoral: (name, isWedding, spouse) =>
    isWedding
      ? `கர்த்தர் உங்கள் இல்லற வாழ்க்கையை தம்முடைய விசேஷித்த கிருபையினாலும் சமாதானத்தினாலும் நிரப்பி, ஒருமனத்தோடும் அன்போடும் தொடர்ந்து ஆசீர்வதிப்பாராக.`
      : `கர்த்தராகிய இயேசு கிறிஸ்து உங்கள் புதிய வயதிலே தம்முடைய விசேஷித்த கிருபையினாலும் வழிநடத்துதலினாலும் உங்களை ஆசீர்வதித்து காத்துக்கொள்வாராக.`,
  heartfelt: (name, isWedding, spouse) =>
    isWedding
      ? `இனிய திருமண நாள் நல்வாழ்த்துகள்! தேவனுடைய மாறாத அன்பு உங்கள் குடும்பத்தில் என்றென்றும் பிரகாசித்து, பூரண மகிழ்ச்சியைத் தருவதாக.`
      : `இனிய பிறந்தநாள் நல்வாழ்த்துகள்! ஆண்டவர் உமது இருதயத்தின் நல்ல வாஞ்சைகளை நிறைவேற்றி, புது பலத்தோடு உங்களை வழிநடத்துவாராக.`,
  short: (name, isWedding, spouse) =>
    isWedding
      ? `திருமண நாள் வாழ்த்துகள்! கர்த்தரின் ஆசீர்வாதமும் சமாதானமும் உங்கள் குடும்பத்தோடு இருப்பதாக.`
      : `இனிய பிறந்தநாள் வாழ்த்துகள்! கர்த்தர் உங்களை நிறைவாய் ஆசீர்வதிப்பாராக.`,
  formal: (name, isWedding, spouse) =>
    isWedding
      ? `சேலம் ஆதி பாப்திஸ்து திருச்சபையின் சார்பாக அன்பு நிறைந்த திருமண நாள் நல்வாழ்த்துகளைத் தெரிவித்துக் கொள்கிறோம். கர்த்தர் தாமே உங்கள் குடும்பத்தை ஆசீர்வதிப்பாராக.`
      : `சேலம் ஆதி பாப்திஸ்து திருச்சபையின் சார்பாக இனிய பிறந்தநாள் வாழ்த்துகள். தேவன் உம்மை எல்லாத் தீங்கிற்கும் விலக்கிக் காப்பாராக.`
};

/**
 * Generate pastoral prayer / greeting with Gemini AI with caching and fallback
 */
export const generateGreetingPrayer = async ({
  member,
  eventType = "birthday",
  style = "pastoral",
  verseText = "",
  verseRef = ""
}) => {
  const isWedding = eventType === "wedding";
  const memberName = member?.name || "அன்பான விசுவாசி";
  const spouseName = member?.spouseName || "";
  const currentYear = new Date().getFullYear();

  const cacheKey = `ai_prayer:${member?._id || memberName}:${eventType}:${style}:${currentYear}`;

  // Check persistent cache (if MongoDB connected)
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const cached = await AICache.findOne({ input: cacheKey });
      if (cached && cached.output) {
        return cached.output;
      }
    } catch (err) {
      // Non-fatal cache lookup failure
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const fallbackFn = fallbackBlessings[style] || fallbackBlessings.pastoral;
    return fallbackFn(memberName, isWedding, spouseName);
  }

  try {
    const age = isWedding ? null : getAge(member?.dob);
    const yearsMarried = isWedding ? getAge(member?.weddingDate) : null;

    const styleInstructions = {
      pastoral: "Warm, reverent pastoral blessing from a church shepherd. Focused on God's grace, peace and spiritual strength.",
      heartfelt: "Deeply affectionate, warm Christian blessing celebrating the gift of life/marriage.",
      short: "Concise, elegant, 1-2 sentences Christian blessing.",
      formal: "Respectful, dignified traditional church greeting."
    };

    const prompt = `You are an authorized, respected pastor of Salem Primitive Baptist Church (SPBC).
Write a beautiful, personalized Christian blessing/prayer in traditional, grammatically sound Tamil for a church WhatsApp group.

Occasion: ${isWedding ? "Wedding Anniversary (திருமண நாள்)" : "Birthday (பிறந்தநாள்)"}
Style requested: ${styleInstructions[style] || styleInstructions.pastoral}
Celebrant name: ${memberName}
${isWedding ? `Spouse name: ${spouseName || "அவர்கள்"}` : `Age/Category: ${age ? `${age} years` : member?.isChild ? "Child" : "Adult"}`}
${yearsMarried ? `Years married: ${yearsMarried} years` : ""}
Selected Scripture verse: "${verseText}" (Reference: ${verseRef})

Strict Rules:
1. Write ONLY in natural, fluent, elegant, authentic Tamil Christian phrasing.
2. 2 to 3 sentences maximum.
3. Incorporate the spirit of the Scripture verse and pray for God's blessings, protection and peace.
4. Do NOT hallucinate or quote fake Bible verses. The verse is provided above and handled separately.
5. Do NOT include English text, markdown bold headings, or conversational pleasantries (e.g. "Here is your wish:").
6. Output ONLY the Tamil prayer blessing text.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 250
          }
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (generated && generated.trim().length > 10) {
        const cleaned = normalize(generated);
        // Persist to AICache
        try {
          await AICache.findOneAndUpdate(
            { input: cacheKey },
            { output: cleaned, createdAt: new Date() },
            { upsert: true }
          );
        } catch (e) {
          // ignore cache write error
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn("⚠️ Gemini AI generation failed or timed out, using pastoral fallback:", err.message);
  }

  const fallbackFn = fallbackBlessings[style] || fallbackBlessings.pastoral;
  return fallbackFn(memberName, isWedding, spouseName);
};

/**
 * Format complete greeting ready for preview and copy
 */
export const formatGreetingCard = ({
  eventType = "birthday",
  member,
  verseText,
  verseRef,
  prayerText
}) => {
  const isWedding = eventType === "wedding";
  const name = member?.name || "";
  const spouse = member?.spouseName || "";

  let header = "";
  if (isWedding) {
    header = `💐 **இனிய திருமண நாள் நல்வாழ்த்துகள்!** 💐\n💍 **${name}${spouse ? ` & ${spouse}` : ""}**`;
  } else {
    header = `🎂 **இனிய பிறந்தநாள் நல்வாழ்த்துகள்!** 🎂\n🎉 **${name}**`;
  }

  const scriptureBlock = verseText ? `📖 **வேத வசனம்:**\n_${verseText}_` : "";
  const prayerBlock = prayerText ? `🙏 **ஜெபமும் ஆசீர்வாதமும்:**\n${prayerText}` : "";
  const footer = `⛪ *சேலம் ஆதி பாப்திஸ்து திருச்சபை (SPBC)*`;

  const sections = [header, scriptureBlock, prayerBlock, footer].filter(Boolean);
  return sections.join("\n\n");
};

/**
 * Backward compatibility helper for existing callers
 */
export const enhanceTamil = async (text, context = {}) => {
  try {
    const member = context.member;
    const type = context.type || "birthday";
    const verseObj = await getCanonicalVerse(type, member);
    const prayer = await generateGreetingPrayer({
      member,
      eventType: type,
      verseText: verseObj.text,
      verseRef: verseObj.reference
    });

    return formatGreetingCard({
      eventType: type,
      member,
      verseText: verseObj.text,
      verseRef: verseObj.reference,
      prayerText: prayer
    });
  } catch (err) {
    return text;
  }
};
