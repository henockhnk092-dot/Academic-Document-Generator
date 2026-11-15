// 1) When the site is served from Cloudflare Pages, the API still runs on a separate server (Render for now).
//    Build with VITE_API_ORIGIN=https://<api host> and every fetch("/api/...") is sent there instead.
//    Without the variable (Render, local dev) /api stays same-origin.
// 2) Every /api call carries the signed-in user's Firebase ID token (Authorization: Bearer ...), so the server
//    can apply the right plan and fair-use allowance. Calls that already set Authorization are left alone.
import { getFirebaseAuth } from "./firebase";

const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, "");

async function idToken(): Promise<string | null> {
  try {
    const user = getFirebaseAuth()?.currentUser;
    return user ? await user.getIdToken() : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: string | null = null;
    if (typeof input === "string" && input.startsWith("/api")) url = input;
    else if (input instanceof URL && input.origin === window.location.origin && input.pathname.startsWith("/api")) url = input.pathname + input.search;

    if (url) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Authorization")) {
        const t = await idToken();
        if (t) headers.set("Authorization", `Bearer ${t}`);
      }
      return nativeFetch((API_ORIGIN ?? "") + url, { ...init, headers });
    }
    if (API_ORIGIN && input instanceof Request) {
      const u = new URL(input.url);
      if (u.origin === window.location.origin && u.pathname.startsWith("/api")) {
        return nativeFetch(new Request(API_ORIGIN + u.pathname + u.search, input), init);
      }
    }
    return nativeFetch(input, init);
  };
}

export {};
