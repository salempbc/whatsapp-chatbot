import mongoose from "mongoose";
import Member from "../models/Member.js";
import ChurchEvent from "../models/ChurchEvent.js";
import { getUpcomingEvents } from "./eventService.js";

/**
 * Curated Canonical Tamil Bible Old Version (BSI - பரிசுத்த வேதாகமம் O.V.)
 * Weekly Meditation Scripture Passages
 */
const WEEKLY_MEDITATION_VERSES_BSI = [
  {
    ref: "சங்கீதம் 23:1",
    text: "கர்த்தர் என் மேய்ப்பராயிருக்கிறார்; நான் தாழ்ச்சியடையேன்."
  },
  {
    ref: "சங்கீதம் 118:24",
    text: "இது கர்த்தர் உண்டுபண்ணின நாள்; இதிலே களிகூர்ந்து மகிழக்கடவோம்."
  },
  {
    ref: "யோசுவா 24:15",
    text: "நானும் என் வீட்டாருமோவென்றால், கர்த்தரையே சேவிப்போம்."
  },
  {
    ref: "ஏசாயா 40:31",
    text: "கர்த்தருக்குக் காத்திருக்கிறவர்களோ புதுப்பெலன் அடைந்து, கழுகுகளைப்போலச் செட்டைகளை அடித்து எழும்புவார்கள்; அவர்கள் ஓடினாலும் இளைப்படையார்கள், நடந்தாலும் சோர்ந்துபோகார்கள்."
  },
  {
    ref: "பிலிப்பியர் 4:4",
    text: "எப்பொழுதும் கர்த்தருக்குள் சந்தோஷமாயிருங்கள்; சந்தோஷமாயிருங்கள் என்று மறுபடியும் சொல்லுகிறேன்."
  },
  {
    ref: "நீதிமொழிகள் 3:5-6",
    text: "உன் சுயபுத்தியின்மேல் சாயாமல், உன் முழு இருதயத்தோடும் கர்த்தரில் நம்பிக்கையாயிருந்து; உன் வழிகளிலெல்லாம் அவரை நினைத்துக்கொள்; அப்பொழுது அவர் உன் பாதைகளைச் செவ்வைப்படுத்துவார்."
  },
  {
    ref: "சங்கீதம் 121:1-2",
    text: "எனக்கு ஒத்தாசை வரும் பர்வதங்களுக்கு நேராக என் கண்களை ஏறெடுக்கிறேன். வானத்தையும் பூமியையும் உண்டாக்கின கர்த்தரிடத்திலிருந்து எனக்கு ஒத்தாசை வரும்."
  }
];

/**
 * Get date range string for the week in IST
 */
export const getWeekDateRange = (startDate = new Date()) => {
  const istStart = new Date(startDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const istEnd = new Date(istStart);
  istEnd.setDate(istEnd.getDate() + 6);

  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    startStr: formatDate(istStart),
    endStr: formatDate(istEnd),
    label: `${formatDate(istStart)} முதல் ${formatDate(istEnd)} வரை`
  };
};

/**
 * Generates Weekly Church Bulletin for SPBC
 * Suitable for Telegram and WhatsApp broadcast
 */
export const generateWeeklyBulletin = async (options = {}) => {
  const { startStr, endStr, label } = getWeekDateRange(options.date || new Date());

  // 1. Fetch upcoming celebrations and events (guarded against offline/unconnected DB)
  let birthdays = options.birthdays || [];
  let weddings = options.weddings || [];
  let scheduledEvents = options.events || [];

  if (mongoose.connection.readyState === 1) {
    try {
      if (!options.birthdays || !options.weddings) {
        const up = await getUpcomingEvents(7);
        if (!options.birthdays) birthdays = up.birthdays;
        if (!options.weddings) weddings = up.weddings;
      }
      if (!options.events) {
        scheduledEvents = await ChurchEvent.find({
          startDate: { $gte: startStr, $lte: endStr },
          status: { $ne: "cancelled" }
        }).sort({ startDate: 1, startTime: 1 });
      }
    } catch (err) {
      console.error("Failed to query celebrations/events for bulletin:", err.message);
    }
  }

  // 3. Pick canonical Tamil Bible O.V. BSI verse
  const dayIndex = new Date().getDay(); // 0-6
  const verse = WEEKLY_MEDITATION_VERSES_BSI[dayIndex % WEEKLY_MEDITATION_VERSES_BSI.length];

  // 4. Build WhatsApp plain-text formatted message
  const waLines = [];
  waLines.push("✝️ *சேலம் பழமையான பாப்திஸ்து சபை (SPBC)*");
  waLines.push("📜 *வாராந்திர சபை சுற்றறிக்கை / Weekly Bulletin*");
  waLines.push(`🗓 *காலம்:* ${label}`);
  waLines.push("━━━━━━━━━━━━━━━━━━━━");
  waLines.push("");
  waLines.push("📖 *வாரத்தின் தியான வசனம் (Tamil O.V. BSI):*");
  waLines.push(`"${verse.text}"`);
  waLines.push(`— *${verse.ref}*`);
  waLines.push("");

  waLines.push("⛪ *வாராந்திர ஆராதனைகள் & ஜெபக்கூட்டங்கள்:*");
  waLines.push("• *ஞாயிறு ஆராதனை:* காலை 09:30 AM");
  waLines.push("• *புதன் வேதாகம படிப்பு:* மாலை 07:00 PM");
  waLines.push("• *வெள்ளி உபவாச ஜெபம்:* இரவு 07:30 PM");

  if (scheduledEvents.length > 0) {
    waLines.push("");
    waLines.push("📅 *விசேஷித்த நிகழ்ச்சிகள்:*");
    for (const ev of scheduledEvents) {
      const time = ev.startTime ? ` (${ev.startTime})` : "";
      const venue = ev.venue ? ` - ${ev.venue}` : "";
      waLines.push(`• *${ev.startDate}*${time}: ${ev.title}${venue}`);
    }
  }

  waLines.push("");
  waLines.push("🎂 *இந்த வார பிறந்தநாள் வாழ்த்துகள்:*");
  if (birthdays.length === 0) {
    waLines.push("• இந்த வாரம் பிறந்தநாள் கொண்டாடும் நபர்கள் இல்லை.");
  } else {
    for (const b of birthdays) {
      waLines.push(`• *${b.mmdd}* — ${b.member.name}`);
    }
  }

  waLines.push("");
  waLines.push("💍 *இந்த வார திருமண நாள் வாழ்த்துகள்:*");
  if (weddings.length === 0) {
    waLines.push("• இந்த வாரம் திருமண நாள் கொண்டாடும் தம்பதியர் இல்லை.");
  } else {
    for (const w of weddings) {
      const spouse = w.member.spouseName || "மனைவி/புருஷன்";
      waLines.push(`• *${w.mmdd}* — ${w.member.name} & ${spouse}`);
    }
  }

  waLines.push("");
  waLines.push("📢 *அறிவிப்புகள் / Announcements:*");
  waLines.push("• கர்த்தருடைய நாளில் குடும்பமாய் ஆராதனையில் பங்குபெற்று ஆசீர்வாதம் பெறுங்கள்.");
  waLines.push("• சபை ஊழியங்களுக்காகவும், போதகரின் குடும்பத்திற்காகவும் தொடர்ந்து ஜெபியுங்கள்.");
  waLines.push("");
  waLines.push("━━━━━━━━━━━━━━━━━━━━");
  waLines.push('"தேவன் அன்பாகவே இருக்கிறார்" — 1 யோவான் 4:8');

  const rawWhatsAppText = waLines.join("\n");
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(rawWhatsAppText)}`;

  // 5. Build HTML text for Telegram display
  const tgLines = [];
  tgLines.push("✝️ <b>சேலம் பழமையான பாப்திஸ்து சபை (SPBC)</b>");
  tgLines.push("📜 <b>வாராந்திர சபை சுற்றறிக்கை / Weekly Bulletin</b>");
  tgLines.push(`🗓 <b>காலம்:</b> <code>${label}</code>`);
  tgLines.push("━━━━━━━━━━━━━━━━━━━━");
  tgLines.push("");
  tgLines.push("📖 <b>வாரத்தின் தியான வசனம் (Tamil O.V. BSI):</b>");
  tgLines.push(`<blockquote>"${verse.text}"\n— <b>${verse.ref}</b></blockquote>`);
  tgLines.push("");
  tgLines.push("⛪ <b>வாராந்திர ஆராதனைகள் & ஜெபக்கூட்டங்கள்:</b>");
  tgLines.push("• <b>ஞாயிறு ஆராதனை:</b> காலை 09:30 AM");
  tgLines.push("• <b>புதன் வேதாகம படிப்பு:</b> மாலை 07:00 PM");
  tgLines.push("• <b>வெள்ளி உபவாச ஜெபம்:</b> இரவு 07:30 PM");

  if (scheduledEvents.length > 0) {
    tgLines.push("");
    tgLines.push("📅 <b>விசேஷித்த நிகழ்ச்சிகள்:</b>");
    for (const ev of scheduledEvents) {
      const time = ev.startTime ? ` (${ev.startTime})` : "";
      const venue = ev.venue ? ` - ${ev.venue}` : "";
      tgLines.push(`• <b>${ev.startDate}</b>${time}: ${ev.title}${venue}`);
    }
  }

  tgLines.push("");
  tgLines.push(`🎂 <b>இந்த வார பிறந்தநாள் வாழ்த்துகள் (${birthdays.length}):</b>`);
  if (birthdays.length === 0) {
    tgLines.push("• <i>இந்த வாரம் பிறந்தநாள் கொண்டாடும் நபர்கள் இல்லை.</i>");
  } else {
    for (const b of birthdays) {
      tgLines.push(`• <b>${b.mmdd}</b> — ${b.member.name}`);
    }
  }

  tgLines.push("");
  tgLines.push(`💍 <b>இந்த வார திருமண நாள் வாழ்த்துகள் (${weddings.length}):</b>`);
  if (weddings.length === 0) {
    tgLines.push("• <i>இந்த வாரம் திருமண நாள் கொண்டாடும் தம்பதியர் இல்லை.</i>");
  } else {
    for (const w of weddings) {
      const spouse = w.member.spouseName || "மனைவி/புருஷன்";
      tgLines.push(`• <b>${w.mmdd}</b> — ${w.member.name} & ${spouse}`);
    }
  }

  tgLines.push("");
  tgLines.push("📢 <b>அறிவிப்புகள்:</b>");
  tgLines.push("• கர்த்தருடைய நாளில் குடும்பமாய் ஆராதனையில் பங்குபெறுங்கள்.");
  tgLines.push("• சபை ஊழியங்களுக்காக தொடர்ந்து ஜெபியுங்கள்.");

  const htmlText = tgLines.join("\n");

  return {
    rawWhatsAppText,
    htmlText,
    whatsappUrl,
    verse,
    stats: {
      birthdaysCount: birthdays.length,
      weddingsCount: weddings.length,
      eventsCount: scheduledEvents.length
    }
  };
};
