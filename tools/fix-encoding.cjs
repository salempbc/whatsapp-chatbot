/*
 * Repairs text that was UTF-8 but got decoded as cp1252 and re-saved as UTF-8
 * ("mojibake"), and strips leading BOMs.
 *
 * Usage: node tools/fix-encoding.cjs [--write] <file...>
 */
const fs = require("fs");

/* cp1252 codepoints that differ from latin-1, mapped back to their byte. */
const CP1252 = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84,
  "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88,
  "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c,
  "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93,
  "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97,
  "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b,
  "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f
};

const toByte = (ch) => {
  if (ch in CP1252) return CP1252[ch];
  const c = ch.codePointAt(0);
  return c >= 0x80 && c <= 0xff ? c : null;
};

/* A candidate run is a maximal stretch of non-ASCII chars that are all
   reversible to single cp1252 bytes. ASCII is excluded so runs never
   swallow surrounding source code. */
const RUN = new RegExp(
  "[\\u0080-\\u00FF" +
    Object.keys(CP1252).map((c) => "\\u" + c.codePointAt(0).toString(16).padStart(4, "0")).join("") +
    "]+",
  "g"
);

const repair = (text) =>
  text.replace(RUN, (run) => {
    const bytes = [];
    for (const ch of run) {
      const b = toByte(ch);
      if (b === null) return run;
      bytes.push(b);
    }
    const decoded = Buffer.from(bytes).toString("utf8");
    /* Reject if the bytes were not valid UTF-8, or if decoding was a no-op. */
    if (decoded.includes("�") || decoded === run) return run;
    return decoded;
  });

const write = process.argv.includes("--write");
const targets = process.argv.slice(2).filter((a) => a !== "--write");

for (const file of targets) {
  const buf = fs.readFileSync(file);
  const hadBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const original = buf.toString("utf8").replace(/^﻿/, "");
  const fixed = repair(original);

  if (fixed === original && !hadBom) {
    console.log(`  ok      ${file}`);
    continue;
  }

  const changes = fixed === original ? "BOM only" : `${original.length - fixed.length} chars collapsed`;
  console.log(`  ${write ? "fixed  " : "would fix"} ${file}  (${changes}${hadBom ? ", BOM stripped" : ""})`);

  if (write) fs.writeFileSync(file, fixed, "utf8");
}
