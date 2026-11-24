import JSZip from "jszip";

// "Keep layout" for Word files in Rewrite & Verify.
// We read the body paragraphs of the uploaded .docx ourselves (one paragraph per blank-line block), send that
// text through the normal pipeline (which keeps paragraph order and count), then write each rewritten paragraph
// back into the same <w:p>. Figures, images, tables, headings, styles and page setup are never touched.

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type DocxModel = { name: string; zip: JSZip; xml: Document; paras: Element[]; texts: string[]; text: string; original: Blob };

// Text nodes that belong to this paragraph (not to a nested text box paragraph).
function ownNodes(p: Element, local: string): Element[] {
  return Array.from(p.getElementsByTagNameNS(W, local)).filter((n) => {
    let a = n.parentElement;
    while (a && !(a.namespaceURI === W && a.localName === "p")) a = a.parentElement;
    return a === p;
  });
}

function paraText(p: Element): string {
  return ownNodes(p, "t").map((t) => t.textContent || "").join("").replace(/\s+/g, " ").trim();
}

// Body-level paragraphs only (tables and text boxes stay exactly as they are).
function bodyParas(xml: Document): Element[] {
  const body = xml.getElementsByTagNameNS(W, "body")[0];
  if (!body) return [];
  const out: Element[] = [];
  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      if (c.namespaceURI !== W) continue;
      if (c.localName === "p") out.push(c);
      else if (c.localName === "sdt" || c.localName === "sdtContent") walk(c);
    }
  };
  walk(body);
  return out;
}

export const isDocx = (f: File) => /\.docx$/i.test(f.name) || f.type === DOCX_MIME;

export async function loadDocx(file: File): Promise<DocxModel> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const src = await zip.file("word/document.xml")?.async("string");
  if (!src) throw new Error("This Word file has no document body.");
  const xml = new DOMParser().parseFromString(src, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error("Could not read this Word file.");
  const paras: Element[] = [], texts: string[] = [];
  for (const p of bodyParas(xml)) {
    const t = paraText(p);
    if (t) { paras.push(p); texts.push(t); }
  }
  if (!paras.length) throw new Error("No text found in this Word file.");
  return { name: file.name, zip, xml, paras, texts, text: texts.join("\n\n"), original: file };
}

/** Same document with every changed paragraph replaced by its rewrite. Null when the paragraphs no longer line up. */
export async function rebuildDocx(model: DocxModel, rewritten: string): Promise<Blob | null> {
  const parts = rewritten.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (parts.length !== model.paras.length) return null;
  const xml = model.xml.cloneNode(true) as Document;
  const paras = bodyParas(xml).filter((p) => paraText(p));
  if (paras.length !== parts.length) return null;
  paras.forEach((p, i) => {
    if (parts[i] === model.texts[i]) return;
    const ts = ownNodes(p, "t");
    if (!ts.length) return;
    ts[0].textContent = parts[i];
    ts[0].setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
    ts.slice(1).forEach((t) => t.parentNode?.removeChild(t));
    // line breaks and tabs inside the old text would now fall in odd places
    ownNodes(p, "tab").concat(ownNodes(p, "br").filter((b) => b.getAttributeNS(W, "type") !== "page"))
      .forEach((n) => n.parentNode?.removeChild(n));
  });
  const zip = await JSZip.loadAsync(await model.original.arrayBuffer());
  zip.file("word/document.xml", new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({ type: "blob", mimeType: DOCX_MIME });
}

/** HTML view of a .docx (images inline, tables kept) for the full-screen preview. */
export async function docxToHtml(blob: Blob): Promise<string> {
  const mammoth: any = await import("mammoth");
  const lib = mammoth.default ?? mammoth;
  const r = await lib.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
  return r.value as string;
}
