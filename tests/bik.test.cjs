// Tests for js/bik.js (run: node tests/bik.test.cjs).
// Expected values are hand calculations, and match the worked examples in the guides.
// Car percentages: HMRC EIM24705, tax year 2026 to 2027. Official rate 3.75%. Fuel multiplier £29,200.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { document: { addEventListener() {} }, console }; ctx.window = ctx;
for (const f of ["tax.js", "bik.js"]) vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js", f), "utf8"), ctx);
const B = ctx.TakeHomeBik;
const r2 = (n) => Math.round(n * 100) / 100;
let pass = 0, fail = 0;
const eq = (name, got, want) => { if (r2(got) === want) pass++; else { fail++; console.log("FAIL", name, "got", got, "want", want); } };

// Company car percentages (every row of the HMRC table)
const P = [[0, 0, 4], [30, 130, 4], [30, 129, 7], [30, 70, 7], [30, 69, 10], [30, 40, 10], [30, 39, 14], [30, 30, 14], [30, 29, 16], [50, 0, 16],
  [51, 0, 17], [54, 0, 17], [55, 0, 18], [60, 0, 19], [65, 0, 20], [70, 0, 21], [74, 0, 21], [75, 0, 21], [79, 0, 21], [80, 0, 22], [85, 0, 23],
  [90, 0, 24], [95, 0, 25], [100, 0, 26], [105, 0, 27], [110, 0, 28], [115, 0, 29], [120, 0, 30], [125, 0, 31], [130, 0, 32], [135, 0, 33],
  [140, 0, 34], [145, 0, 35], [150, 0, 36], [154, 0, 36], [155, 0, 37], [250, 0, 37]];
for (const [co2, range, want] of P) eq(`car pct ${co2}g/${range}mi`, B.carPct(co2, range, "petrol"), want);
eq("diesel supplement 110g", B.carPct(110, 0, "diesel"), 32);
eq("diesel supplement capped", B.carPct(150, 0, "diesel"), 37);
eq("electric ignores co2", B.carPct(120, 0, "electric"), 4);

// Car benefit
let c = B.carBenefit({ listPrice: 40000, fuel: "electric" });
eq("EV £40k benefit", c.car, 1600); eq("EV no fuel benefit", B.carBenefit({ listPrice: 40000, fuel: "electric", fuelProvided: true }).fuel, 0);
eq("EV £40k tax @ £35k", B.extraTax(35000, c.total, "ruk"), 320);
eq("EV £40k tax @ £60k", B.extraTax(60000, c.total, "ruk"), 640);
eq("EV £40k tax Scotland £35k", B.extraTax(35000, c.total, "scotland"), 336);
c = B.carBenefit({ listPrice: 30000, co2: 120, fuel: "petrol" });
eq("petrol 120g benefit", c.car, 9000);
eq("petrol 120g tax @ £35k", B.extraTax(35000, 9000, "ruk"), 1800);
eq("petrol 120g tax @ £48k (crosses 40%)", B.extraTax(48000, 9000, "ruk"), 3146);
eq("petrol 120g tax @ £97k (taper)", B.extraTax(97000, 9000, "ruk"), 4800);
eq("fuel benefit 30%", B.carBenefit({ listPrice: 30000, co2: 120, fuel: "petrol", fuelProvided: true }).fuel, 8760);
eq("PHEV 40-69mi £45k", B.carBenefit({ listPrice: 45000, co2: 30, range: 50, fuel: "petrol" }).car, 4500);
eq("capital contribution capped at £5,000", B.carBenefit({ listPrice: 30000, capital: 8000, co2: 120, fuel: "petrol" }).car, 7500);
eq("private use payment", B.carBenefit({ listPrice: 30000, co2: 120, fuel: "petrol", privateUse: 1000 }).car, 8000);
eq("six months", B.carBenefit({ listPrice: 30000, co2: 120, fuel: "petrol", months: 6 }).car, 4500);

// Beneficial loans
let l = B.loanBenefit({ open: 15000, close: 15000 });
eq("loan £15k benefit", l.benefit, 562.5);
eq("loan £15k tax 20%", B.extraTax(35000, l.benefit, "ruk"), 112.5);
eq("loan £15k tax 40%", B.extraTax(60000, l.benefit, "ruk"), 225);
eq("loan £15k tax Scotland 21%", B.extraTax(35000, l.benefit, "scotland"), 118.13);
eq("loan £15k employer NIC", l.benefit * B.CLASS_1A, 84.38);
eq("loan paid down 12k->6k", B.loanBenefit({ open: 12000, close: 6000 }).benefit, 337.5);
eq("loan low interest", B.loanBenefit({ open: 30000, close: 24000, interestPaid: 270 }).benefit, 742.5);
eq("loan £8k exempt", B.loanBenefit({ open: 8000, close: 8000 }).benefit, 0);
eq("loan exactly £10k exempt", B.loanBenefit({ open: 10000, close: 10000 }).benefit, 0);
eq("loan peaked over £10k mid-year", B.loanBenefit({ open: 9000, close: 9000, highest: 12000 }).benefit, 337.5);
eq("loan six months", B.loanBenefit({ open: 20000, close: 20000, months: 6 }).benefit, 375);
eq("loan custom rate", B.loanBenefit({ open: 20000, close: 20000, rate: 4 }).benefit, 800);

// Private medical insurance
eq("PMI £1,200 @ £35k", B.extraTax(35000, B.pmiBenefit({ premium: 1200 }).benefit, "ruk"), 240);
eq("PMI £1,200 @ £60k", B.extraTax(60000, 1200, "ruk"), 480);
eq("PMI £1,200 Scotland £35k", B.extraTax(35000, 1200, "scotland"), 252);
eq("PMI £1,200 Scotland £60k", B.extraTax(60000, 1200, "scotland"), 504);
eq("PMI £2,400 @ £48k (crosses 40%)", B.extraTax(48000, 2400, "ruk"), 506);
eq("PMI £2,400 @ £98k (taper)", B.extraTax(98000, 2400, "ruk"), 1040);
eq("PMI half year", B.pmiBenefit({ premium: 1200, months: 6 }).benefit, 600);
eq("PMI own contribution", B.pmiBenefit({ premium: 1200, contribution: 300 }).benefit, 900);
if (B.taxCode(35000, 1740) === "1083L") pass++; else { fail++; console.log("FAIL tax code", B.taxCode(35000, 1740)); }

console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
