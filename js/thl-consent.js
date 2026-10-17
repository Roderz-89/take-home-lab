/* Take-Home Lab consent pop-up (thl-consent), published by Rodway Labs.
 * Mirrors Remortgage Lab's live consent set-up (ConsentModal.tsx, consent.ts,
 * consent-mode.ts, adsense.ts) as of 17 October 2026.
 *
 * CONSENT SWITCH — which consent mechanism the site uses.
 *   "custom": this pop-up. Choice saved in localStorage "thl-consent" as
 *             {"v":3,"ads":true|false,"ts":"<ISO time>"}. adsbygoogle.js loads only
 *             after Consent (or Save choices with Advertising on), and only on pages
 *             with an ad slot (ins.adsbygoogle). Footer "Privacy preferences" reopens
 *             the pop-up. STOPGAP until AdSense approves the site.
 *   "google": Google's certified CMP (AdSense Privacy & messaging), served by the
 *             AdSense tag. adsbygoogle.js loads on slot pages for everyone; this
 *             pop-up is not rendered; "Privacy preferences" calls
 *             googlefc.showRevocationMessage() on slot pages and goes to /cookies
 *             elsewhere. To switch, change CONSENT_MODE to "google" and update the
 *             consent wording on /privacy, /cookies and /advertising.
 *
 * Storage versions:
 *   v3 (current) {v:3, ads:boolean, ts:ISO string}  — same fields as Remortgage Lab.
 *   v2 (earlier) {v:2, choice:"all"|"essential", ts:ms} — migrated once to v3
 *       (all → ads:true, essential → ads:false), keeping the original time.
 *   Anything older or unreadable is treated as unset, so the visitor is asked.
 * If storage is blocked, the choice is remembered for this page view only.
 * No non-personalised or limited-ads signal is sent (no requestNonPersonalizedAds,
 * no pauseAdRequests): with no choice or "Do not consent", nothing ad-related loads.
 * Esc does not dismiss the pop-up: a choice is required.
 */
(function () {
  if (window.__thlConsentInit) return;
  window.__thlConsentInit = true;

  var CONSENT_MODE = "custom"; // "custom" | "google"
  var KEY = "thl-consent";
  var VERSION = 3;
  var SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7612291779397704";
  var doc = document;
  var memoryChoice = null;

  /* ---------- storage ---------- */
  function parse(raw) {
    if (!raw) return null;
    var o;
    try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || typeof o !== "object") return null;
    if (o.v === 3 && typeof o.ads === "boolean") return { ads: o.ads, ts: typeof o.ts === "string" ? o.ts : "" };
    if (o.v === 2 && (o.choice === "all" || o.choice === "essential")) {
      var c = { ads: o.choice === "all", ts: typeof o.ts === "number" ? new Date(o.ts).toISOString() : "" };
      write(c); // one-time migration to v3
      return c;
    }
    return null;
  }
  function write(c) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, ads: c.ads, ts: c.ts })); } catch (e) {}
  }
  function getConsent() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return memoryChoice; }
    if (raw === null) return memoryChoice;
    return parse(raw);
  }
  function hasAdsConsent() { var c = getConsent(); return !!(c && c.ads === true); }
  function saveConsent(ads) {
    var c = { ads: !!ads, ts: new Date().toISOString() };
    memoryChoice = c;
    write(c);
    return c;
  }

  /* ---------- AdSense ---------- */
  function hasSlot() { return !!doc.querySelector("ins.adsbygoogle"); }
  function scriptPresent() {
    var s = doc.scripts;
    for (var i = 0; i < s.length; i++) if (s[i].src && s[i].src.indexOf("pagead/js/adsbygoogle.js") !== -1) return true;
    return false;
  }
  function setSlots(show) {
    var s = doc.querySelectorAll("[data-thl-ad]");
    for (var i = 0; i < s.length; i++) s[i].hidden = !show;
  }
  function loadAds() {
    if (window.__thlAds || !hasSlot()) return; // page without an ad slot: never load AdSense
    if (CONSENT_MODE === "custom" && !hasAdsConsent()) return;
    window.__thlAds = true;
    setSlots(true);
    var s = doc.createElement("script");
    s.async = true;
    s.src = SRC;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-thl-adsense", "true");
    doc.head.appendChild(s);
    var nodes = doc.querySelectorAll("ins.adsbygoogle");
    for (var i = 0; i < nodes.length; i++) {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    }
  }

  function choose(ads) {
    var hadScript = scriptPresent();
    saveConsent(ads);
    close();
    if (ads) loadAds();
    else {
      setSlots(false);
      if (hadScript) location.reload(); // a loaded AdSense script cannot be removed
    }
  }

  /* ---------- pop-up ---------- */
  var root, dialog, title, mainView, optView, mainActs, optActs, toggle, lastFocus, inerted = [];
  var PURPOSES = [
    ["Personalised advertising and content, advertising and content measurement, audience research and services development",
     "Google may use information about your visit and device to choose ads that may interest you, limit how often you see them and measure how they perform."],
    ["Store and/or access information on a device",
     "Cookies, device identifiers or similar technologies may be stored on, or read from, your device. On this site that is only done by Google AdSense, and only if you consent."]
  ];

  function build() {
    if (root) return;
    var list = "", more = "";
    for (var i = 0; i < PURPOSES.length; i++) {
      list += "<li>" + PURPOSES[i][0] + "</li>";
      more += "<p><strong>" + PURPOSES[i][0] + ".</strong> " + PURPOSES[i][1] + "</p>";
    }
    root = doc.createElement("div");
    root.className = "thl-cmp-overlay";
    root.id = "thl-cmp";
    root.setAttribute("data-consent-modal", "");
    root.hidden = true;
    root.innerHTML =
      '<div class="thl-cmp" role="dialog" aria-modal="true" aria-labelledby="thl-cmp-title" aria-describedby="thl-cmp-desc" tabindex="-1">' +
        '<div class="thl-cmp-body">' +
          '<h2 id="thl-cmp-title">Take-Home Lab asks for your consent to use your personal data to:</h2>' +
          '<div id="thl-cmp-desc" class="thl-cmp-view-main">' +
            '<ul class="thl-cmp-list">' + list + '</ul>' +
            '<details class="thl-cmp-purposes"><summary>Learn more</summary>' +
              '<div class="thl-cmp-more">' + more +
                '<p>Strictly necessary Cloudflare security cookies (such as __cf_bm or cf_clearance) are always on and are not part of this choice. We don\u2019t use analytics cookies.</p>' +
              '</div>' +
            '</details>' +
            '<p>Your personal data will be processed and information from your device (cookies, unique identifiers, and other device data) may be stored by, accessed by and shared with <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Google, our advertising partner</a>, or used specifically by this site.</p>' +
            '<p>Google may process some data on the basis of legitimate interest, which you can object to under Manage options. You can change or withdraw your consent at any time with <strong>Privacy preferences</strong> at the bottom of every page.</p>' +
          '</div>' +
          '<div class="thl-cmp-view-opt" hidden>' +
            '<p id="thl-cmp-optdesc">Choose what you allow on this site. Google AdSense is our only advertising partner.</p>' +
            '<div class="thl-cmp-options">' +
              '<div class="thl-cmp-row">' +
                '<div><strong>Strictly necessary</strong><br><span>Cloudflare security cookies (such as __cf_bm or cf_clearance, about 30 minutes) and your saved choice. Needed to run the site.</span></div>' +
                '<span class="thl-cmp-always">Always on</span>' +
              '</div>' +
              '<div class="thl-cmp-row">' +
                '<div><strong id="thl-cmp-ads-l">Advertising (Google AdSense)</strong><br><span id="thl-cmp-ads-d">Store and/or access information on a device, and personalised advertising and ad measurement by Google AdSense. Off means no ads are loaded.</span></div>' +
                '<button type="button" role="switch" aria-checked="false" aria-labelledby="thl-cmp-ads-l" aria-describedby="thl-cmp-ads-d" class="thl-cmp-switch" id="thl-cmp-ads"><span class="thl-sr">Off</span></button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<p class="thl-cmp-note">You don\u2019t need to consent to use the calculator. Your choices apply to this site only. More in our <a href="/privacy">privacy policy</a> and <a href="/cookies">cookie policy</a>.</p>' +
        '</div>' +
        '<div class="thl-cmp-actions thl-cmp-acts-main">' +
          '<button type="button" class="thl-cmp-btn" data-thl-act="options">Manage options</button>' +
          '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="deny">Do not consent</button>' +
          '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="consent">Consent</button>' +
        '</div>' +
        '<div class="thl-cmp-actions thl-cmp-acts-opt" hidden>' +
          '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="deny">Do not consent</button>' +
          '<button type="button" class="thl-cmp-btn" data-thl-act="save">Save choices</button>' +
          '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="consent">Consent</button>' +
          '<button type="button" class="thl-cmp-back" data-thl-act="back">Back</button>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(root);
    dialog = root.querySelector(".thl-cmp");
    title = root.querySelector("#thl-cmp-title");
    mainView = root.querySelector(".thl-cmp-view-main");
    optView = root.querySelector(".thl-cmp-view-opt");
    mainActs = root.querySelector(".thl-cmp-acts-main");
    optActs = root.querySelector(".thl-cmp-acts-opt");
    toggle = root.querySelector("#thl-cmp-ads");

    root.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-thl-act]") : null;
      if (b) {
        var act = b.getAttribute("data-thl-act");
        if (act === "consent") choose(true);
        else if (act === "deny") choose(false);
        else if (act === "save") choose(toggle.getAttribute("aria-checked") === "true");
        else if (act === "options") showView("options");
        else if (act === "back") showView("main");
        return;
      }
      if (e.target.closest && e.target.closest("#thl-cmp-ads")) setToggle(toggle.getAttribute("aria-checked") !== "true");
    });
    doc.addEventListener("keydown", onKey, true);
  }

  function setToggle(on) {
    toggle.setAttribute("aria-checked", on ? "true" : "false");
    toggle.firstChild.textContent = on ? "On" : "Off";
  }
  function showView(v) {
    var opt = v === "options";
    if (opt) setToggle(hasAdsConsent());
    title.textContent = opt ? "Manage options" : "Take-Home Lab asks for your consent to use your personal data to:";
    mainView.hidden = opt; mainActs.hidden = opt;
    optView.hidden = !opt; optActs.hidden = !opt;
    mainView.id = opt ? "" : "thl-cmp-desc";
    optView.querySelector("p").id = opt ? "thl-cmp-desc" : "thl-cmp-optdesc";
    (opt ? toggle : dialog).focus();
  }

  function focusables() {
    var list = dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i].getClientRects().length) out.push(list[i]);
    return out;
  }
  function onKey(e) {
    if (!root || root.hidden) return;
    if (e.key === "Escape" || e.key === "Esc") { e.preventDefault(); e.stopPropagation(); return; } // a choice is required
    if (e.key !== "Tab") return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = doc.activeElement;
    if (e.shiftKey && (a === first || a === dialog || !dialog.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !dialog.contains(a))) { e.preventDefault(); first.focus(); }
  }

  function open() {
    build();
    if (!root.hidden) return;
    lastFocus = doc.activeElement;
    root.hidden = false;
    showView("main");
    doc.documentElement.classList.add("thl-cmp-open");
    inerted = [];
    var kids = doc.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === root || k.tagName === "SCRIPT" || k.hasAttribute("inert")) continue;
      k.setAttribute("inert", "");
      inerted.push(k);
    }
    dialog.focus();
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    doc.documentElement.classList.remove("thl-cmp-open");
    for (var i = 0; i < inerted.length; i++) inerted[i].removeAttribute("inert");
    inerted = [];
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- footer "Privacy preferences" ---------- */
  function privacyPreferences() {
    if (CONSENT_MODE === "custom") { open(); return; }
    if (scriptPresent()) {
      window.googlefc = window.googlefc || {};
      window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
      window.googlefc.callbackQueue.push(function () {
        if (window.googlefc.showRevocationMessage) window.googlefc.showRevocationMessage();
      });
      return;
    }
    location.href = "/cookies";
  }
  window.thlPrivacyPreferences = privacyPreferences;
  doc.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-thl-privacy]") : null;
    if (!t) return;
    e.preventDefault();
    privacyPreferences();
  });
  var pp = doc.querySelectorAll("[data-thl-privacy]");
  for (var j = 0; j < pp.length; j++) if (CONSENT_MODE === "custom") pp[j].setAttribute("aria-haspopup", "dialog");

  // Another tab changed the choice: follow it.
  window.addEventListener("storage", function (e) {
    if (e.key !== null && e.key !== KEY) return;
    var c = getConsent();
    if (c && root && !root.hidden) close();
    if (c && c.ads) loadAds();
    else if (c && !c.ads && window.__thlAds) location.reload();
  });

  function init() {
    if (CONSENT_MODE === "google") { loadAds(); return; }
    var c = getConsent();
    if (c && c.ads) loadAds();
    else setSlots(false);
    if (!c) open(); // no choice yet: ask on every page
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
