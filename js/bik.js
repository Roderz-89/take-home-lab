/* Take-Home Lab — benefit-in-kind calculators (2026/27).
 * Needs js/tax.js loaded first: the extra income tax is the difference between
 * income tax on (salary + benefit) and on salary alone, so band edges and the
 * personal allowance taper are handled by the same engine as the main calculator.
 *
 * Sources (checked 13 November 2026):
 *  - Company car appropriate percentages 2026 to 2027: HMRC EIM24705 / 480 Appendix 2.
 *  - Car fuel benefit multiplier 2026 to 2027: £29,200.
 *  - Official rate of interest: 3.75% from 6 April 2026 (HMRC Agent Update 141).
 *  - Employer Class 1A NIC: 15%.
 */
(function () {
  "use strict";

  const FUEL_MULTIPLIER = 29200;
  const OFFICIAL_RATE = 3.75;
  const CLASS_1A = 0.15;
  const LOAN_EXEMPT_LIMIT = 10000;
  const MAX_CAPITAL_CONTRIBUTION = 5000;

  const num = (v) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : 0; };
  const clampMonths = (m) => Math.min(12, Math.max(0, Math.round(num(m) || 0)));

  // Appropriate percentage for a company car, 2026/27.
  // fuel: "electric" | "petrol" (petrol, hybrid, RDE2 diesel) | "diesel" (diesel not meeting RDE2)
  function carPct(co2, range, fuel) {
    co2 = Math.floor(num(co2));
    if (fuel === "electric" || co2 === 0) return 4;
    let pct;
    if (co2 <= 50) {
      range = num(range);
      pct = range >= 130 ? 4 : range >= 70 ? 7 : range >= 40 ? 10 : range >= 30 ? 14 : 16;
    } else if (co2 <= 54) pct = 17;
    else if (co2 <= 59) pct = 18;
    else if (co2 <= 64) pct = 19;
    else if (co2 <= 69) pct = 20;
    else if (co2 <= 79) pct = 21; // 70 to 74 and 75 to 79 are both 21%
    else pct = 22 + Math.floor((co2 - 80) / 5);
    if (fuel === "diesel") pct += 4;
    return Math.min(37, pct);
  }

  function carBenefit(o) {
    const pct = carPct(o.co2, o.range, o.fuel);
    const months = o.months == null ? 12 : clampMonths(o.months);
    const price = Math.max(0, num(o.listPrice) - Math.min(MAX_CAPITAL_CONTRIBUTION, num(o.capital)));
    const car = Math.max(0, price * pct / 100 * months / 12 - num(o.privateUse));
    const electric = o.fuel === "electric" || Math.floor(num(o.co2)) === 0;
    const fuel = o.fuelProvided && !electric ? FUEL_MULTIPLIER * pct / 100 * months / 12 : 0;
    return { pct, car, fuel, total: car + fuel };
  }

  // Normal averaging method. The £10,000 test uses the highest balance in the year.
  function loanBenefit(o) {
    const open = num(o.open), close = num(o.close);
    const highest = Math.max(open, close, num(o.highest));
    const months = o.months == null ? 12 : clampMonths(o.months);
    const rate = o.rate == null || o.rate === "" ? OFFICIAL_RATE : num(o.rate);
    if (highest <= LOAN_EXEMPT_LIMIT) return { exempt: true, average: (open + close) / 2, atOfficial: 0, benefit: 0, rate };
    const average = (open + close) / 2;
    const atOfficial = average * rate / 100 * months / 12;
    return { exempt: false, average, atOfficial, benefit: Math.max(0, atOfficial - num(o.interestPaid)), rate };
  }

  function pmiBenefit(o) {
    const months = o.months == null ? 12 : clampMonths(o.months);
    return { benefit: Math.max(0, num(o.premium) * months / 12 - num(o.contribution)) };
  }

  // Extra income tax from adding a benefit on top of salary. No NI and no student loan
  // is due from the employee on a benefit in kind.
  function extraTax(salary, benefit, region) {
    const T = window.TakeHomeLab;
    const base = { bonus: 0, region: region || "ruk", pensionType: "none", pensionPct: 0, studentLoan: "none" };
    const run = (g) => T.calc(Object.assign({}, base, { gross: g })).tax;
    return Math.max(0, run(num(salary) + num(benefit)) - run(num(salary)));
  }

  // Tax code if the benefit is collected through the code (standard allowance only).
  function taxCode(salary, benefit) {
    if (num(salary) + num(benefit) > 100000) return null;
    const allowance = 12570 - num(benefit);
    return allowance > 0 ? Math.floor(allowance / 10) + "L" : null;
  }

  window.TakeHomeBik = { carPct, carBenefit, loanBenefit, pmiBenefit, extraTax, taxCode, FUEL_MULTIPLIER, OFFICIAL_RATE, CLASS_1A };

  // ---------- page binding ----------
  const gbp = (n) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function bind(root) {
    const kind = root.getAttribute("data-bik");
    const f = (name) => { const e = root.querySelector('[data-f="' + name + '"]'); return e ? (e.type === "checkbox" ? e.checked : e.value) : undefined; };
    const out = (name, text) => { const e = root.querySelector('[data-o="' + name + '"]'); if (e) e.textContent = text; };
    const show = (name, on) => { const e = root.querySelector('[data-show="' + name + '"]'); if (e) e.hidden = !on; };

    function update() {
      const salary = num(f("salary")), region = f("region") || "ruk";
      let benefit = 0;
      if (kind === "pmi") {
        benefit = pmiBenefit({ premium: f("premium"), months: f("months"), contribution: f("contribution") }).benefit;
        const code = taxCode(salary, benefit);
        out("code", code ? code : "depends on your other income");
      } else if (kind === "loan") {
        const r = loanBenefit({ open: f("open"), close: f("close"), highest: f("highest"), months: f("months"), rate: f("rate"), interestPaid: f("interestPaid") });
        benefit = r.benefit;
        out("average", gbp(r.average));
        out("atOfficial", r.exempt ? "Exempt" : gbp(r.atOfficial));
        show("exempt", r.exempt);
      } else if (kind === "car") {
        const fuel = f("fuel");
        const r = carBenefit({ listPrice: f("listPrice"), capital: f("capital"), co2: fuel === "electric" ? 0 : f("co2"), range: f("range"), fuel, months: f("months"), privateUse: f("privateUse"), fuelProvided: f("fuelProvided") });
        benefit = r.total;
        out("pct", r.pct + "%");
        out("car", gbp(r.car));
        out("fuel", gbp(r.fuel));
        const co2 = Math.floor(num(f("co2")));
        show("range", fuel !== "electric" && co2 >= 1 && co2 <= 50);
        show("co2", fuel !== "electric");
        show("fuelrow", fuel !== "electric");
      }
      const tax = extraTax(salary, benefit, region);
      out("benefit", gbp(benefit));
      out("tax", gbp(tax));
      out("monthly", gbp(tax / 12) + " a month");
      out("rate", benefit > 0 ? (Math.round(tax / benefit * 1000) / 10) + "%" : "—");
      out("employer", gbp(benefit * CLASS_1A));
    }
    root.addEventListener("input", update);
    root.addEventListener("change", update);
    const form = root.querySelector("form");
    if (form) form.addEventListener("submit", (e) => e.preventDefault());
    update();
  }

  if (typeof document !== "undefined" && document.querySelectorAll) {
    const start = () => document.querySelectorAll("[data-bik]").forEach(bind);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
  }
})();
