# AI Greeting Generation & Scripture Pipeline

The application features a hybrid greeting pipeline designed for theological accuracy, natural pastoral tone, and fault tolerance.

---

## 1. Pipeline Architecture

```mermaid
flowchart TD
    A[Celebrant Event Detected] --> B{Retrieve Scripture}
    
    B -->|Check Database| C[EventVerse Collection]
    B -->|Fallback| D[Curated Canonical Bible Verses: TAOVBSI]
    
    C --> E[Selected Verse & Reference]
    D --> E
    
    E --> F{Check AICache}
    F -->|Cache Hit| G[Use Cached Pastoral Prayer]
    F -->|Cache Miss| H{Is GEMINI_API_KEY Configured?}
    
    H -->|Yes| I[Call Google Gemini 1.5 Flash API]
    H -->|No / Timeout / Rate Limit| J[Use Curated Deterministic Tamil Blessing]
    
    I -->|Success| K[Sanitize & Save to AICache]
    I -->|Error / Malformed| J
    
    K --> L[Format Complete Greeting Card]
    J --> L
    G --> L
    
    L --> M[Persist to GreetingLog: READY_FOR_REVIEW]
    M --> N[Admin Telegram Review Deck]
```

---

## 2. Scripture Grounding & Integrity Principles

1. **No AI Hallucinations:** The Gemini API is **never** asked to generate, guess, or quote Bible verses. 
2. **Canonical Bible Storage:** Canonical verses are drawn strictly from stored databases (`Bible` / `EventVerse`) or hardcoded immutable references from the Tamil Aruna Old Version (Bible Society of India).
3. **Prompt Injection Protection:** Member names and inputs are passed to prompts with strict delimiters and rules preventing prompt manipulation.
4. **Tamil Unicode Preservation:** All Unicode strings (including combining vowels, viramas, and diacritics) are normalized using UTF-8 without byte truncation.

---

## 3. Greeting Styles & Tone Variations

The system supports four distinct pastoral styles selectable via inline buttons:

- **Pastoral (Default):** Warm, reverent blessing from a church shepherd. Emphasizes God's grace, peace, and spiritual strength.
- **Heartfelt:** Deeply affectionate, personal Christian blessing celebrating life and marriage.
- **Short & Simple:** 1–2 sentence concise, elegant greeting suitable for fast reading.
- **Formal:** Traditional church greeting on behalf of Salem Primitive Baptist Church.

---

## 4. WhatsApp Greeting Card Formatting

The finalized card rendered for the administrator follows a structured format:

```text
🎂 **இனிய பிறந்தநாள் நல்வாழ்த்துகள்!** 🎂
🎉 **சகோ. டேவிட் சாலமன்**

📖 **வேத வசனம்:**
_கர்த்தர் உன்னை ஆசீர்வதித்து, உன்னைக் காக்கக்கடவர். (எண்ணாகமம் 6:24-26)_

🙏 **ஜெபமும் ஆசீர்வாதமும்:**
கர்த்தராகிய இயேசு கிறிஸ்து உங்கள் புதிய வயதிலே தம்முடைய விசேஷித்த கிருபையினாலும் வழிநடத்துதலினாலும் உங்களை ஆசீர்வதித்து காத்துக்கொள்வாராக.

⛪ *சேலம் ஆதி பாப்திஸ்து திருச்சபை (SPBC)*
```
