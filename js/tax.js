/**
 * Take-Home Lab — illustrative 2026/27 PAYE estimator.
 * Sources: HMRC employer rates 2026–27; Finance Act 2026; gov.scot Scottish bands 2026–27;
 * GOV.UK student loan collection from 6 April 2026.
 * Not personalised tax advice. NI is modelled on an annual basis (real PAYE NI is per pay period).
 */
(function () {
  const TY = "2026/27";

  const PA = 12570;
  const PA_TAPER_START = 100000;
  const PA_GONE = 125140;

  const RUK = [
    { to: 37700, rate: 0.20, name: "Basic 20%" },
    { to: 125140 - PA, rate: 0.40, name: "Higher 40%" },
    { to: Infinity, rate: 0.45, name: "Additional 45%" }
  ];

  const SCOT = [
    { to: 16537 - PA, rate: 0.19, name: "Starter 19%" },
    { to: 29526 - PA, rate: 0.20, name: "Basic 20%" },
    { to: 43662 - PA, rate: 0.21, name: "Intermediate 21%" },
    { to: 75000 - PA, rate: 0.42, name: "Higher 42%" },
    { to: 125140 - PA, rate: 0.45, name: "Advanced 45%" },
    { to: Infinity, rate: 0.48, name: "Top 48%" }
  ];

  const NI_PT = 12570;
  const NI_UEL = 50270;
  const NI_MAIN = 0.08;
  const NI_UPPER = 0.02;

  const SL = {
    none: { threshold: Infinity, rate: 0, label: "None" },
    plan1: { threshold: 26900, rate: 0.09, label: "Plan 1" },
    plan2: { threshold: 29385, rate: 0.09, label: "Plan 2" },
    plan4: { threshold: 33795, rate: 0.09, label: "Plan 4" },
    plan5: { threshold: 25000, rate: 0.09, label: "Plan 5" },
    pgl: { threshold: 21000, rate: 0.06, label: "Postgraduate" }
  };

  function money(n) {
    const v = Math.round(n * 100) / 100;
    return v.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
  }

  function personalAllowance(incomeForTaper) {
    if (incomeForTaper <= PA_TAPER_START) return PA;
    const cut = Math.floor((incomeForTaper - PA_TAPER_START) / 2);
    return Math.max(0, PA - cut);
  }

  function taxOnTaxable(taxable, bands) {
    let remaining = Math.max(0, taxable);
    let prev = 0;
    let tax = 0;
    const parts = [];
    for (const b of bands) {
      const width = b.to - prev;
      const slice = Math.min(remaining, Math.max(0, width));
      if (slice > 0) {
        const amt = slice * b.rate;
        tax += amt;
        parts.push({ name: b.name, amount: slice, tax: amt, rate: b.rate });
        remaining -= slice;
      }
      prev = b.to;
      if (remaining <= 0) break;
    }
    return { tax, parts };
  }

  function calc(input) {
    const gross = Math.max(0, Number(input.gross) || 0);
    const bonus = Math.max(0, Number(input.bonus) || 0);
    const headline = gross + bonus;
    const pct = Math.max(0, Math.min(100, Number(input.pensionPct) || 0));
    const pensionCash = headline * (pct / 100);
    const scheme = input.pensionType || "none";

    let payForTax = headline;
    let payForNi = headline;
    if (scheme === "sacrifice") {
      payForTax = Math.max(0, headline - pensionCash);
      payForNi = Math.max(0, headline - pensionCash);
    } else if (scheme === "netpay") {
      payForTax = Math.max(0, headline - pensionCash);
    }

    const allowance = personalAllowance(payForTax);
    const taxable = Math.max(0, payForTax - allowance);
    const bands = input.region === "scotland" ? SCOT : RUK;
    const { tax, parts } = taxOnTaxable(taxable, bands);

    const niBand = Math.max(0, Math.min(payForNi, NI_UEL) - NI_PT);
    const niUpper = Math.max(0, payForNi - NI_UEL);
    const ni = niBand * NI_MAIN + niUpper * NI_UPPER;

    const slKey = input.studentLoan || "none";
    const slDef = SL[slKey] || SL.none;
    const slBase = payForNi;
    const studentLoan = slBase > slDef.threshold ? (slBase - slDef.threshold) * slDef.rate : 0;

    const pensionOut = scheme === "none" ? 0 : pensionCash;
    const takeHome = headline - tax - ni - studentLoan - pensionOut;

    return {
      ty: TY,
      headline,
      allowance,
      taxable,
      tax,
      parts,
      ni,
      studentLoan,
      slLabel: slDef.label,
      pensionOut,
      takeHome,
      monthly: takeHome / 12,
      weekly: takeHome / 52,
      effective: headline > 0 ? 1 - takeHome / headline : 0
    };
  }

  function render(r) {
    const el = (id) => document.getElementById(id);
    if (!el("out-annual")) return;
    el("out-annual").textContent = money(r.takeHome);
    el("out-monthly").textContent = money(r.monthly) + " a month";
    el("out-weekly").textContent = money(r.weekly) + " a week";
    el("cell-gross").textContent = money(r.headline);
    el("cell-tax").textContent = money(r.tax);
    el("cell-ni").textContent = money(r.ni);
    el("cell-sl").textContent = money(r.studentLoan);
    el("cell-pen").textContent = money(r.pensionOut);
    el("cell-net").textContent = money(r.takeHome);
    el("cell-pa").textContent = money(r.allowance);

    const g = r.headline || 1;
    const setW = (id, n) => { const nEl = document.getElementById(id); if (nEl) nEl.style.width = Math.min(100, (Math.max(0, n) / g) * 100) + "%"; };
    setW("bar-keep", r.takeHome);
    setW("bar-tax", r.tax);
    setW("bar-ni", r.ni);
    setW("bar-sl", r.studentLoan);
    setW("bar-pen", r.pensionOut);

    const parts = document.getElementById("tax-parts");
    if (parts) {
      parts.innerHTML = r.parts.length
        ? r.parts.map((p) => `<li>${p.name}: ${money(p.tax)} on ${money(p.amount)}</li>`).join("")
        : "<li>No income tax on this illustration.</li>";
    }
  }

  function readForm() {
    return {
      gross: document.getElementById("gross").value,
      bonus: document.getElementById("bonus").value,
      region: document.getElementById("region").value,
      pensionType: document.getElementById("pensionType").value,
      pensionPct: document.getElementById("pensionPct").value,
      studentLoan: document.getElementById("studentLoan").value
    };
  }

  function run() {
    render(calc(readForm()));
  }

  function loadExample(which) {
    const examples = {
      a: { gross: 35000, bonus: 0, region: "ruk", pensionType: "none", pensionPct: 0, studentLoan: "none" },
      b: { gross: 35000, bonus: 0, region: "ruk", pensionType: "sacrifice", pensionPct: 5, studentLoan: "plan2" },
      c: { gross: 45000, bonus: 0, region: "scotland", pensionType: "none", pensionPct: 0, studentLoan: "plan4" }
    };
    const e = examples[which] || examples.a;
    Object.keys(e).forEach((k) => {
      const node = document.getElementById(k);
      if (node) node.value = e[k];
    });
    run();
    document.getElementById("calculator").scrollIntoView({ behavior: "smooth" });
  }

  window.TakeHomeLab = { calc, money, run, loadExample, TY };

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("th-form");
    if (!form) return;
    form.addEventListener("input", run);
    form.addEventListener("change", run);
    document.querySelectorAll("[data-example]").forEach((btn) => {
      btn.addEventListener("click", () => loadExample(btn.getAttribute("data-example")));
    });
    run();
  });
})();
