/* Take-Home Lab contact form: client-side checks, then POST to /api/contact. Works without JS too. */
(function () {
  var form = document.getElementById("cf");
  if (!form) return;
  var status = document.getElementById("cf-status");
  var btn = document.getElementById("cf-submit");
  document.getElementById("cf-t").value = String(Date.now());
  document.getElementById("cf-page").value = document.referrer && document.referrer.indexOf(location.origin) === 0 ? document.referrer.slice(location.origin.length) : "";

  var MSG = {
    ok: "Thank you. Your message has been sent to the Rodway Labs team. We aim to reply within five working days.",
    invalid: "Please check the form: add your name, a valid email address and a message of at least 10 characters.",
    rate: "You have just sent a message. Please wait a minute before sending another.",
    origin: "The message could not be sent from this page. Please email hello@takehomelab.co.uk instead.",
    size: "That message is too long. Please shorten it or email hello@takehomelab.co.uk.",
    send: "Sorry, the message could not be sent just now. Please email hello@takehomelab.co.uk instead.",
    unavailable: "Sorry, the form is unavailable just now. Please email hello@takehomelab.co.uk instead."
  };
  function show(code, ok) {
    status.hidden = false;
    status.className = "form-status " + (ok ? "is-ok" : "is-error");
    status.textContent = MSG[code] || MSG.send;
    status.focus();
  }
  var q = new URLSearchParams(location.search);
  if (q.get("sent") === "1") show("ok", true);
  else if (q.get("error")) show(q.get("error"), false);

  function fieldError(el, bad) {
    if (bad) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    return bad;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var n = form.elements.name, em = form.elements.email, m = form.elements.message;
    var bad = false;
    bad = fieldError(n, !n.value.trim()) || bad;
    bad = fieldError(em, !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) || bad;
    bad = fieldError(m, m.value.trim().length < 10) || bad;
    if (bad) { show("invalid", false); var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    fetch(form.action, { method: "POST", body: new FormData(form), headers: { accept: "application/json" } })
      .then(function (r) { return r.json().catch(function () { return { ok: false, code: "send" }; }); })
      .then(function (d) {
        if (d && d.ok) { form.reset(); document.getElementById("cf-t").value = String(Date.now()); show("ok", true); }
        else show((d && d.code) || "send", false);
      })
      .catch(function () { show("send", false); })
      .then(function () { btn.disabled = false; btn.textContent = "Send message"; });
  });
})();
