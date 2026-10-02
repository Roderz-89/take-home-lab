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
    // Keep Google Search Console HTML verification file intact.
    const path = url.pathname;
    if (
      path.toLowerCase().endsWith(".html") &&
      !/^\/google[a-z0-9]+\.html$/i.test(path)
    ) {
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
