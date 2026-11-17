import { useEffect, useMemo, useState } from "react";
import { Copy, CheckCheck, Download, FileText, FileDown, FileType2, Loader2 } from "lucide-react";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FullscreenPreviewButton } from "@/components/fullscreen-preview-button";
import { SpeechPlayer } from "@/components/speech-player";
import { useSpeech, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";
import { useToast } from "@/hooks/use-toast";

export interface ToolSentence { text: string; flagged?: boolean }

const splitSentences = (t: string) => (t.match(/[^.!?\n]+[.!?]+["')\]]*|[^.!?\n]+(?=\n|$)/g) || [t]).map((s) => s.trim()).filter(Boolean);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safeName = (s: string) => s.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_").slice(0, 60) || "academicgen";

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Copy, export (TXT, Word, PDF), full-screen reading view and the site's voice reader, for any result text.
// Same features as the generator and humanizer pages, so the new tools feel identical.
export function ResultTools({ text, title, sentences }: { text: string; title: string; sentences?: ToolSentence[] }) {
  const { toast } = useToast();
  const { supported, voices, speaking, paused, currentSentIdx, progress, speak, stop, pause, resume } = useSpeech();
  const prefs0 = getSpeechPrefs();
  const [rate, setRate] = useState<number>(prefs0.rate ?? 1);
  const [voice, setVoice] = useState<string>(prefs0.voiceName ?? "");
  const [engineMode, setEngineMode] = useState<string>(prefs0.engineMode ?? "azure");
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const parts: ToolSentence[] = useMemo(() => sentences?.length ? sentences : splitSentences(text).map((t) => ({ text: t })), [sentences, text]);
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stop(); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => { if (paused) { resume(); return; } speak(parts.map((p) => p.text), rate, voice || null); };

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  const exportTxt = () => save(new Blob([text], { type: "text/plain;charset=utf-8" }), `${safeName(title)}.txt`);

  const exportDocx = async () => {
    const doc = new Document({
      sections: [{ children: [
        new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }),
        ...text.split(/\n\s*\n|\n/).filter((p) => p.trim()).map((p) => new Paragraph({ children: [new TextRun({ text: p.trim(), size: 24, font: "Calibri" })], spacing: { after: 160, line: 300 } })),
      ] }],
    });
    save(await Packer.toBlob(doc), `${safeName(title)}.docx`);
  };

  const exportPdf = async () => {
    setPdfBusy(true);
    try {
      const html = `<html><head><meta charset="utf-8"><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.6;margin:2.5cm}h1{font-size:18pt}p{margin:0 0 10pt}</style></head><body><h1>${escapeHtml(title)}</h1>${text.split(/\n\s*\n|\n/).filter((p) => p.trim()).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join("")}</body></html>`;
      const r = await fetch("/api/export/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: html, type: "conference" }) });
      if (!r.ok) throw new Error("PDF export failed");
      save(await r.blob(), `${safeName(title)}.pdf`);
    } catch (e: any) {
      toast({ title: "PDF export", description: "Could not create the PDF. Try Word or TXT, or try again in a minute.", variant: "destructive" });
    } finally { setPdfBusy(false); }
  };

  const body = (large: boolean) => (
    <p className={large ? "text-lg leading-9" : "text-sm leading-7"}>
      {parts.map((s, i) => (
        <span key={i} className={`${s.flagged ? "bg-red-200/70 dark:bg-red-900/50 rounded px-0.5" : ""} ${speaking && currentSentIdx === i ? "outline outline-2 outline-primary/60 bg-primary/15 rounded" : ""}`}>{s.text} </span>
      ))}
    </p>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copy} className="gap-1.5" data-testid="tool-copy">
          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="tool-export">
              {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={exportDocx}><FileType2 className="w-4 h-4 mr-2" />Word (.docx)</DropdownMenuItem>
            <DropdownMenuItem onClick={exportPdf}><FileDown className="w-4 h-4 mr-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={exportTxt}><FileText className="w-4 h-4 mr-2" />Text (.txt)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          Full screen <FullscreenPreviewButton isFullscreen={full} onToggle={() => setFull(true)} />
        </div>
      </div>

      <SpeechPlayer
        supported={supported} speaking={speaking} paused={paused} progress={progress} voices={voices}
        rate={rate} voiceName={voice} engineMode={engineMode}
        onPlay={play} onPause={pause} onStop={stop}
        onRateChange={(r) => { setRate(r); saveSpeechPrefs({ rate: r }); }}
        onVoiceChange={(v) => { setVoice(v); saveSpeechPrefs({ voiceName: v }); }}
        onEngineModeChange={(m) => { setEngineMode(m); saveSpeechPrefs({ engineMode: m }); }}
      />

      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className="max-w-[min(96vw,1400px)] w-[96vw] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b flex-row items-center gap-3 space-y-0">
            <DialogTitle className="text-lg flex-1 truncate pr-8">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-6">
            <div className="max-w-4xl mx-auto">{body(true)}</div>
          </div>
          <div className="border-t px-6 py-3">
            <SpeechPlayer
              supported={supported} speaking={speaking} paused={paused} progress={progress} voices={voices}
              rate={rate} voiceName={voice} engineMode={engineMode}
              onPlay={play} onPause={pause} onStop={stop}
              onRateChange={(r) => { setRate(r); saveSpeechPrefs({ rate: r }); }}
              onVoiceChange={(v) => { setVoice(v); saveSpeechPrefs({ voiceName: v }); }}
              onEngineModeChange={(m) => { setEngineMode(m); saveSpeechPrefs({ engineMode: m }); }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The reading area used inside the page (same highlighting as full screen).
export { splitSentences };
