/* Scans tracked text files for UTF-8-read-as-cp1252 mojibake and leading BOMs. */
const fs = require("fs");
const { execSync } = require("child_process");

const MOJI = /[À-ÿ][-ÿ–—‘-”†-•€ŒœŽž™]/g;

const files = execSync("git ls-files").toString().trim().split(/\r?\n/);

for (const f of files) {
  if (!/\.(js|html|css|json|md)$/.test(f)) continue;
  const b = fs.readFileSync(f);
  const s = b.toString("utf8");
  const runs = (s.match(MOJI) || []).length;
  const bom = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf;
  if (runs || bom) {
    console.log(f.padEnd(34), "mojibake:", String(runs).padEnd(5), "BOM:", bom);
  }
}
