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
