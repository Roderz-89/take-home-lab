/**
 * Take-Home Lab — illustrative PAYE estimator for 2026/27 (default) and 2025/26.
 * Sources: HMRC rates and thresholds for employers 2025–26 and 2026–27; Finance Act 2026;
 * gov.scot / mygov.scot Scottish bands 2025–26 and 2026–27; HMRC Tax Tables B–D;
 * GOV.UK student loan collection (Employer Bulletin December 2025 for 2026/27).
 * Not personalised tax advice. NI is modelled on an annual basis (real PAYE NI is per pay period).
 */
(function () {
  const TY = "2026/27";
  const DEFAULT_CODE = "1257L";

  const PA = 12570;
  const PA_TAPER_START = 100000;

  // UK (England, Wales, NI) bands: identical in 2025/26 and 2026/27 (frozen to April 2031).
  const RUK = [
    { to: 37700, rate: 0.20, name: "Basic 20%" },
    { to: 125140 - PA, rate: 0.40, name: "Higher 40%" },
    { to: Infinity, rate: 0.45, name: "Additional 45%" }
  ];

  function scotBands(starterTop, basicTop) {
    return [
      { to: starterTop - PA, rate: 0.19, name: "Starter 19%" },
      { to: basicTop - PA, rate: 0.20, name: "Basic 20%" },
      { to: 43662 - PA, rate: 0.21, name: "Intermediate 21%" },
      { to: 75000 - PA, rate: 0.42, name: "Higher 42%" },
      { to: 125140 - PA, rate: 0.45, name: "Advanced 45%" },
      { to: Infinity, rate: 0.48, name: "Top 48%" }
    ];
  }

  // Per-year rates. Only the Scottish starter/basic band tops and the student loan
  // thresholds differ between the two years; NI is 8% / 2% on £12,570–£50,270 in both.
  const YEARS = {
    "2026/27": {
      label: "2026/27", from: "6 April 2026", to: "5 April 2027",
      ruk: RUK, scot: scotBands(16537, 29526),
      ni: { pt: 12570, uel: 50270, main: 0.08, upper: 0.02 },
      sl: { plan1: 26900, plan2: 29385, plan4: 33795, plan5: 25000, pgl: 21000 }
    },
    "2025/26": {
      label: "2025/26", from: "6 April 2025", to: "5 April 2026",
      ruk: RUK, scot: scotBands(15397, 27491),
      ni: { pt: 12570, uel: 50270, main: 0.08, upper: 0.02 },
      // Plan 5 repayments only start from 6 April 2026.
      sl: { plan1: 26065, plan2: 28470, plan4: 32745, plan5: Infinity, pgl: 21000 }
    }
  };

  const SL_LABELS = { none: "None", plan1: "Plan 1", plan2: "Plan 2", plan4: "Plan 4", plan5: "Plan 5", pgl: "Postgraduate" };
  const SL_RATES = { plan1: 0.09, plan2: 0.09, plan4: 0.09, plan5: 0.09, pgl: 0.06 };

  // Flat-rate codes (whole pay taxed at one rate, no allowance).
  const FLAT = {
    ruk: { BR: [0.20, "Basic rate 20%"], D0: [0.40, "Higher rate 40%"], D1: [0.45, "Additional rate 45%"] },
    scotland: { BR: [0.20, "Scottish basic rate 20%"], D0: [0.21, "Scottish intermediate rate 21%"], D1: [0.42, "Scottish higher rate 42%"], D2: [0.45, "Scottish advanced rate 45%"], D3: [0.48, "Scottish top rate 48%"] }
  };

  /**
   * Parse a UK PAYE tax code. Returns { ok, code, region|null, kind, allowance, kAdd,
   * flat, flatName, emergency, standard, error }. `region` is set only when the code
   * carries an S (Scotland) or C (Wales) prefix; otherwise the caller's region applies.
   * kind: "allowance" (e.g. 1257L, 0T), "k" (K475), "flat" (BR, D0, SD1…), "nt" (NT).
   */
  function parseTaxCode(raw, regionHint) {
    let s = String(raw == null ? "" : raw).toUpperCase().replace(/\s+/g, "");
    if (!s) s = DEFAULT_CODE;
    let emergency = false;
    const em = s.match(/^(.*?)(W1\/M1|W1|M1|X|NONCUM)$/);
    if (em && em[1]) { s = em[1]; emergency = true; }
    let region = null;
    const pre = s.match(/^([SC])(?=(\d|K|BR|D\d|0T|NT))/);
    if (pre) { region = pre[1] === "S" ? "scotland" : "ruk"; s = s.slice(1); }
    const effRegion = region || (regionHint === "scotland" ? "scotland" : "ruk");
    const out = { ok: true, code: (pre ? pre[1] : "") + s + (emergency ? " (emergency)" : ""), region, emergency, standard: false, kind: "allowance", allowance: 0, kAdd: 0 };
    let m;
    if (s === "NT") { out.kind = "nt"; return out; }
    if (s === "0T") { out.kind = "allowance"; out.allowance = 0; return out; }
    if ((m = s.match(/^(BR|D[0-3])$/))) {
      const f = FLAT[effRegion][m[1]];
      if (!f) return { ok: false, error: m[1] + " is only used for Scottish taxpayers (as S" + m[1] + ")." };
      out.kind = "flat"; out.flat = f[0]; out.flatName = f[1]; return out;
    }
    if ((m = s.match(/^K(\d{1,4})$/))) { out.kind = "k"; out.kAdd = Number(m[1]) * 10; return out; }
    if ((m = s.match(/^(\d{1,4})([LMNT])?$/))) {
      out.allowance = Number(m[1]) * 10;
      out.standard = Number(m[1]) === 1257 && (m[2] || "L") === "L";
      return out;
    }
    return { ok: false, error: "“" + String(raw).trim() + "” isn’t a tax code we recognise. Examples: 1257L, S1257L, BR, 0T, K475, 1257L M1." };
  }

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
    const year = YEARS[input.taxYear] || YEARS[TY];
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

    // Tax code. An invalid code falls back to 1257L and is reported in codeError.
    let code = parseTaxCode(input.taxCode, input.region);
    let codeError = null;
    if (!code.ok) { codeError = code.error; code = parseTaxCode(DEFAULT_CODE, input.region); }
    const region = code.region || (input.region === "scotland" ? "scotland" : "ruk");
    const bands = region === "scotland" ? year.scot : year.ruk;

    let allowance = 0, taxable = 0, tax = 0, parts = [], kCapped = false;
    if (code.kind === "nt") {
      parts = [];
    } else if (code.kind === "flat") {
      taxable = payForTax;
      tax = payForTax * code.flat;
      if (payForTax > 0) parts = [{ name: code.flatName + " (all pay)", amount: payForTax, tax, rate: code.flat }];
    } else if (code.kind === "k") {
      allowance = -code.kAdd;
      taxable = payForTax > 0 ? payForTax + code.kAdd : 0;
      ({ tax, parts } = taxOnTaxable(taxable, bands));
      // K-code overriding limit: tax can't exceed 50% of the pay it is deducted from.
      if (tax > payForTax * 0.5) { tax = payForTax * 0.5; kCapped = true; }
    } else {
      // 1257L follows the statutory allowance including the £100k taper (HMRC would recode).
      // Any other code is applied as given, as payroll does.
      if (code.standard) {
        allowance = personalAllowance(payForTax);
      } else {
        allowance = code.allowance;
      }
      taxable = Math.max(0, payForTax - allowance);
      ({ tax, parts } = taxOnTaxable(taxable, bands));
    }

    const ni0 = year.ni;
    const niBand = Math.max(0, Math.min(payForNi, ni0.uel) - ni0.pt);
    const niUpper = Math.max(0, payForNi - ni0.uel);
    const ni = niBand * ni0.main + niUpper * ni0.upper;

    // Student loans: one undergraduate plan at 9% above its threshold plus, at the same
    // time, a Postgraduate Loan at 6% above £21,000. Both are deducted on the same pay,
    // independently. Back-compat: studentLoan "pgl" alone still means a Postgraduate Loan only.
    let ugKey = input.studentLoan || "none";
    let hasPgl = input.pgl === true || input.pgl === "1" || input.pgl === "true" || input.pgl === "on";
    if (ugKey === "pgl") { ugKey = "none"; hasPgl = true; }
    if (!SL_LABELS[ugKey] || ugKey === "pgl") ugKey = "none";
    const slBase = payForNi;
    const ugThreshold = ugKey === "none" ? Infinity : year.sl[ugKey];
    const studentLoanUG = slBase > ugThreshold ? (slBase - ugThreshold) * SL_RATES[ugKey] : 0;
    const studentLoanPG = hasPgl && slBase > year.sl.pgl ? (slBase - year.sl.pgl) * SL_RATES.pgl : 0;
    const studentLoan = studentLoanUG + studentLoanPG;
    const slLabel = ugKey !== "none" && hasPgl ? SL_LABELS[ugKey] + " + Postgraduate" : hasPgl ? SL_LABELS.pgl : SL_LABELS[ugKey];

    const pensionOut = scheme === "none" ? 0 : pensionCash;
    const takeHome = headline - tax - ni - studentLoan - pensionOut;

    return {
      ty: year.label,
      taxYear: year.label,
      taxCode: code.code,
      codeKind: code.kind,
      codeRegion: code.region,
      codeEmergency: code.emergency,
      codeError,
      kCapped,
      region,
      plan5NotDue: ugKey === "plan5" && year.sl.plan5 === Infinity,
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
      slLabel,
      pensionOut,
      pensionType: scheme,
      takeHome,
      monthly: takeHome / 12,
      weekly: takeHome / 52,
      effective: headline > 0 ? 1 - takeHome / headline : 0
    };
  }

  // Update labels that depend on the tax year (student loan thresholds, headings).
  function syncYearLabels(tyKey) {
    const y = YEARS[tyKey] || YEARS[TY];
    const fmt = (n) => "£" + n.toLocaleString("en-GB");
    const sel = document.getElementById("studentLoan");
    if (sel) {
      ["plan1", "plan2", "plan4", "plan5"].forEach((k) => {
        const o = sel.querySelector('option[value="' + k + '"]');
        if (!o) return;
        o.textContent = y.sl[k] === Infinity
          ? SL_LABELS[k] + " — no repayments until April 2026"
          : SL_LABELS[k] + " — threshold " + fmt(y.sl[k]) + " at 9%";
      });
    }
    document.querySelectorAll("[data-ty]").forEach((n) => { n.textContent = y.label; });
  }

  function render(r) {
    const el = (id) => document.getElementById(id);
    if (!el("out-annual")) return;
    el("out-annual").textContent = money(r.takeHome);
    el("out-monthly").textContent = money(r.monthly);
    el("out-weekly").textContent = money(r.weekly);
    if (el("sticky-monthly")) el("sticky-monthly").textContent = money(r.monthly) + " a month";
    if (el("cell-pa")) el("cell-pa").textContent = r.allowance < 0 ? "−" + money(-r.allowance) + " (K code adds to taxable pay)" : money(r.allowance);
    if (el("disc-code")) el("disc-code").textContent = r.taxCode.replace(" (emergency)", "");
    const note = el("code-note");
    if (note) {
      const msgs = [];
      if (r.codeError) msgs.push(r.codeError + " Showing 1257L instead.");
      if (r.codeRegion === "scotland" && el("region") && el("region").value !== "scotland") msgs.push("The S prefix means Scottish rates, so Scottish bands are used.");
      if (r.codeRegion === "ruk" && el("region") && el("region").value === "scotland") msgs.push("The C prefix means Welsh rates (same as England), so Scottish bands are not used.");
      if (r.codeEmergency) msgs.push("Emergency (week 1 / month 1) basis: each payslip is taxed on its own. At steady pay the yearly total matches this result; if your pay varies, it won’t.");
      if (r.codeKind === "flat") msgs.push("Every pound from this job is taxed at one rate with no tax-free allowance. Usually a second job or pension.");
      if (r.codeKind === "nt") msgs.push("NT: no income tax is taken from this pay.");
      if (r.kCapped) msgs.push("K code: tax capped at 50% of pay (HMRC’s overriding limit).");
      if (r.plan5NotDue) msgs.push("Plan 5 repayments start from 6 April 2026, so nothing is deducted in 2025/26.");
      note.textContent = msgs.join(" ");
      note.hidden = msgs.length === 0;
      note.classList.toggle("is-error", !!r.codeError);
    }
    const codeInput = el("taxCode");
    if (codeInput) codeInput.setAttribute("aria-invalid", r.codeError ? "true" : "false");

    // Annual / monthly / weekly table. Deductions shown as negatives so the
    // columns read top to bottom: gross, minus deductions, equals take-home.
    const table = el("pb-table");
    if (table) {
      const ded = r.tax + r.ni + r.pensionOut + r.studentLoanUG + r.studentLoanPG;
      const rows = {
        gross: { v: r.headline, sign: 1 },
        tax: { v: r.tax, sign: -1 },
        ni: { v: r.ni, sign: -1 },
        pen: { v: r.pensionOut, sign: -1 },
        sl: { v: r.studentLoanUG, sign: -1 },
        pgl: { v: r.studentLoanPG, sign: -1 },
        ded: { v: ded, sign: -1 },
        keep: { v: r.takeHome, sign: 1 }
      };
      const fmt = (v, sign) => (sign < 0 && v > 0 ? "−" : "") + money(v);
      table.querySelectorAll("tr[data-k]").forEach((tr) => {
        const row = rows[tr.getAttribute("data-k")];
        if (!row) return;
        const cells = tr.querySelectorAll("td");
        [row.v, row.v / 12, row.v / 52].forEach((v, i) => { if (cells[i]) cells[i].textContent = fmt(v, row.sign); });
        tr.classList.toggle("is-zero", !(row.v > 0));
      });
      const pglRow = table.querySelector('tr[data-k="pgl"]');
      if (pglRow) pglRow.hidden = !r.hasPgl;
      const penRow = table.querySelector('tr[data-k="pen"] th');
      if (penRow) penRow.textContent = r.pensionOut > 0 && r.pensionType === "sacrifice" ? "Pension (salary sacrifice)" : r.pensionOut > 0 && r.pensionType === "netpay" ? "Pension (net pay)" : "Pension";
    }

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
      if (el("pb-name-sl")) el("pb-name-sl").textContent = names.sl;
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
      taxYear: document.getElementById("taxYear") ? document.getElementById("taxYear").value : TY,
      taxCode: document.getElementById("taxCode") ? document.getElementById("taxCode").value : DEFAULT_CODE,
      pgl: !!(document.getElementById("pgl") && document.getElementById("pgl").checked)
    };
  }

  function run() {
    const f = readForm();
    syncYearLabels(f.taxYear);
    render(calc(f));
  }

  function loadExample(which) {
    const examples = {
      a: { taxYear: TY, taxCode: DEFAULT_CODE, gross: 35000, bonus: 0, region: "ruk", pensionType: "none", pensionPct: 0, studentLoan: "none" },
      b: { taxYear: TY, taxCode: DEFAULT_CODE, gross: 35000, bonus: 0, region: "ruk", pensionType: "sacrifice", pensionPct: 5, studentLoan: "plan2" },
      c: { taxYear: TY, taxCode: DEFAULT_CODE, gross: 45000, bonus: 0, region: "scotland", pensionType: "none", pensionPct: 0, studentLoan: "plan4" }
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

  window.TakeHomeLab = { calc, money, run, loadExample, parseTaxCode, YEARS, TY };

  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("th-form");
    if (!form) return;
    form.addEventListener("input", run);
    form.addEventListener("change", run);
    document.querySelectorAll("[data-example]").forEach((btn) => {
      btn.addEventListener("click", () => loadExample(btn.getAttribute("data-example")));
    });
    run();

    // Mobile: show the answer in a bottom bar while the form is on screen and the result is not.
    const bar = document.getElementById("sticky-result");
    const out = document.getElementById("result");
    if (bar && out && "IntersectionObserver" in window) {
      const seen = { form: false, out: false };
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { seen[e.target === out ? "out" : "form"] = e.isIntersecting; });
        bar.classList.toggle("is-on", seen.form && !seen.out);
      }, { threshold: 0.05 });
      io.observe(form);
      io.observe(out);
    }
  });
})();
