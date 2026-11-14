// /health stays on the edge so uptime checks do not wake the Render server.
export function onRequest() {
  return new Response(JSON.stringify({ status: "ok", host: "cloudflare-pages" }), {
    headers: { "content-type": "application/json" },
  });
}
