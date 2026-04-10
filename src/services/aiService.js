import OpenAI from "openai";
import axios from "axios";

const USE_AI = true;
const USE_SARVAM = true;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ================= OPENAI ================= */
const openaiEnhance = async (text) => {
  const prompt = `
Improve this Tamil church message:

Rules:
- Keep meaning same
- Improve grammar
- Add mild poetic tone
- Keep respectful suffix correct

Text:
${text}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7
  });

  return res.choices[0].message.content.trim();
};

/* ================= SARVAM (HF) ================= */
const sarvamEnhance = async (text) => {
  try {
    const res = await axios.post(
      "https://api-inference.huggingface.co/models/sarvamai/sarvam-1",
      { inputs: text },
      {
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`
        }
      }
    );

    return res.data[0]?.generated_text || text;
  } catch {
    return text;
  }
};

/* ================= MAIN ================= */
export const enhanceTamil = async (text) => {
  if (!USE_AI) return text;

  try {
    return await openaiEnhance(text);
  } catch (err) {
    console.log("OpenAI failed → fallback Sarvam");

    if (USE_SARVAM) {
      return await sarvamEnhance(text);
    }

    return text;
  }
};

/* ================= DUPLICATE AI ================= */
export const detectDuplicateAI = async (name, existingNames) => {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Find similar names to "${name}" from:\n${existingNames.join(", ")}`
        }
      ]
    });

    return res.choices[0].message.content;
  } catch {
    return null;
  }
};