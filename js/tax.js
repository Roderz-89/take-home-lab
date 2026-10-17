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

    // Student loans (HMRC 2026/27): one undergraduate plan at 9% above its threshold
    // plus, at the same time, a Postgraduate Loan at 6% above £21,000. Both are
    // deducted on the same pay, independently. Back-compat: studentLoan "pgl" alone
    // still means a Postgraduate Loan only.
    let ugKey = input.studentLoan || "none";
    let hasPgl = input.pgl === true || input.pgl === "1" || input.pgl === "true" || input.pgl === "on";
    if (ugKey === "pgl") { ugKey = "none"; hasPgl = true; }
    if (!SL[ugKey] || ugKey === "pgl") ugKey = "none";
    const slBase = payForNi;
    const ugDef = SL[ugKey];
    const studentLoanUG = slBase > ugDef.threshold ? (slBase - ugDef.threshold) * ugDef.rate : 0;
    const studentLoanPG = hasPgl && slBase > SL.pgl.threshold ? (slBase - SL.pgl.threshold) * SL.pgl.rate : 0;
    const studentLoan = studentLoanUG + studentLoanPG;
    const slDef = { label: ugKey !== "none" && hasPgl ? ugDef.label + " + Postgraduate" : hasPgl ? SL.pgl.label : ugDef.label };

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
      studentLoanUG,
      studentLoanPG,
      slPlan: ugKey,
      hasPgl,
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
    el("cell-sl").textContent = money(r.studentLoanUG);
    if (el("cell-pgl")) el("cell-pgl").textContent = money(r.studentLoanPG);
    el("cell-pen").textContent = money(r.pensionOut);
    el("cell-net").textContent = money(r.takeHome);
    el("cell-pa").textContent = money(r.allowance);

    // Stacked breakdown bar + legend (£ and % of gross).
    const g = r.headline;
    const segs = { keep: Math.max(0, r.takeHome), tax: r.tax, ni: r.ni, pen: r.pensionOut, sl: r.studentLoanUG, pgl: r.studentLoanPG };
    const names = { keep: "Take-home", tax: "Income tax", ni: "National Insurance", pen: "Pension", sl: r.slPlan && r.slPlan !== "none" ? "Student loan (" + (r.slPlan.replace("plan", "Plan ")) + ")" : "Student loan", pgl: "Postgraduate Loan" };
    const pct = (n) => (g > 0 ? (n / g) * 100 : 0);
    const fmtPct = (n) => pct(n).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
    const bar = el("bd-bar");
    if (bar) {
      const said = [];
      bar.querySelectorAll(".seg").forEach((seg) => {
        const k = seg.getAttribute("data-k");
        const w = g > 0 ? Math.min(100, pct(segs[k])) : 0;
        seg.style.width = w + "%";
        seg.hidden = w <= 0;
        seg.title = names[k] + ": " + money(segs[k]) + " (" + fmtPct(segs[k]) + ")";
        if (segs[k] > 0) said.push(names[k] + " " + money(segs[k]) + ", " + fmtPct(segs[k]));
      });
      bar.setAttribute("aria-label", g > 0 ? "Breakdown of " + money(g) + " gross pay: " + said.join("; ") : "No gross pay entered");
      document.querySelectorAll(".bd-legend li").forEach((li) => {
        const k = li.getAttribute("data-k");
        const pc = document.getElementById("pct-" + k);
        if (pc) pc.textContent = "(" + fmtPct(segs[k]) + ")";
        li.classList.toggle("is-zero", !(segs[k] > 0));
        if (k === "pgl") li.hidden = !r.hasPgl;
      });
      if (el("name-sl")) el("name-sl").textContent = names.sl;
    }

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
      studentLoan: document.getElementById("studentLoan").value,
      pgl: !!(document.getElementById("pgl") && document.getElementById("pgl").checked)
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
    const pg = document.getElementById("pgl");
    if (pg) pg.checked = !!e.pgl;
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
