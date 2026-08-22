const fs = require("fs");

const aiService = `/* ===============================
   TAMIL BIBLE ENGINE - TAOVBSI
   (Tamil Aruna Old Version, Bible Society of India)
   =============================== */

/* ===== BIRTHDAY VERSES (general) ===== */
const birthdayVerses = [
  "கர்த்தர் உன்னை ஆசீர்வதித்து, உன்னைக் காக்கக்கடவர். கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரகாசிக்கப்பண்ணி, உன்மேல் கிருபையாயிருக்கக்கடவர். கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரசன்னமாக்கி, உனக்குச் சமாதானம் கட்டளையிடக்கடவர். (எண்ணாகமம் 6:24-26)",

  "உன் சுயபுத்தியின்மேல் சாயாமல், உன் முழு இருதயத்தோடும் கர்த்தரில் நம்பிக்கையாயிருந்து, உன் வழிகளிலெல்லாம் அவரை நினைத்துக்கொள்; அப்பொழுது அவர் உன் பாதைகளைச் செவ்வைப்படுத்துவார். (நீதிமொழிகள் 3:5-6)",

  "கர்த்தர் என் மேய்ப்பராயிருக்கிறார்; நான் தாழ்ச்சியடையேன். அவர் என்னைப்புல்லுள்ள இடங்களில் கிடத்தி, அமர்ந்த தண்ணீரண்டையில் என்னைக் கொண்டுபோய் விடுகிறார். அவர் என் ஆத்துமாவைத் தேற்றி, தம்முடைய நாமத்தினிமித்தம் என்னை நீதியின் பாதைகளில் நடத்துகிறார். (சங்கீதம் 23:1-3)",

  "உன் வழியைக் கர்த்தருக்கு ஒப்புவித்து, அவர்மேல் நம்பிக்கையாயிரு; அவரே காரியத்தை வாய்க்கப்பண்ணுவார். (சங்கீதம் 37:5)",

  "கர்த்தர் உன்னை எல்லாத் தீங்குக்கும் விலக்கிக் காப்பார்; அவர் உன் ஆத்துமாவைக் காப்பார். (சங்கீதம் 121:7)",

  "கர்த்தருக்குக் காத்திருக்கிறவர்களோ புதுப்பெலன் அடைந்து, கழுகுகளைப்போலச் சட்டைகளை அடித்து எழும்புவார்கள்; அவர்கள் ஓடினாலும் இளைப்படையார்கள், நடந்தாலும் சோர்ந்துபோகார்கள். (ஏசாயா 40:31)"
];

/* ===== YOUTH VERSE (under 25) ===== */
const youthVerses = [
  "வாலிபன் தன் வழியை எதினால் சுத்தம்பண்ணுவான்? உமது வசனத்தின்படி தன்னைக் காத்துக்கொள்ளுவதினால்தானே. (சங்கீதம் 119:9)"
];

/* ===== ELDER VERSE (60 and above) ===== */
const elderVerses = [
  "நீதிமான் பனைமரத்தைப்போல் செழிப்பான்; லீபனோனிலுள்ள கேதுருமரம்போல் வளருவான். கர்த்தருடைய ஆலயத்திலே நாட்டப்பட்டவர்களாய், நம்முடைய தேவனுடைய பிரகாரங்களிலே செழிப்பார்கள். அவர்கள் முதிர்வயதிலும் கனிகொடுத்து, சாரமும் பசுமையுமாயிருப்பார்கள். (சங்கீதம் 92:12-14)"
];

/* ===== WEDDING VERSES ===== */
const weddingVerses = [
  "இதினிமித்தம் புருஷன் தன் தகப்பனையும் தன் தாயையும் விட்டு, தன் மனைவியோடே இசைந்திருப்பான்; அவர்கள் ஒரே மாம்சமாயிருப்பார்கள். (ஆதியாகமம் 2:24)",

  "இப்படி இருக்கிறபடியினால், அவர்கள் இருவராயிராமல், ஒரே மாம்சமாயிருக்கிறார்கள்; ஆகையால், தேவன் இணைத்ததை மனுஷன் பிரிக்காதிருக்கக்கடவன். (மத்தேயு 19:6)",

  "அன்பு நீடிய சாந்தமும் தயவுமுள்ளது; அன்புக்குப் பொறாமையில்லை; அன்பு தன்னைப் புகழாது, இறுமாப்பாயிராது. (1 கொரிந்தியர் 13:4)"
];

/* ===== HELPERS ===== */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const normalize = (t) =>
  t.replace(/\\s+/g, " ")
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

    return \`\${t}\\n\\n📖 \${verse}\`;
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
`;

fs.writeFileSync("src/services/aiService.js", aiService, "utf8");
