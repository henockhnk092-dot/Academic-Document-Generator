// When the site is served from Cloudflare Pages, the API still runs on a separate server (Render for now).
// Build with VITE_API_ORIGIN=https://<api host> and every fetch("/api/...") is sent there instead.
// Without the variable (Render, local dev) nothing changes: /api stays same-origin.
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "");

if (API_ORIGIN && typeof window !== "undefined") {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string" && input.startsWith("/api")) {
      return nativeFetch(API_ORIGIN + input, init);
    }
    if (input instanceof Request) {
      const u = new URL(input.url);
      if (u.origin === window.location.origin && u.pathname.startsWith("/api")) {
        return nativeFetch(new Request(API_ORIGIN + u.pathname + u.search, input), init);
      }
    }
    return nativeFetch(input, init);
  };
}

export {};
