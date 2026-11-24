import { useEffect, useState } from "react";
import { X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/markdown-parser";
import { docxToHtml } from "@/lib/docx-layout";

// Full-screen, page-style view of a Word document (figures, images and tables included).
export function DocxViewer({ blob, title, fileName, onClose }: { blob: Blob; title: string; fileName?: string; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    docxToHtml(blob).then((h) => live && setHtml(sanitizeHtml(h))).catch((e) => live && setErr(e?.message || "Could not open the document."));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { live = false; window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [blob, onClose]);

  const save = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName || "document.docx";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-200 dark:bg-slate-900" role="dialog" aria-modal="true" aria-label={title} data-testid="docx-viewer">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shadow-sm">
        <p className="font-medium text-sm truncate flex-1">{title}</p>
        <Button size="sm" variant="outline" onClick={save} className="gap-1.5"><Download className="w-4 h-4" />Word</Button>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close" data-testid="docx-viewer-close"><X className="w-4 h-4" /></Button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-6 sm:px-6" data-testid="docx-viewer-scroll">
        {err ? <p className="text-center text-sm text-red-600">{err}</p> : html === null ? (
          <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Opening document...</p>
        ) : (
          <article className="docx-page mx-auto max-w-[850px] bg-white text-slate-900 shadow-lg rounded-sm px-6 py-8 sm:px-16 sm:py-14" dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </div>
      <style>{`
        .docx-page { font-family: "Times New Roman", Georgia, serif; font-size: 15px; line-height: 1.6; }
        .docx-page h1 { font-size: 1.7em; font-weight: 700; text-align: center; margin: 0 0 1em; }
        .docx-page h2 { font-size: 1.25em; font-weight: 700; margin: 1.4em 0 .5em; }
        .docx-page h3 { font-size: 1.08em; font-weight: 700; margin: 1.1em 0 .4em; }
        .docx-page p { margin: 0 0 .75em; text-align: justify; }
        .docx-page img { max-width: 100%; height: auto; display: block; margin: 1em auto .4em; }
        .docx-page table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: .92em; }
        .docx-page td, .docx-page th { border: 1px solid #94a3b8; padding: 4px 8px; vertical-align: top; }
        .docx-page ul, .docx-page ol { margin: 0 0 .75em 1.5em; }
        .docx-page ul { list-style: disc; } .docx-page ol { list-style: decimal; }
      `}</style>
    </div>
  );
}
