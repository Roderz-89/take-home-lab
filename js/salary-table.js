/* Take-home pay table: jump to the row nearest the salary typed. */
(function () {
  "use strict";
  var input = document.getElementById("st-find"), msg = document.getElementById("st-msg");
  var rows = [].slice.call(document.querySelectorAll("#st-table tbody tr"));
  if (!input || !msg || !rows.length) return;
  input.addEventListener("input", function () {
    var v = parseFloat(input.value);
    rows.forEach(function (r) { r.classList.remove("is-hit"); });
    if (!isFinite(v) || v <= 0) { msg.textContent = "Type a salary to jump to the nearest row."; return; }
    var best = rows[0], d = Infinity;
    rows.forEach(function (r) { var x = Math.abs(+r.getAttribute("data-g") - v); if (x < d) { d = x; best = r; } });
    best.classList.add("is-hit");
    best.scrollIntoView({ block: "center", behavior: "smooth" });
    var c = best.children;
    msg.textContent = "Nearest row: " + c[0].textContent + " pays " + c[3].textContent + " a year, " + c[4].textContent + " a month." + (d ? " For an exact figure use the calculator." : "");
  });
})();
