/**
 * 🎨 SPBC Church CMS — WhatsApp / Social Status Card Canvas Generator
 *
 * Renders high-resolution (1080x1350, 4:5 ratio) celebrant image cards with:
 * - Royal deep church gradient & golden border ornamentation
 * - Rounded celebrant photo with gold ring frame
 * - Tamil BSI Scripture verse and pastoral blessing
 * - Church branding: Salem Primitive Baptist Church (SPBC)
 */

export const generateCelebrationCard = async ({
  member = {},
  type = "birthday",
  text = "",
  photoSrc = null
} = {}) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext("2d");

  // 1. Background Gradient (Deep Navy to Royal Violet)
  const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
  bgGrad.addColorStop(0, "#090d16");
  bgGrad.addColorStop(0.3, "#111827");
  bgGrad.addColorStop(0.7, "#1e1b4b");
  bgGrad.addColorStop(1, "#311042");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1080, 1350);

  // Radial gold ambient glow behind center
  const glow = ctx.createRadialGradient(540, 500, 50, 540, 500, 450);
  glow.addColorStop(0, "rgba(245, 158, 11, 0.18)");
  glow.addColorStop(0.6, "rgba(124, 58, 237, 0.12)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1080, 1350);

  // 2. Decorative Gold Borders and Corner Accents
  ctx.save();
  ctx.strokeStyle = "rgba(245, 158, 11, 0.65)";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 1000, 1270);

  ctx.strokeStyle = "rgba(245, 158, 11, 0.3)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, 52, 976, 1246);

  // Corner ornaments
  const corners = [
    [40, 40], [1040, 40], [40, 1310], [1040, 1310]
  ];
  ctx.fillStyle = "#f59e0b";
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Top Church Header
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24"; // Gold
  ctx.font = "bold 32px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("✝", 540, 100);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 30px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  ctx.fillText("சேலம் பழமையான பாப்திஸ்து சபை", 540, 142);

  ctx.fillStyle = "#94a3b8"; // Slate-400
  ctx.font = "500 18px 'Plus Jakarta Sans', sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("SALEM PRIMITIVE BAPTIST CHURCH (SPBC)", 540, 172);

  // 4. Occasion Badge Pill
  const isWedding = type === "wedding";
  const occasionTitle = isWedding ? "💍 திருமண நாள் நல்வாழ்த்துகள் 💍" : "🎂 பிறந்தநாள் நல்வாழ்த்துகள் 🎂";

  ctx.save();
  ctx.fillStyle = isWedding ? "rgba(225, 29, 72, 0.25)" : "rgba(79, 70, 229, 0.35)";
  ctx.strokeStyle = isWedding ? "#f43f5e" : "#818cf8";
  ctx.lineWidth = 2;

  const pillWidth = 480;
  const pillHeight = 50;
  const pillX = (1080 - pillWidth) / 2;
  const pillY = 215;
  const radius = 25;

  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  ctx.fillText(occasionTitle, 540, pillY + 33);
  ctx.restore();

  // 5. Celebrant Portrait / Monogram
  const avatarSize = 220;
  const avatarX = 540;
  const avatarY = 410;

  let loadedImg = null;
  if (photoSrc) {
    try {
      loadedImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = photoSrc;
      });
    } catch (_) {}
  }

  ctx.save();
  // Gold Ring Outer Shadow
  ctx.shadowColor = "rgba(245, 158, 11, 0.5)";
  ctx.shadowBlur = 30;
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2 + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (loadedImg) {
    ctx.drawImage(
      loadedImg,
      avatarX - avatarSize / 2,
      avatarY - avatarSize / 2,
      avatarSize,
      avatarSize
    );
  } else {
    // Beautiful fallback monogram
    const grad = ctx.createLinearGradient(
      avatarX - avatarSize / 2,
      avatarY - avatarSize / 2,
      avatarX + avatarSize / 2,
      avatarY + avatarSize / 2
    );
    grad.addColorStop(0, "#4f46e5");
    grad.addColorStop(1, "#9333ea");
    ctx.fillStyle = grad;
    ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);

    const name = member.name || "SPBC";
    const initials = name
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 76px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, avatarX, avatarY + 4);
  }
  ctx.restore();

  // 6. Celebrant Name
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  const celebrantName = isWedding && member.spouseName
    ? `${member.name} & ${member.spouseName}`
    : (member.name || "சபை விசுவாசி");
  ctx.fillText(celebrantName, 540, 570);

  if (member.role || member.familyName) {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "500 20px 'Plus Jakarta Sans', sans-serif";
    const sub = [member.role, member.familyName ? `🏡 ${member.familyName}` : ""].filter(Boolean).join(" • ");
    ctx.fillText(sub, 540, 606);
  }

  // 7. Scripture Quote Box (Translucent Glassmorphism)
  const boxX = 90;
  const boxY = 645;
  const boxW = 900;
  const boxH = 460;

  ctx.save();
  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 20);
  ctx.fill();
  ctx.stroke();

  // Decorative quote icon
  ctx.fillStyle = "rgba(245, 158, 11, 0.4)";
  ctx.font = "bold 70px serif";
  ctx.fillText("“", boxX + 60, boxY + 75);

  // Extract verse or clean greeting lines
  const cleanLines = text
    ? text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.includes("SPBC") && !l.includes("வாழ்த்துகள்") && !l.includes("WhatsApp"))
    : ["கர்த்தர் உன்னை ஆசீர்வதித்து, உன்னைக் காக்கக்கடவர்;", "கர்த்தர் தம்முடைய முகத்தை உன்மேல் பிரகாசிக்கப்பண்ணி, உன்மேல் கிருபையாயிருக்கக்கடவர்."];

  ctx.fillStyle = "#f8fafc";
  ctx.font = "500 23px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  ctx.textAlign = "center";

  let startTextY = boxY + 95;
  const maxLineLength = 52;

  // Simple text wrapper
  const wrappedLines = [];
  for (const line of cleanLines.slice(0, 6)) {
    if (line.length <= maxLineLength) {
      wrappedLines.push(line);
    } else {
      const words = line.split(" ");
      let current = "";
      for (const w of words) {
        if ((current + " " + w).length <= maxLineLength) {
          current += (current ? " " : "") + w;
        } else {
          wrappedLines.push(current);
          current = w;
        }
      }
      if (current) wrappedLines.push(current);
    }
  }

  for (const wLine of wrappedLines.slice(0, 9)) {
    ctx.fillText(wLine, 540, startTextY);
    startTextY += 38;
  }
  ctx.restore();

  // 8. Footer Blessing and Pastor Signature
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  ctx.font = "italic 20px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  ctx.fillText("“நன்மையும் கிருபையும் உங்களைத் தொடரும்” — சங்கீதம் 23:6", 540, 1150);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "600 18px 'Plus Jakarta Sans', 'Noto Sans Tamil', sans-serif";
  ctx.fillText("அன்புடன்: போதகர் மற்றும் சபை குடும்பத்தினர் | SPBC", 540, 1220);

  return canvas.toDataURL("image/png");
};
