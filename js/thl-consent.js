/* Take-Home Lab consent manager (thl-consent), published by Rodway Labs.
 *
 * Storage: localStorage "thl-consent" = JSON {"v":2,"choice":"essential"|"all","ts":<ms>}.
 * Anything else (including the old plain "essential" / "all" values from the
 * earlier banner) is treated as unset, so everyone is asked once more.
 *
 * - The "We value your privacy" dialog opens on the first visit to any page
 *   when no valid v2 choice is stored.
 * - The AdSense script is injected only on pages that carry an ad slot
 *   (ins.adsbygoogle), and only when the stored choice is "all".
 *   Nothing ad-related is requested before that.
 * - Any [data-thl-privacy] control (footer "Privacy preferences") reopens it.
 * - Esc closes the dialog without saving; it never counts as consent.
 */
(function () {
  if (window.__thlConsentInit) return;
  window.__thlConsentInit = true;

  var KEY = "thl-consent";
  var VERSION = 2;
  var SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7612291779397704";
  var doc = document;

  function getChoice() {
    var raw = null, obj = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return null; }
    if (!raw) return null;
    try { obj = JSON.parse(raw); } catch (e) { obj = null; }
    if (obj && typeof obj === "object" && obj.v === VERSION &&
        (obj.choice === "all" || obj.choice === "essential")) return obj.choice;
    return null; // old plain value or anything unexpected: ask again
  }
  function setChoice(choice) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, choice: choice, ts: Date.now() }));
    } catch (e) {}
  }

  function hasSlot() { return !!doc.querySelector("ins.adsbygoogle"); }
  function setSlots(show) {
    var s = doc.querySelectorAll("[data-thl-ad]");
    for (var i = 0; i < s.length; i++) s[i].hidden = !show;
  }

  function loadAds() {
    if (window.__thlAds || !hasSlot()) return; // non-ad page: never load AdSense
    window.__thlAds = true;
    setSlots(true);
    var s = doc.createElement("script");
    s.async = true;
    s.src = SRC;
    s.crossOrigin = "anonymous";
    s.onload = function () {
      var nodes = doc.querySelectorAll("ins.adsbygoogle");
      for (var i = 0; i < nodes.length; i++) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    };
    doc.head.appendChild(s);
  }

  function apply(choice) {
    setChoice(choice);
    close();
    if (choice === "all") {
      loadAds();
    } else {
      setSlots(false);
      if (window.__thlAds) location.reload(); // ads already loaded: reload so they stop
    }
  }

  /* ---------- dialog ---------- */
  var overlay, dialog, optionsPanel, optionsBtn, adToggle, lastFocus, inerted = [];

  function build() {
    if (overlay) return;
    overlay = doc.createElement("div");
    overlay.className = "thl-cmp-overlay";
    overlay.id = "thl-cmp";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="thl-cmp" role="dialog" aria-modal="true" aria-labelledby="thl-cmp-title" aria-describedby="thl-cmp-intro" tabindex="-1">' +
        '<h2 id="thl-cmp-title">We value your privacy</h2>' +
        '<p id="thl-cmp-intro">Rodway Labs and our advertising partners, including Google AdSense, ask you to consent to cookies and device storage for personalised advertising and ad measurement.</p>' +
        '<div class="thl-cmp-purposes">' +
          '<details><summary>Store and/or access information on a device</summary>' +
            '<p>Cookies, device identifiers or similar data may be stored on or read from your device. If you allow advertising, Google may set cookies such as <code>__gads</code>, <code>__gpi</code> and <code>__eoi</code> on this site and <code>IDE</code> on doubleclick.net. Take-Home Lab itself stores only your choice, under <code>thl-consent</code> in this browser\u2019s localStorage; that is essential and always on.</p>' +
          '</details>' +
          '<details><summary>Personalised advertising and ad measurement (Google)</summary>' +
            '<p>Google AdSense may use information such as the pages you view and data from cookies to choose ads that are relevant to you, measure how they perform and prevent ad fraud. This happens only if you choose Accept All or switch advertising on under Options. Otherwise the AdSense script is never loaded and no ads are requested.</p>' +
          '</details>' +
        '</div>' +
        '<p class="thl-cmp-note">You don\u2019t need to consent to use the calculator, and your choices apply to this site only.</p>' +
        '<div class="thl-cmp-options" id="thl-cmp-options" hidden>' +
          '<div class="thl-cmp-row">' +
            '<div><strong>Essential</strong><br><span>Remembers your privacy choice on this device. Needed for the site to work.</span></div>' +
            '<span class="thl-cmp-always">Always on</span>' +
          '</div>' +
          '<div class="thl-cmp-row">' +
            '<label for="thl-cmp-ads"><strong>Personalised advertising and ad measurement (Google)</strong><br><span>Lets Google AdSense store and/or access information on your device to show personalised ads and measure them.</span></label>' +
            '<input type="checkbox" role="switch" id="thl-cmp-ads" class="thl-cmp-switch">' +
          '</div>' +
          '<div class="thl-cmp-actions">' +
            '<button type="button" class="thl-cmp-btn" data-thl-act="essential">Essential only</button>' +
            '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="save">Save choices</button>' +
          '</div>' +
        '</div>' +
        '<div class="thl-cmp-actions thl-cmp-main">' +
          '<button type="button" class="thl-cmp-btn" data-thl-act="options" aria-expanded="false" aria-controls="thl-cmp-options">Options</button>' +
          '<button type="button" class="thl-cmp-btn thl-cmp-primary" data-thl-act="all">Accept All</button>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(overlay);
    dialog = overlay.querySelector(".thl-cmp");
    optionsPanel = overlay.querySelector("#thl-cmp-options");
    optionsBtn = overlay.querySelector('[data-thl-act="options"]');
    adToggle = overlay.querySelector("#thl-cmp-ads");

    overlay.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-thl-act]") : null;
      if (!b) return;
      var act = b.getAttribute("data-thl-act");
      if (act === "all") apply("all");
      else if (act === "essential") apply("essential");
      else if (act === "save") apply(adToggle.checked ? "all" : "essential");
      else if (act === "options") {
        var show = optionsPanel.hidden;
        optionsPanel.hidden = !show;
        optionsBtn.setAttribute("aria-expanded", show ? "true" : "false");
        if (show) adToggle.focus();
      }
    });
    // Capture so the trap and Esc work wherever focus sits.
    doc.addEventListener("keydown", onKey, true);
  }

  function focusables() {
    var list = dialog.querySelectorAll('button, summary, input, a[href], [tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.disabled || el.getClientRects().length === 0) continue; // skip hidden
      out.push(el);
    }
    return out;
  }

  function onKey(e) {
    if (!overlay || overlay.hidden) return;
    if (e.key === "Escape" || e.key === "Esc") {
      // Esc never counts as consent: close the options panel, or the dialog
      // without saving anything (ads stay off).
      e.preventDefault();
      if (!optionsPanel.hidden) {
        optionsPanel.hidden = true;
        optionsBtn.setAttribute("aria-expanded", "false");
        optionsBtn.focus();
      } else {
        close();
      }
      return;
    }
    if (e.key !== "Tab") return;
    var f = focusables();
    if (!f.length) { e.preventDefault(); dialog.focus(); return; }
    var first = f[0], last = f[f.length - 1], a = doc.activeElement;
    var inside = dialog.contains(a);
    if (e.shiftKey && (!inside || a === first || a === dialog)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (!inside || a === last)) {
      e.preventDefault(); first.focus();
    }
  }

  function open(withOptions) {
    build();
    if (!overlay.hidden) return;
    lastFocus = doc.activeElement;
    adToggle.checked = getChoice() === "all"; // off unless already accepted
    optionsPanel.hidden = !withOptions;
    optionsBtn.setAttribute("aria-expanded", withOptions ? "true" : "false");
    overlay.hidden = false;
    doc.documentElement.classList.add("thl-cmp-open");
    inerted = [];
    var kids = doc.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === overlay || k.tagName === "SCRIPT" || k.hasAttribute("inert")) continue;
      k.setAttribute("inert", "");
      k.setAttribute("aria-hidden", "true");
      inerted.push(k);
    }
    (withOptions ? adToggle : optionsBtn).focus();
  }

  function close() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    doc.documentElement.classList.remove("thl-cmp-open");
    for (var i = 0; i < inerted.length; i++) {
      inerted[i].removeAttribute("inert");
      inerted[i].removeAttribute("aria-hidden");
    }
    inerted = [];
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  window.thlPrivacyPreferences = function () { open(false); };

  doc.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-thl-privacy]") : null;
    if (!t) return;
    e.preventDefault();
    open(false);
  });

  function init() {
    var choice = getChoice();
    if (choice === "all") loadAds();
    else setSlots(false);
    if (choice === null) open(false); // first visit (or pre-v2 choice): ask on every page
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
