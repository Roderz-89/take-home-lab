/* Ad placement safety (AdSense policy: no ads that can shift or crowd interactive
 * controls). Every ad slot on every page must sit after the last calculator on that
 * page (form, results panel or BIK card), and never inside one.
 * Run: node tests/ad-placement.test.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name.startsWith(".") || d.name === "node_modules" ? [] : htmlFiles(p);
    return d.name.endsWith(".html") ? [p] : [];
  });
}

const CALC_END = [/<\/form>/g, /id="result"/g, /class="calc-card[^"]*"/g];
let pass = 0, fail = 0;
for (const file of htmlFiles(root)) {
  const s = fs.readFileSync(file, "utf8");
  const ads = [...s.matchAll(/<aside class="ad-slot/g)].map((m) => m.index);
  if (!ads.length) continue;
  let lastCalc = -1;
  for (const re of CALC_END) for (const m of s.matchAll(re)) lastCalc = Math.max(lastCalc, m.index);
  // BIK calculator cards: count the whole card, up to its closing </section>.
  for (const m of s.matchAll(/<section class="calc-card[^>]*>[\s\S]*?<\/section>/g)) lastCalc = Math.max(lastCalc, m.index + m[0].length);
  const rel = path.relative(root, file);
  const early = ads.filter((i) => i < lastCalc);
  if (early.length) { fail++; console.log(`FAIL ${rel}: ${early.length} ad slot(s) above or inside a calculator`); }
  else { pass++; }
}
console.log(`${pass}/${pass + fail} pages with ads passed`);
process.exit(fail ? 1 : 0);
