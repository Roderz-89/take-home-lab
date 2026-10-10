/* Take-Home Lab consent gate (thl-consent).
 * localStorage "thl-consent": "essential" | "all".
 * The AdSense script is injected and slots are pushed only after Accept ads.
 */
(function () {
  var KEY = "thl-consent";
  var SRC = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7612291779397704";
  var slots = document.querySelectorAll("[data-thl-ad]");
  var banner = document.getElementById("thl-consent");
  function setSlots(show) {
    for (var i = 0; i < slots.length; i++) slots[i].hidden = !show;
  }
  function hideBanner() {
    if (!banner) return;
    banner.hidden = true;
    banner.style.display = "none";
  }
  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
    banner.style.display = "flex";
  }
  function loadAds() {
    if (window.__thlAds) return;
    window.__thlAds = true;
    setSlots(true);
    var s = document.createElement("script");
    s.async = true;
    s.src = SRC;
    s.crossOrigin = "anonymous";
    s.onload = function () {
      var nodes = document.querySelectorAll("ins.adsbygoogle");
      for (var i = 0; i < nodes.length; i++) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    };
    document.head.appendChild(s);
  }
  var choice = null;
  try { choice = localStorage.getItem(KEY); } catch (e) {}
  if (choice === "all") {
    hideBanner();
    loadAds();
  } else if (choice === "essential") {
    hideBanner();
    setSlots(false);
  } else {
    setSlots(false);
    showBanner();
  }
  var accept = document.getElementById("thl-accept");
  var essential = document.getElementById("thl-essential");
  if (accept) accept.addEventListener("click", function () {
    try { localStorage.setItem(KEY, "all"); } catch (e) {}
    hideBanner();
    loadAds();
  });
  if (essential) essential.addEventListener("click", function () {
    try { localStorage.setItem(KEY, "essential"); } catch (e) {}
    hideBanner();
    setSlots(false);
  });
})();
