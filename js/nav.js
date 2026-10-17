(function () {
  var btn = document.getElementById("menu-btn");
  var nav = document.getElementById("nav");
  if (btn && nav) {
    btn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Close" : "Menu";
    });
  }
  // Show "scroll sideways" hints only when a table is wider than its box.
  var boxes = document.querySelectorAll(".tw");
  if (!boxes.length) return;
  function check() {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i], hint = b.nextElementSibling;
      if (hint && hint.classList.contains("tw-hint")) hint.hidden = b.scrollWidth <= b.clientWidth + 1;
    }
  }
  check();
  window.addEventListener("load", check);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(check);
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(check, 150); });
})();
