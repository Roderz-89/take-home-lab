// Tests for tax year + tax code support in js/tax.js (run: node tests/taxcode.test.cjs).
// Expected values are hand calculations from GOV.UK / gov.scot rates:
// 2025/26: rUK 20/40/45 on £37,700 / £125,140; Scottish starter top £15,397, basic top £27,491;
//          NI 8% £12,570–£50,270 then 2%; loans Plan 1 £26,065, Plan 2 £28,470, Plan 4 £32,745,
//          Plan 5 not collected until April 2026, PGL £21,000.
// Flat codes per HMRC Tax Tables B–D: BR 20%, D0 40%, D1 45%; SBR 20%, SD0 21%, SD1 42%, SD2 45%, SD3 48%.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { document: { addEventListener() {} }, console }; ctx.window = ctx;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/tax.js"), "utf8"), ctx);
const T = ctx.TakeHomeLab;
const base = { bonus: 0, region: "ruk", pensionType: "none", pensionPct: 0, studentLoan: "none" };
const r2 = (n) => Math.round(n * 100) / 100;
const cases = [
  // [name, input, expected]
  // 2025/26: tax 20% × 22,430 = 4,486; NI 8% × 22,430 = 1,794.40; Plan 2 9% × 6,530 = 587.70
  ["2025/26 £35k Plan 2", { taxYear: "2025/26", gross: 35000, studentLoan: "plan2" }, { tax: 4486, sl: 587.70, net: 28131.90, ty: "2025/26" }],
  // 2025/26 Scotland £45k: 2,827×19% + 12,094×20% + 16,171×21% + 1,338×42% = 6,913.80; NI 2,594.40
  ["2025/26 £45k Scotland", { taxYear: "2025/26", gross: 45000, region: "scotland" }, { tax: 6913.80, net: 35491.80 }],
  ["2025/26 Plan 5 not collected", { taxYear: "2025/26", gross: 40000, studentLoan: "plan5" }, { sl: 0, plan5NotDue: true }],
  ["2026/27 Plan 5 collected", { gross: 40000, studentLoan: "plan5" }, { sl: 1350, plan5NotDue: false }],
  ["unknown year falls back to 2026/27", { taxYear: "2019/20", gross: 35000 }, { net: 28719.60, ty: "2026/27" }],
  // Tax codes (2026/27)
  ["1257L default", { gross: 35000, taxCode: "1257L" }, { tax: 4486, net: 28719.60, allowance: 12570 }],
  ["blank code = 1257L", { gross: 35000, taxCode: "" }, { net: 28719.60 }],
  ["1100L", { gross: 35000, taxCode: "1100L" }, { tax: 4800, net: 28405.60, allowance: 11000 }],
  ["1383M (marriage allowance)", { gross: 35000, taxCode: "1383M" }, { tax: 4234, net: 28971.60 }],
  ["0T", { gross: 35000, taxCode: "0T" }, { tax: 7000, net: 26205.60, allowance: 0 }],
  ["BR £20k", { gross: 20000, taxCode: "BR" }, { tax: 4000, net: 15405.60 }],
  ["D0 £30k", { gross: 30000, taxCode: "D0" }, { tax: 12000, net: 16605.60 }],
  ["SD1 £30k", { gross: 30000, taxCode: "SD1" }, { tax: 12600, net: 16005.60, region: "scotland" }],
  ["D1 with Scotland region = SD1", { gross: 30000, taxCode: "D1", region: "scotland" }, { tax: 12600 }],
  ["NT", { gross: 35000, taxCode: "NT" }, { tax: 0, net: 33205.60 }],
  // K475: taxable 35,000 + 4,750 = 39,750 → 7,540 + 2,050×40% = 8,360
  ["K475 £35k", { gross: 35000, taxCode: "K475" }, { tax: 8360, net: 24845.60, allowance: -4750 }],
  // K5000 on £10k: band tax 16,460 capped at 50% of pay = 5,000
  ["K5000 £10k capped", { gross: 10000, taxCode: "K5000" }, { tax: 5000, kCapped: true }],
  ["S1257L forces Scotland", { gross: 45000, taxCode: "S1257L", region: "ruk" }, { net: 35523.55, region: "scotland" }],
  ["C1257L forces rUK", { gross: 45000, taxCode: "C1257L", region: "scotland" }, { tax: 6486, region: "ruk" }],
  ["1257L M1 emergency", { gross: 35000, taxCode: "1257L M1" }, { net: 28719.60, codeEmergency: true }],
  ["s1257l w1 lower-case", { gross: 45000, taxCode: " s1257l w1 " }, { net: 35523.55, codeEmergency: true, region: "scotland" }],
  ["1257LX emergency", { gross: 35000, taxCode: "1257LX" }, { net: 28719.60, codeEmergency: true }],
  ["1257L taper still applies at £110k", { gross: 110000, studentLoan: "plan2", pgl: true }, { net: 59762.05 }],
  ["1100L no taper at £110k", { gross: 110000, taxCode: "1100L" }, { allowance: 11000 }],
  ["invalid code falls back", { gross: 35000, taxCode: "ABC" }, { net: 28719.60, hasError: true }],
  ["D2 outside Scotland invalid", { gross: 35000, taxCode: "D2" }, { net: 28719.60, hasError: true }],
];
let fail = 0;
for (const [name, inp, exp] of cases) {
  const r = T.calc(Object.assign({}, base, inp));
  const got = { tax: r2(r.tax), sl: r2(r.studentLoan), net: r2(r.takeHome), allowance: r.allowance, ty: r.taxYear,
    region: r.region, codeEmergency: r.codeEmergency, kCapped: r.kCapped, plan5NotDue: r.plan5NotDue, hasError: !!r.codeError };
  const ok = Object.keys(exp).every((k) => typeof exp[k] === "number" ? Math.abs(got[k] - exp[k]) < 0.005 : got[k] === exp[k]);
  if (!ok) fail++;
  const shown = {}; Object.keys(exp).forEach((k) => (shown[k] = got[k]));
  console.log((ok ? "PASS " : "FAIL ") + name + "  " + JSON.stringify(shown) + (ok ? "" : "  expected " + JSON.stringify(exp)));
}
console.log(cases.length - fail + "/" + cases.length + " passed");
process.exit(fail ? 1 : 0);
