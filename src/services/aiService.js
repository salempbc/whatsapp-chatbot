/* ===============================
   TAMIL BIBLE ENGINE — TAOVBSI
   (Tamil Aruna Old Version, Bible Society of India)
   =============================== */

/* ===== BIRTHDAY VERSES (general) ===== */
const birthdayVerses = [
  "கர்த்தர் உன்னை ஆசீர்வதித்து, உன்னைக் காக்கக்கடவர்; கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரகாசிக்கச்செய்து, உன்மேல் கிருபையாயிருக்கக்கடவர்; கர்த்தர் தம்முடைய முகத்தை உன்னிடமாய்த் திருப்பி, உனக்குச் சமாதானங்கொடுக்கக்கடவர். (எண்ணாகமம் 6:24-26)",

  "உன் முழு இருதயத்தோடும் கர்த்தரில் நம்பிக்கையாயிரு, உன் சொந்த விவேகத்தின்மேல் சாயாதே. உன் எல்லா வழிகளிலும் அவரை நினை, அப்பொழுது அவர் உன் பாதைகளைச் செவ்வைப்படுத்துவார். (நீதிமொழிகள் 3:5-6)",

  "கர்த்தர் என் மேய்ப்பர்; எனக்குக் குறைவுண்டாகாது. அவர் என்னைப் பசும்புல் வெளிகளில் படுக்கவைக்கிறார்; அமர்ந்த தண்ணீர்களண்டையில் என்னை நடத்துகிறார். என் ஆத்துமாவை அவர் தேற்றுகிறார். (சங்கீதம் 23:1-3)",

  "உன் வழியை கர்த்தரிடத்தில் ஒப்படை; அவர்மேல் நம்பிக்கையாயிரு; அவரே நடப்பிப்பார். (சங்கீதம் 37:5)",

  "கர்த்தர் உன்னை எல்லாத் தீங்கிலுமிருந்து காப்பார்; அவர் உன் ஆத்துமாவைக் காப்பார். (சங்கீதம் 121:7)",

  "கர்த்தரை நம்பிக்கொண்டிருக்கிறவர்களோ புதுப்பலன் அடைந்து, கழுகுகளைப்போல் செட்டைகளை அடித்து எழும்புவார்கள்; ஓடினாலும் இளைக்கமாட்டார்கள், நடந்தாலும் சோர்ந்துபோகமாட்டார்கள். (ஏசாயா 40:31)"
];

/* ===== YOUTH VERSE (under 25) ===== */
const youthVerses = [
  "உன் வாலிபப் பிராயத்திலே உன் சிருஷ்டிகரை நினை; தீமையான நாட்கள் வருமுன்னும், எனக்கு இவைகளில் பிரியமில்லை என்று சொல்லுவாய் என்னும் வருஷங்கள் சேருமுன்னும் அதை நினை. (பிரசங்கி 12:1)"
];

/* ===== ELDER VERSE (60 and above) ===== */
const elderVerses = [
  "நீதிமான் பனைமரத்தைப்போல் செழிப்பான்; லீபனோனிலுள்ள கேதுருமரம்போல் வளருவான். கர்த்தருடைய ஆலயத்திலே நாட்டப்பட்டவர்களாய், நம்முடைய தேவனுடைய பிரகாரங்களிலே செழிப்பார்கள். அவர்கள் முதிர்வயதிலும் கனிகொடுத்து, சாரமும் பசுமையுமாயிருப்பார்கள். (சங்கீதம் 92:12-14)"
];

/* ===== WEDDING VERSES ===== */
const weddingVerses = [
  "ஆகையால் ஒரு மனுஷன் தன் தகப்பனையும் தன் தாயையும் விட்டு, தன் மனைவியோடே இசைந்திருப்பான்; அவர்கள் ஒரே மாம்சமாவார்கள். (ஆதியாகமம் 2:24)",

  "ஆகையால் அவர்கள் இருவராயிராமல் ஒரே மாம்சமாயிருக்கிறார்கள்; ஆதலால் தேவன் இணைத்ததை மனுஷன் பிரிக்காதிருக்கட்டும். (மத்தேயு 19:6)",

  "அன்பு நீடிய பொறுமையுள்ளது, அன்பு தயவுள்ளது, அன்பு வேகாது, அன்பு மேட்டிமைப்படாது, அன்பு பொங்காது. (1 கொரிந்தியர் 13:4)"
];

/* ===== HELPERS ===== */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const normalize = (t) =>
  t.replace(/\s+/g, " ")
   .replace(" -அவர்களை", "-அவர்களை")
   .trim();

/* ===== AGE ===== */

const getAge = (dob) => {
  if (!dob) return null;

  const today = new Date();
  const birth = new Date(dob);

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();

  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

/* ===== VERSE SELECTION ===== */

const getBirthdayVerse = (member) => {
  const age = getAge(member.dob);

  if (!age) return pick(birthdayVerses);
  if (age <= 25) return pick(youthVerses);
  if (age >= 60) return pick(elderVerses);

  return pick(birthdayVerses);
};

const getWeddingVerse = () => pick(weddingVerses);

/* ===== MAIN ===== */

export const enhanceTamil = async (text, context = {}) => {
  try {
    let t = normalize(text);

    let verse = "";

    if (context.type === "birthday") {
      verse = getBirthdayVerse(context.member);
    }

    if (context.type === "wedding") {
      verse = getWeddingVerse();
    }

    if (!verse) return t;

    return `${t}\n\n📖 ${verse}`;
  } catch {
    return text;
  }
};

/* ===== DUPLICATE DETECTION ===== */

export const detectDuplicateAI = async (name, existingNames) => {
  const lower = name.toLowerCase();

  return existingNames.filter((n) => {
    const ln = n.toLowerCase();
    return ln.includes(lower) || lower.includes(ln);
  });
};