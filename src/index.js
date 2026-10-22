const BASE_PATH = "/secure";
const COUNTRY_CODE = /^[A-Z]{2}$/;

function response(body, contentType, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return response("Method not allowed", "text/plain; charset=utf-8", 405);
    }

    // Cloudflare Access must protect the /secure* path. ctx.access is the
    // authenticated Access context; do not trust a caller-supplied email header.
    if (!ctx.access) {
      return response("Cloudflare Access authentication required", "text/plain; charset=utf-8", 401);
    }

    const identity = await ctx.access.getIdentity();
    const email = identity?.email;
    if (!email) {
      return response("Authenticated email not available", "text/plain; charset=utf-8", 401);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (path === BASE_PATH) {
      const country = String(request.cf?.country || "XX").toUpperCase();
      const safeCountry = COUNTRY_CODE.test(country) ? country : "XX";
      const timestamp = new Date().toISOString();
      const href = `${BASE_PATH}/${encodeURIComponent(safeCountry)}`;
      const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Authenticated identity</title></head>
  <body>
    <p>${escapeHtml(email)} authenticated at ${escapeHtml(timestamp)} from <a href="${href}">${safeCountry}</a></p>
  </body>
</html>`;

      return response(html, "text/html; charset=utf-8", 200);
    }

    const match = path.match(/^\/secure\/([A-Z]{2})$/);
    if (match) {
      const country = match[1];
      const flag = await env.FLAGS.get(`flags/${country}.svg`);
      if (!flag) {
        return response(`Flag asset not found for ${country}`, "text/plain; charset=utf-8", 404);
      }

      const headers = new Headers({
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${country}.svg"`,
      });
      flag.writeHttpMetadata(headers);
      headers.set("Content-Type", "image/svg+xml; charset=utf-8");
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Content-Disposition", `inline; filename="${country}.svg"`);
      return new Response(request.method === "HEAD" ? null : flag.body, { headers });
    }

    return response("Not found", "text/plain; charset=utf-8", 404);
  },
};
