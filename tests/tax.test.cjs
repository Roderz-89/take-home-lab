// Unit-style tests for js/tax.js (run: node tests/tax.test.cjs). Expected values are
// hand calculations from GOV.UK 2026/27 rates: PA £12,570 (taper above £100,000),
// rUK 20/40/45, Scottish bands, NI 8% £12,570–£50,270 then 2%, student loans 9% above
// Plan 1 £26,900 / Plan 2 £29,385 / Plan 4 £33,795 / Plan 5 £25,000, PGL 6% above £21,000.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { document: { addEventListener() {} }, console }; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/tax.js"), "utf8"), ctx);
const T = ctx.TakeHomeLab;
const base = { bonus: 0, region: "ruk", pensionType: "none", pensionPct: 0, studentLoan: "none" };
const r2 = (n) => Math.round(n * 100) / 100;
const cases = [
  // [name, input, expected {ug, pg, sl, net}]
  ["£35k Plan 2 only", { gross: 35000, studentLoan: "plan2" }, { ug: 505.35, pg: 0, sl: 505.35, net: 28214.25 }],
  ["£35k PGL only (legacy studentLoan=pgl)", { gross: 35000, studentLoan: "pgl" }, { ug: 0, pg: 840, sl: 840, net: 27879.60 }],
  ["£35k PGL only (pgl flag)", { gross: 35000, pgl: true }, { ug: 0, pg: 840, sl: 840, net: 27879.60 }],
  ["£35k Plan 2 + PGL", { gross: 35000, studentLoan: "plan2", pgl: true }, { ug: 505.35, pg: 840, sl: 1345.35, net: 27374.25 }],
  ["£40k Plan 1 + PGL", { gross: 40000, studentLoan: "plan1", pgl: true }, { ug: 1179, pg: 1140, sl: 2319, net: 30000.60 }],
  ["£45k Scotland Plan 4 + PGL", { gross: 45000, region: "scotland", studentLoan: "plan4", pgl: true }, { ug: 1008.45, pg: 1440, sl: 2448.45, net: 33075.10 }],
  ["£28k Plan 5 + PGL", { gross: 28000, studentLoan: "plan5", pgl: true }, { ug: 270, pg: 420, sl: 690, net: 22989.60 }],
  ["£24k Plan 2 + PGL (below Plan 2 only)", { gross: 24000, studentLoan: "plan2", pgl: "1" }, { ug: 0, pg: 180, sl: 180, net: 20619.60 }],
  // £20k: tax 20% × £7,430 = £1,486; NI 8% × £7,430 = £594.40
  ["£20k Plan 5 + PGL (below both)", { gross: 20000, studentLoan: "plan5", pgl: true }, { ug: 0, pg: 0, sl: 0, net: 17919.60 }],
  ["£50k 5% sacrifice Plan 2 + PGL", { gross: 50000, pensionType: "sacrifice", pensionPct: 5, studentLoan: "plan2", pgl: true }, { ug: 1630.35, pg: 1590, sl: 3220.35, net: 34499.25 }],
  ["£30k 5% net pay Plan 2 + PGL", { gross: 30000, pensionType: "netpay", pensionPct: 5, studentLoan: "plan2", pgl: true }, { ug: 55.35, pg: 540, sl: 595.35, net: 23324.25 }],
  ["£110k Plan 2 + PGL (taper)", { gross: 110000, studentLoan: "plan2", pgl: true }, { ug: 7255.35, pg: 5340, sl: 12595.35, net: 59762.05 }],
  ["£35k no loan (baseline unchanged)", { gross: 35000 }, { ug: 0, pg: 0, sl: 0, net: 28719.60 }],
  // £37k: tax 20% × £24,430 = £4,886; NI £1,954.40; loans 9% × £7,615 + 6% × £16,000
  ["£32k + £5k bonus Plan 2 + PGL", { gross: 32000, bonus: 5000, studentLoan: "plan2", pgl: true }, { ug: 685.35, pg: 960, sl: 1645.35, net: 28514.25 }],
  ["pgl=false keeps Plan 2 only", { gross: 35000, studentLoan: "plan2", pgl: false }, { ug: 505.35, pg: 0, sl: 505.35, net: 28214.25 }],
];
let fail = 0;
for (const [name, inp, exp] of cases) {
  const r = T.calc(Object.assign({}, base, inp));
  const got = { ug: r2(r.studentLoanUG), pg: r2(r.studentLoanPG), sl: r2(r.studentLoan), net: r2(r.takeHome) };
  const ok = Object.keys(exp).every((k) => Math.abs(got[k] - exp[k]) < 0.005);
  if (!ok) fail++;
  console.log((ok ? "PASS " : "FAIL ") + name + "  " + JSON.stringify(got) + (ok ? "" : "  expected " + JSON.stringify(exp)));
}
console.log(cases.length - fail + "/" + cases.length + " passed");
process.exit(fail ? 1 : 0);
