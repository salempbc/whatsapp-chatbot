/* ===============================
   TAMIL BIBLE ENGINE (STRICT BSI O.V. N.F.)
   =============================== */

/* ===== FULL EXACT VERSES ===== */

const birthdayVerses = [
  "கர்த்தர் உன்னை ஆசீர்வதித்து உன்னை காக்கும்; கர்த்தர் தம் முகத்தை உன்னிடத்தில் பிரகாசிக்கச் செய்து உன்னிடத்தில் கிருபையாயிருப்பாராக; கர்த்தர் தம் முகத்தை உன்னிடத்தில் உயர்த்தி உனக்கு சமாதானம் அளிப்பாராக. (எண்ணாகமம் 6:24-26)",

  "நீ உன் இருதயமெல்லாம் கர்த்தரை நம்பி, உன் சொந்த புத்தியின்மேல் சார்ந்திராதே; உன் எல்லா வழிகளிலும் அவரை அறிவாய்; அப்பொழுது அவர் உன் பாதைகளைச் செம்மைப்படுத்துவார். (நீதிமொழிகள் 3:5-6)",

  "கர்த்தர் என் மேய்ப்பான்; எனக்குக் குறைவில்லை. அவர் என்னை பசுமையான புல்வெளிகளில் படுக்கவைத்து, அமைதியான நீர்நிலைகளிடத்தில் நடத்துகிறார்; என் ஆத்துமாவை மீட்டெடுக்கிறார். (சங்கீதம் 23:1-3)",

  "உன் வழிகளை கர்த்தருக்குப் ஒப்படை; அவர்மேல் நம்பிக்கையாயிரு; அவர் செய்தருளுவார். (சங்கீதம் 37:5)",

  "கர்த்தர் உன்னை எல்லாத் தீமையிலிருந்தும் காக்குவார்; அவர் உன் ஆத்துமாவைக் காக்குவார். (சங்கீதம் 121:7)",

  "கர்த்தருக்காகக் காத்திருக்கிறவர்கள் புதிய பலனை அடைந்து, கழுகுகளைப்போல சிறகுகளை விரித்து எழும்புவார்கள்; அவர்கள் ஓடினாலும் சோர்வடையமாட்டார்கள்; நடந்தாலும் இளைப்பாறமாட்டார்கள். (ஏசாயா 40:31)"
];

const youthVerses = [
  "உன் இளமையில் உன் சிருஷ்டிகரனை நினை; தீய நாட்கள் வரும்முன் நினை. (பிரசங்கி 12:1)"
];

const elderVerses = [
  "நீதிமான்கள் பனைமரம்போல வளர்ந்து, லெபனோன் தேவருகம்போல உயர்வார்கள்; அவர்கள் முதுமையிலும் கனியுடன் இருப்பார்கள். (சங்கீதம் 92:12-14)"
];

const weddingVerses = [
  "இதனால் மனுஷன் தன் தந்தையையும் தாயையும் விட்டு தன் மனைவியோடு சேர்ந்து, அவர்கள் ஒரே மாம்சமாக இருப்பார்கள். (ஆதியாகமம் 2:24)",

  "ஆகையால் அவர்கள் இனி இருவர் அல்ல, ஒரே மாம்சம்; தேவன் இணைத்ததை மனுஷன் பிரிக்காதிருக்கட்டும். (மத்தேயு 19:6)",

  "அன்பு நீடிய சாந்தமும் தயவும் உடையது; அன்புக்கு பொறாமையில்லை; அன்பு தன்னைப் புகழாது, பெருமை கொள்ளாது. (1 கொரிந்தியர் 13:4)"
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