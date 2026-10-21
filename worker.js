/**
 * Take-Home Lab — assets Worker with canonical host + HTTPS.
 * www → apex 301; http → https 301; then serve static assets.
 * Optional HSTS once redirects are in place.
 */
import { EmailMessage } from "cloudflare:email";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  // Enforced minimal CSP: cannot block ads or consent (no script/frame/connect restrictions).
  "Content-Security-Policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  "Content-Security-Policy-Report-Only":
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.gstatic.com https://*.doubleclick.net https://*.googletagservices.com https://*.adtrafficquality.google; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-src https:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
};

// Known legacy paths: strip .html, /index → dir.
function cleanPath(path) {
  if (!path.toLowerCase().endsWith(".html")) return path;
  let next = path.slice(0, -5);
  if (next.endsWith("/index")) {
    next = next.slice(0, -5);
    if (!next.endsWith("/")) next += "/";
  }
  if (next === "" || next === "/index") next = "/";
  return next;
}

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
    const isWww = url.hostname === "www.takehomelab.co.uk";
    const isHttp = url.protocol === "http:";

    if (isWww || isHttp) {
      if (isWww) url.hostname = "takehomelab.co.uk";
      url.protocol = "https:";
      // Collapse .html / trailing-slash cleanup into the same single 301.
      const p0 = url.pathname;
      if (!/^\/google[a-z0-9]+\.html$/i.test(p0)) {
        url.pathname = cleanPath(p0);
      }
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/contact") {
      const res = await handleContact(request, env, url);
      const h = new Headers(res.headers);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
      h.set("X-Robots-Tag", "noindex");
      return new Response(res.body, { status: res.status, headers: h });
    }

    // Alias for early /guides/50k-take-home slug → series URL
    if (url.pathname === "/guides/50k-take-home" || url.pathname === "/guides/50k-take-home/") {
      url.pathname = "/guides/take-home-50000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for early /guides/40k-take-home slug → series URL
    if (url.pathname === "/guides/40k-take-home" || url.pathname === "/guides/40k-take-home/") {
      url.pathname = "/guides/take-home-40000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for early /guides/25k-take-home slug → series URL
    if (url.pathname === "/guides/25k-take-home" || url.pathname === "/guides/25k-take-home/") {
      url.pathname = "/guides/take-home-25000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for early /guides/60k-take-home slug → series URL
    if (url.pathname === "/guides/60k-take-home" || url.pathname === "/guides/60k-take-home/") {
      url.pathname = "/guides/take-home-60000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/30k-take-home slug → series URL
    if (url.pathname === "/guides/30k-take-home" || url.pathname === "/guides/30k-take-home/") {
      url.pathname = "/guides/take-home-30000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/35k-take-home slug → series URL
    if (url.pathname === "/guides/35k-take-home" || url.pathname === "/guides/35k-take-home/") {
      url.pathname = "/guides/take-home-35000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/45k-take-home slug → series URL
    if (url.pathname === "/guides/45k-take-home" || url.pathname === "/guides/45k-take-home/") {
      url.pathname = "/guides/take-home-45000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/55k-take-home slug → series URL
    if (url.pathname === "/guides/55k-take-home" || url.pathname === "/guides/55k-take-home/") {
      url.pathname = "/guides/take-home-55000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/70k-take-home slug → series URL
    if (url.pathname === "/guides/70k-take-home" || url.pathname === "/guides/70k-take-home/") {
      url.pathname = "/guides/take-home-70000";
      return Response.redirect(url.toString(), 301);
    }

    // Alias for /guides/75k-take-home slug → series URL
    if (url.pathname === "/guides/75k-take-home" || url.pathname === "/guides/75k-take-home/") {
      url.pathname = "/guides/take-home-75000";
      return Response.redirect(url.toString(), 301);
    }

    // Extensionless canonicals: .html aliases → 301 (not 307 from assets).
    // Serve Google HTML verification at the exact .html URL (200), not a redirect.
    const path = url.pathname;
    if (/^\/google[a-z0-9]+\.html$/i.test(path)) {
      const token = path.slice(1);
      return new Response("google-site-verification: " + token + "\n", {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "Strict-Transport-Security":
            "max-age=31536000; includeSubDomains; preload",
        },
      });
    }
    if (path.toLowerCase().endsWith(".html")) {
      let next = path.slice(0, -5); // strip .html
      if (next.endsWith("/index")) {
        next = next.slice(0, -5); // /guides/index → /guides/
        if (!next.endsWith("/")) next += "/";
      }
      if (next === "" || next === "/index") next = "/";
      url.pathname = next;
      return Response.redirect(url.toString(), 301);
    }

    let response = await env.ASSETS.fetch(request);
    // Asset trailing-slash redirects are 307; make them permanent 301s.
    if (response.status === 307 || response.status === 308) {
      const loc = response.headers.get("location");
      if (loc) response = Response.redirect(new URL(loc, url).toString(), 301);
    }
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
    if (url.hostname.endsWith(".pages.dev")) {
      headers.set("X-Robots-Tag", "noindex, nofollow");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
