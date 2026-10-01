/**
 * Take-Home Lab — UK/GDPR-sensible advertising consent + gated AdSense.
 * Matches Rodway Labs pattern (rl-ads-consent). Loads AdSense only after Accept.
 * Reject / essential-only → no adsbygoogle.js, no ad units.
 */
(function () {
  var STORAGE_KEY = "rl-ads-consent";
  var CHANGE_EVENT = "rl-consent-change";
  var CLIENT = "ca-pub-7612291779397704";
  var SCRIPT_ATTR = "data-thl-adsense";

  var scriptEl = document.currentScript;
  var cookiesHref =
    (scriptEl && scriptEl.getAttribute("data-cookies")) || "cookies.html";
  var privacyHref =
    (scriptEl && scriptEl.getAttribute("data-privacy")) || "privacy.html";

  function getConsent() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "accepted" || v === "rejected") return v;
    } catch (e) {
      /* private mode */
    }
    return null;
  }

  function setConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      /* ignore */
    }
    try {
      window.dispatchEvent(
        new CustomEvent(CHANGE_EVENT, { detail: value })
      );
    } catch (e2) {
      /* ignore */
    }
  }

  function adsensePresent() {
    if (document.querySelector("script[" + SCRIPT_ATTR + "]")) return true;
    var needle = "pagead/js/adsbygoogle.js?client=" + CLIENT;
    return Array.prototype.some.call(document.scripts, function (s) {
      return s.src && s.src.indexOf(needle) !== -1;
    });
  }

  function showAdSlots(show) {
    var slots = document.querySelectorAll("[data-thl-ad]");
    for (var i = 0; i < slots.length; i++) {
      if (show) slots[i].removeAttribute("hidden");
      else slots[i].setAttribute("hidden", "");
    }
  }

  function fillUnits() {
    var units = document.querySelectorAll(
      "ins.adsbygoogle:not([data-adsbygoogle-status])"
    );
    for (var i = 0; i < units.length; i++) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        /* script may still be booting */
      }
    }
  }

  function injectAdSense() {
    if (getConsent() !== "accepted") return;
    showAdSlots(true);
    if (adsensePresent()) {
      fillUnits();
      return;
    }
    var s = document.createElement("script");
    s.async = true;
    s.src =
      "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
      CLIENT;
    s.crossOrigin = "anonymous";
    s.setAttribute(SCRIPT_ATTR, "true");
    s.addEventListener("load", fillUnits);
    document.head.appendChild(s);
  }

  function hideBanner(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showBanner() {
    if (document.getElementById("thl-cookie-consent")) return;

    var root = document.createElement("div");
    root.id = "thl-cookie-consent";
    root.className = "consent-banner";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-labelledby", "thl-consent-title");
    root.setAttribute("aria-describedby", "thl-consent-desc");

    root.innerHTML =
      '<div class="consent-inner">' +
      '<div class="consent-copy">' +
      '<p id="thl-consent-title" class="consent-title">Cookies &amp; ads</p>' +
      '<p id="thl-consent-desc" class="consent-desc">' +
      "Take-Home Lab (Rodway Labs) uses Google AdSense to help fund the site. " +
      "Advertising cookies load only if you accept. You can reject and keep using " +
      "essential site features. See our " +
      '<a href="' +
      cookiesHref +
      '">cookie notice</a> and ' +
      '<a href="' +
      privacyHref +
      '">privacy notice</a>.' +
      "</p>" +
      "</div>" +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-btn consent-btn-reject" data-consent="rejected">' +
      "Reject / essential only</button>" +
      '<button type="button" class="consent-btn consent-btn-accept" data-consent="accepted">' +
      "Accept</button>" +
      "</div>" +
      "</div>";

    document.body.appendChild(root);

    root.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || !t.getAttribute) return;
      var choice = t.getAttribute("data-consent");
      if (choice !== "accepted" && choice !== "rejected") return;
      setConsent(choice);
      hideBanner(root);
      if (choice === "accepted") injectAdSense();
      else showAdSlots(false);
    });
  }

  function init() {
    var c = getConsent();
    if (c === "accepted") {
      injectAdSense();
      return;
    }
    showAdSlots(false);
    if (c === null) showBanner();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.addEventListener(CHANGE_EVENT, function () {
    if (getConsent() === "accepted") injectAdSense();
    else showAdSlots(false);
  });
})();
