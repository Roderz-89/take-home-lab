/**
 * Take-Home Lab — assets Worker with canonical host + HTTPS.
 * www → apex 301; http → https 301; then serve static assets.
 * Optional HSTS once redirects are in place.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWww = url.hostname === "www.takehomelab.co.uk";
    const isHttp = url.protocol === "http:";

    if (isWww || isHttp) {
      if (isWww) url.hostname = "takehomelab.co.uk";
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
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

    const response = await env.ASSETS.fetch(request);
      // If assets try to redirect the verify file, re-fetch without following and
      // serve the object directly by asking for the raw asset path again.
      if (response.status >= 300 && response.status < 400) {
        const raw = new URL(request.url);
        // Assets may map /googleX.html → /googleX; force file fetch via ASSETS
        // by requesting the same URL through a no-redirect client isn't available,
        // so serve a tiny inline verify body from the known filename.
        const name = path.slice(1);
        const inline = await env.ASSETS.fetch(new Request(new URL("/" + name, url), request));
        // Fall through: return whatever ASSETS gives for the exact path when possible.
      }
      const headers = new Headers(response.headers);
      headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      // If redirected, synthesize 200 with verification token content from known file.
      if (response.status >= 300 && response.status < 400) {
        const token = path.slice(1); // google….html
        return new Response("google-site-verification: " + token + "\n", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
          },
        });
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
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

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
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
