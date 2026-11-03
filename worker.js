/**
 * Take-Home Lab — Worker for /api/* only (assets.run_worker_first: ["/api/*"]).
 * Everything else is served directly by Workers static assets:
 *   _redirects  — .html/trailing-slash/legacy-slug 301s
 *   _headers    — security headers on all asset responses
 *   404.html    — not_found_handling "404-page"
 * www → apex and http → https are Cloudflare zone rules (Redirect Rules, Always Use HTTPS).
 */
import { EmailMessage } from "cloudflare:email";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://*.googletagservices.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-src https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

// ---------- Contact form: POST /api/contact → Email Routing (send_email binding) ----------
const CONTACT_FROM = "contact-form@takehomelab.co.uk";
const CONTACT_TO = "interactive.cad.uk@gmail.com";
const TOPICS = {
  figure: "Report a figure error",
  guide: "Question about a guide or the calculator",
  advertising: "Advertising or partnership",
  privacy: "Privacy or data request",
  other: "Something else",
};
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function wrap76(s) { return s.replace(/.{1,76}/g, "$&\r\n"); }
function hdr(s) { return "=?UTF-8?B?" + b64(s) + "?="; }
function clean(v, max) {
  return String(v == null ? "" : v).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}

async function handleContact(request, env, url) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  const reply = (ok, code, status) => wantsJson
    ? new Response(JSON.stringify({ ok, code }), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } })
    : Response.redirect(new URL("/contact?" + (ok ? "sent=1" : "error=" + code) + "#contact-form", url).toString(), 303);

  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
  const origin = request.headers.get("origin");
  if (origin && origin !== "https://takehomelab.co.uk") return reply(false, "origin", 403);
  const len = Number(request.headers.get("content-length") || 0);
  if (len > 20000) return reply(false, "size", 413);

  // Rate limit before anything else: 3 submissions per IP per minute (Workers rate limiting binding).
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (env.CONTACT_RL) {
    const { success } = await env.CONTACT_RL.limit({ key: "contact:" + ip });
    if (!success) return reply(false, "rate", 429);
  }

  let form;
  try { form = await request.formData(); } catch (e) { return reply(false, "invalid", 400); }
  // Honeypot and time trap: pretend success so bots learn nothing.
  if (clean(form.get("website"), 200)) return reply(true, "ok", 200);
  const t = Number(form.get("t") || 0);
  if (t && Date.now() - t < 3000) return reply(true, "ok", 200);

  const name = clean(form.get("name"), 100);
  const email = clean(form.get("email"), 254);
  const topicKey = clean(form.get("topic"), 20);
  const message = clean(form.get("message"), 5000);
  const page = clean(form.get("page"), 200);
  if (!name || !EMAIL_RE.test(email) || !TOPICS[topicKey] || message.length < 10) return reply(false, "invalid", 400);

  if (!env.CONTACT_EMAIL) return reply(false, "unavailable", 503);
  const topic = TOPICS[topicKey];
  const body = [
    "New message from the Take-Home Lab contact form.",
    "",
    "Name: " + name,
    "Email: " + email,
    "Topic: " + topic,
    page ? "Page: " + page : null,
    "Sent: " + new Date().toISOString(),
    "",
    "Message:",
    message,
    "",
    "--",
    "Reply to this email to answer the sender directly.",
  ].filter((l) => l !== null).join("\n");
  const id = "<" + crypto.randomUUID() + "@takehomelab.co.uk>";
  const raw = [
    "From: " + hdr("Take-Home Lab contact form") + " <" + CONTACT_FROM + ">",
    "To: <" + CONTACT_TO + ">",
    "Reply-To: " + hdr(name) + " <" + email + ">",
    "Subject: " + hdr("[Take-Home Lab] " + topic + " — " + name),
    "Message-ID: " + id,
    "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(body)),
  ].join("\r\n");

  try {
    await env.CONTACT_EMAIL.send(new EmailMessage(CONTACT_FROM, CONTACT_TO, raw));
  } catch (e) {
    console.log("contact send failed: " + (e && e.message));
    return reply(false, "send", 502);
  }
  return reply(true, "ok", 200);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      const res = await handleContact(request, env, url);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
      h.set("X-Robots-Tag", "noindex");
      return new Response(res.body, { status: res.status, headers: h });
    }

    // Any other /api/* path: hand to static assets (→ 404.html via not_found_handling).
    return env.ASSETS.fetch(request);
  },
};
