import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UploadCloud, ClipboardPaste, FileText, Loader2, X, Shuffle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

// Fills the box with an AI-written sample paragraph on a random academic topic.
export async function fetchSurpriseText(): Promise<{ text: string; topic: string }> {
  const r = await fetch("/api/sample-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Could not create a sample.");
  return d;
}

export function SurpriseMeButton({ onText, size = "sm", className = "" }: { onText: (text: string, topic: string) => void; size?: "sm" | "default"; className?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy}
      onClick={async () => {
        setBusy(true);
        try { const d = await fetchSurpriseText(); onText(d.text, d.topic); toast({ title: "Sample added", description: d.topic }); }
        catch (e: any) { toast({ title: "Surprise me", description: e.message, variant: "destructive" }); }
        finally { setBusy(false); }
      }}
      className={`inline-flex shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-md bg-amber-400 text-slate-900 hover:bg-amber-300 shadow-sm transition-colors font-semibold disabled:opacity-60 ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${className}`}
      title="Fill the box with a sample academic paragraph on a random topic" data-testid="button-surprise-me">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Shuffle size={13} />} {busy ? "Writing..." : "Surprise me"}
    </button>
  );
}

// Same "Upload file / Paste text" input as the AI Humanizer page. Files go through /api/humanize/upload
// (PDF, DOCX, TXT, MD, or an image read with OCR) and the extracted text lands in the text box.
export function TextInputWithUpload({ value, onChange, placeholder, minHeight = "min-h-[300px]", testId, interceptFile }: {
  value: string; onChange: (v: string) => void; placeholder: string; minHeight?: string; testId?: string;
  /** Optional: read the file in the page instead (return the text), or return null to use the normal upload. */
  interceptFile?: (file: File) => Promise<string | null>;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"upload" | "paste">("paste");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const own = interceptFile ? await interceptFile(file) : null;
      if (own !== null) {
        onChange(own); setFileName(file.name); setMode("paste");
        toast({ title: "File added", description: `${countWords(own).toLocaleString("en-US")} words from ${file.name}` });
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/humanize/upload", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not read this file.");
      onChange(d.text || "");
      setFileName(d.fileName || file.name);
      setMode("paste");
      toast({ title: "File added", description: `${countWords(d.text || "").toLocaleString("en-US")} words from ${file.name}` });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive", duration: 8000 });
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const tab = (m: "upload" | "paste", icon: JSX.Element, label: string) => (
    <button type="button" onClick={() => setMode(m)}
      className={`w-full px-2 sm:px-4 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center justify-center gap-1.5 ${mode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 items-stretch p-1 rounded-lg bg-muted gap-1">
        {tab("upload", <UploadCloud size={13} />, t("common.uploadFile", { defaultValue: "Upload file" }))}
        {tab("paste", <ClipboardPaste size={13} />, t("common.pasteText", { defaultValue: "Paste text" }))}
        <SurpriseMeButton className="col-span-2 sm:col-span-1 w-full" onText={(txt) => { onChange(txt); setFileName(""); setMode("paste"); }} />
      </div>

      {mode === "upload" ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all p-10 text-center"
          data-testid={testId ? `${testId}-dropzone` : undefined}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
          <p className="font-medium text-sm">Drop a file here or click to choose</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, Word (.docx), TXT, MD, or a photo of the text (JPG, PNG, WEBP). Max 10 MB.</p>
          {loading && <div className="mt-4 flex items-center justify-center gap-2 text-primary text-sm"><Loader2 size={14} className="animate-spin" />Reading the file...</div>}
        </div>
      ) : (
        <div className="space-y-2">
          {fileName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <FileText size={12} /><span className="truncate">{fileName}</span>
              <button type="button" onClick={() => { setFileName(""); onChange(""); }} className="ml-auto hover:text-foreground" aria-label="Remove file"><X size={12} /></button>
            </div>
          )}
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${minHeight} resize-none text-sm leading-relaxed`} data-testid={testId} />
        </div>
      )}
    </div>
  );
}
