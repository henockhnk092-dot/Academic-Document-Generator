const HUMANIZE_KEY  = "humanize_prefill";
const CITATIONS_KEY = "citations_prefill";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function extractDocumentText(generatedContent: any): string {
  if (!generatedContent) return "";

  // Conference paper may come as raw HTML
  if (generatedContent.type === "html" && generatedContent.html) {
    return stripHtml(generatedContent.html);
  }
  if (typeof generatedContent === "string") {
    return generatedContent;
  }

  const parts: string[] = [];

  if (generatedContent.title) parts.push(generatedContent.title);
  if (generatedContent.abstract) {
    parts.push(`Abstract\n\n${generatedContent.abstract}`);
  }

  // Standard document sections
  if (Array.isArray(generatedContent.sections)) {
    for (const section of generatedContent.sections) {
      const heading = section.heading || section.title || "";
      const content = section.content || "";
      if (heading && content) parts.push(`${heading}\n\n${content}`);
      else if (content) parts.push(content);
    }
  }

  // PowerPoint slides
  if (Array.isArray(generatedContent.slides)) {
    for (const slide of generatedContent.slides) {
      const slideParts = [
        slide.title,
        slide.content,
        slide.speakerNotes,
      ].filter(Boolean);
      if (slideParts.length) parts.push(slideParts.join("\n"));
    }
  }

  if (Array.isArray(generatedContent.references) && generatedContent.references.length > 0) {
    parts.push(`References\n\n${generatedContent.references.join("\n")}`);
  }

  return parts.join("\n\n");
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function safeSet(key: string, value: string): boolean {
  try {
    sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeConsume(key: string): string {
  try {
    const value = sessionStorage.getItem(key) ?? "";
    if (value) sessionStorage.removeItem(key);
    return value;
  } catch {
    return "";
  }
}

// ── Humanizer ──────────────────────────────────────────────────────────────────

export function storeForHumanizer(generatedContent: any): void {
  safeSet(HUMANIZE_KEY, extractDocumentText(generatedContent));
}

export function readHumanizerPrefill(): string {
  return safeConsume(HUMANIZE_KEY);
}

// ── Citations checker ──────────────────────────────────────────────────────────

export function storeForCitations(generatedContent: any): void {
  safeSet(CITATIONS_KEY, extractDocumentText(generatedContent));
}

export function readCitationsPrefill(): string {
  return safeConsume(CITATIONS_KEY);
}
