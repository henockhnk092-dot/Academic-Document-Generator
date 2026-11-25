// Multi-provider image search with automatic fallback.
// Provider order: Pixabay → Pexels → Unsplash → Wikimedia Commons (no key required)
// All providers normalise to ImageResult so the rest of the codebase needs no changes.

export interface ImageResult {
  id: string | number;
  webformatURL: string;   // medium - keeps PixabayImage compat
  largeImageURL: string;  // large - keeps PixabayImage compat
  previewURL: string;
  tags: string;
  user: string;
  pageURL: string;
  provider: "pixabay" | "pexels" | "unsplash" | "wikimedia";
}

// ── keyword extraction (shared with old pixabay.ts) ──────────────────────────
const GENERIC = new Set([
  "professional","presentation","slide","corporate","business","technical",
  "report","document","paper","research","academic","conference","thesis",
  "dissertation","study","analysis","the","a","an","and","or","but","in",
  "on","at","to","for","of","with","by","from","as","is","was","are","were",
]);

function extractKeywords(topic: string): string {
  const words = topic.toLowerCase().split(/\s+/)
    .filter(w => w.length > 3 && !GENERIC.has(w))
    .slice(0, 6);
  return (words.join(" ") || "technology").substring(0, 100);
}

// ── Pixabay ───────────────────────────────────────────────────────────────────
async function searchPixabay(query: string): Promise<ImageResult[]> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent(extractKeywords(query));
  const url = `https://pixabay.com/api/?key=${key}&q=${q}&image_type=photo&per_page=10&safesearch=true`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.hits || []).map((h: any): ImageResult => ({
      id: h.id,
      webformatURL: h.webformatURL,
      largeImageURL: h.largeImageURL || h.webformatURL,
      previewURL: h.previewURL || h.webformatURL,
      tags: h.tags || "",
      user: h.user || "",
      pageURL: h.pageURL || "",
      provider: "pixabay",
    }));
  } catch { return []; }
}

// ── Pexels ────────────────────────────────────────────────────────────────────
async function searchPexels(query: string): Promise<ImageResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const q = encodeURIComponent(extractKeywords(query));
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${q}&per_page=10`, {
      headers: { Authorization: key },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.photos || []).map((p: any): ImageResult => ({
      id: p.id,
      webformatURL: p.src.large || p.src.medium,
      largeImageURL: p.src.original || p.src.large,
      previewURL: p.src.small || p.src.medium,
      tags: p.alt || "",
      user: p.photographer || "",
      pageURL: p.url || "",
      provider: "pexels",
    }));
  } catch { return []; }
}

// ── Unsplash ──────────────────────────────────────────────────────────────────
async function searchUnsplash(query: string): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const q = encodeURIComponent(extractKeywords(query));
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${q}&per_page=10&client_id=${key}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map((p: any): ImageResult => ({
      id: p.id,
      webformatURL: p.urls.regular,
      largeImageURL: p.urls.full || p.urls.regular,
      previewURL: p.urls.small || p.urls.regular,
      tags: p.alt_description || p.description || "",
      user: p.user?.name || "",
      pageURL: p.links?.html || "",
      provider: "unsplash",
    }));
  } catch { return []; }
}

// ── Wikimedia Commons (no API key required) ───────────────────────────────────
async function searchWikimedia(query: string): Promise<ImageResult[]> {
  const q = encodeURIComponent(extractKeywords(query));
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&list=allimages` +
      `&aisearch=${q}&ailimit=10&aiprop=url|user&format=json&origin=*`;
    const res = await fetch(url, { headers: { "User-Agent": "AcademicGen/1.0" } });
    if (!res.ok) return [];
    const data = await res.json();
    const imgs: any[] = data.query?.allimages || [];
    return imgs
      .filter((i: any) => /\.(jpg|jpeg|png|webp)$/i.test(i.url))
      .map((i: any): ImageResult => ({
        id: i.name,
        webformatURL: i.url,
        largeImageURL: i.url,
        previewURL: i.url,
        tags: i.name.replace(/_/g, " "),
        user: i.user || "Wikimedia Commons",
        pageURL: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(i.name)}`,
        provider: "wikimedia",
      }));
  } catch { return []; }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function searchImagesWithFallback(query: string, perPage = 10): Promise<ImageResult[]> {
  const providers = [searchPixabay, searchPexels, searchUnsplash, searchWikimedia];
  for (const search of providers) {
    try {
      const results = await search(query);
      if (results.length > 0) return results.slice(0, perPage);
    } catch { /* try next */ }
  }
  return [];
}

// Words that say what the picture is about (no filler such as "diagram", "illustration", "system").
const FILLER = new Set([...Array.from(GENERIC), "diagram", "illustration", "image", "photo", "picture", "figure", "chart", "graph",
  "system", "overview", "concept", "showing", "using", "based", "design", "model", "process", "small", "large"]);
const terms = (t: string) => Array.from(new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !FILLER.has(w))));
const stem = (w: string) => w.replace(/(ing|ers|ies|es|s)$/, "");

function relevance(img: ImageResult, want: string[]): number {
  const tags = terms(img.tags).map(stem);
  return want.reduce((n, w) => n + (tags.some((t) => t === stem(w) || t.startsWith(stem(w)) || stem(w).startsWith(t)) ? 1 : 0), 0);
}

// Best-matching picture for a figure, or null. A section with no relevant picture gets no picture: an unrelated one
// (seen: a microscope as the "system diagram" of a solar cold store) is worse than none.
export async function getImageWithFallback(query: string, topic = ""): Promise<ImageResult | null> {
  const want = terms(query);
  const subject = terms(topic).slice(0, 3);
  const queries = Array.from(new Set([
    want.slice(0, 4).join(" "),
    want.slice(0, 2).join(" "),
    [...want.slice(0, 1), ...subject.filter((w) => !want.includes(w)).slice(0, 2)].join(" "),
  ].filter((q) => q.trim())));
  // The picture must show the section's own subject: at least two of its words (one if it only has one),
  // with the report topic used only to break ties.
  const need = Math.min(2, want.length);
  for (const q of queries) {
    const images = await searchImagesWithFallback(q, 10);
    const ranked = images.map((img, i) => ({ img, own: relevance(img, want), score: 2 * relevance(img, want) + relevance(img, subject), i }))
      .filter((x) => need > 0 && x.own >= need)
      .sort((x, y) => y.score - x.score || x.i - y.i);
    if (ranked.length) return ranked[0].img;
  }
  return null;
}
