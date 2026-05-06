import { useEffect, useRef, useState } from "react";
import {
  BookOpen, Loader2, Upload, ClipboardPaste, Sparkles, X,
  Trash2, Download, Copy, CheckCheck, FileBarChart, AlertTriangle,
  CheckCircle2, RefreshCw, FileText, ChevronDown, ChevronUp, FileDown,
} from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SpeechPlayer } from "@/components/speech-player";
import { useSpeech, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CitationResult {
  paragraphIdx: number;
  paragraphText: string;
  citations: CitationItem[];
  hasFakeCitations: boolean;
}

interface CitationItem {
  raw: string;           // raw citation text found in paragraph
  style: string;         // IEEE, APA, Harvard, MLA, ...
  isValid: boolean;
  correctedText?: string;
  issue?: string;
  formattedRef?: string; // full formatted reference
}

interface AnalysisResult {
  paragraphs: CitationResult[];
  referenceSection: string[];
  totalCitations: number;
  validCount: number;
  fakeCount: number;
  detectedStyle: string;
  summary: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STYLES = ["Auto-detect", "IEEE", "APA", "Harvard", "MLA", "Chicago", "Vancouver"];
const countWords = (t: string) => t.trim() ? t.trim().split(/\s+/).length : 0;
const MAX_WORDS = 8000;

function downloadText(text: string, name: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function buildReport(result: AnalysisResult, originalText: string): string {
  const lines = [
    "CITATION CHECKER REPORT",
    "=======================",
    `Detected Style    : ${result.detectedStyle}`,
    `Total Citations   : ${result.totalCitations}`,
    `Valid Citations   : ${result.validCount}`,
    `Fake / Incorrect  : ${result.fakeCount}`,
    "",
    "SUMMARY",
    "-------",
    result.summary,
    "",
    "PARAGRAPH ANALYSIS",
    "------------------",
  ];

  result.paragraphs.forEach((p, i) => {
    lines.push(`\nParagraph ${i + 1}:`);
    lines.push(p.paragraphText.substring(0, 200) + (p.paragraphText.length > 200 ? "…" : ""));
    if (p.citations.length === 0) {
      lines.push("  → No citations found");
    } else {
      p.citations.forEach(c => {
        lines.push(`  [${c.isValid ? "✓ VALID" : "✗ FAKE/INCORRECT"}] ${c.raw}`);
        if (!c.isValid && c.issue) lines.push(`     Issue: ${c.issue}`);
        if (!c.isValid && c.correctedText) lines.push(`     Suggested: ${c.correctedText}`);
        if (c.formattedRef) lines.push(`     Full ref: ${c.formattedRef}`);
      });
    }
  });

  lines.push("", "REFERENCE SECTION", "-----------------");
  if (result.referenceSection.length === 0) {
    lines.push("No references generated.");
  } else {
    result.referenceSection.forEach((ref, i) => lines.push(`[${i + 1}] ${ref}`));
  }

  lines.push("", "--- Original Text ---", originalText);
  return lines.join("\n");
}

// ── Citation status badge ─────────────────────────────────────────────────────

function CitationBadge({ isValid }: { isValid: boolean }) {
  if (isValid) return (
    <Badge className="gap-1 bg-emerald-500 hover:bg-emerald-500 text-white text-[10px]">
      <CheckCircle2 className="w-3 h-3" />Valid
    </Badge>
  );
  return (
    <Badge variant="destructive" className="gap-1 text-[10px]">
      <AlertTriangle className="w-3 h-3" />Fake / Incorrect
    </Badge>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Citations() {
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [inputText, setInputText]   = useState("");
  const [citStyle, setCitStyle]     = useState("Auto-detect");
  const [fileName, setFileName]     = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [step, setStep]             = useState("");
  const [result, setResult]         = useState<AnalysisResult | null>(null);
  const [originalText, setOriginalText] = useState("");
  const [expandedPara, setExpandedPara] = useState<number | null>(null);
  const [copied, setCopied]         = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Speech
  const { supported, voices, speaking, paused, currentSentIdx, progress, speak, stop, pause, resume } = useSpeech();
  const prefs0 = getSpeechPrefs();
  const [speechRate, setSpeechRate]   = useState<number>(prefs0.rate ?? 1);
  const [speechVoice, setSpeechVoice] = useState<string>(prefs0.voiceName ?? "");
  const [engineMode, setEngineMode]   = useState<string>(prefs0.engineMode ?? "azure");

  useEffect(() => () => stop(), []); // eslint-disable-line

  const wordCount = countWords(inputText);
  const overLimit = wordCount > MAX_WORDS;

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setStep("Extracting text from file…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/humanize/upload", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({ error: "Server error" }));
      if (!r.ok) throw new Error(data.error || "Failed to extract text");
      setInputText(data.text || "");
      setFileName(data.fileName || file.name);
      setInputMode("paste");
      toast({ title: "File loaded", description: `${countWords(data.text)} words from ${file.name}` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileUpload(f);
    e.target.value = "";
  };

  // ── Analyze citations ────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!inputText.trim() || overLimit || isLoading) return;
    setIsLoading(true);
    setStep("Analyzing citations…");
    setResult(null);
    stop();
    try {
      const r = await fetch("/api/citations/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, style: citStyle }),
      });
      const data = await r.json().catch(() => ({ error: "Server error" }));
      if (!r.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
      setOriginalText(inputText);
      toast({
        title: "Analysis complete",
        description: `${data.totalCitations} citations found — ${data.fakeCount} issues detected`,
      });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  // ── Speech ───────────────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (paused) { resume(); return; }
    if (!result) return;
    const allText = result.paragraphs.map(p => p.paragraphText).join(" ");
    const sents = allText.match(/[^.!?]+[.!?]+/g) || [allText];
    speak(sents, speechRate, speechVoice);
  };

  // ── Copy reference list ──────────────────────────────────────────────────────
  const copyRefs = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.referenceSection.map((r, i) => `[${i + 1}] ${r}`).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "References copied" });
  };

  const handleReset = () => {
    stop(); setResult(null); setInputText(""); setFileName(""); setOriginalText(""); setStep("");
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <GeneratorLayout
      title="Citation Checker"
      description="Scan, validate, and correct academic citations — IEEE, APA, Harvard, MLA and more"
      icon={<BookOpen className="w-6 h-6 text-white" />}
      gradient="from-cyan-500 to-teal-600"
    >
      {/* ── Input state ─────────────────────────────────────────────────────── */}
      {!result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Document Input</CardTitle>
                <CardDescription>Upload or paste a document containing citations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Mode toggle */}
                <div className="inline-flex p-1 rounded-lg bg-muted gap-1">
                  {(["upload", "paste"] as const).map(m => (
                    <button key={m} onClick={() => setInputMode(m)}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                        inputMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "upload" ? <><Upload size={13} />Upload File</> : <><ClipboardPaste size={13} />Paste Text</>}
                    </button>
                  ))}
                </div>

                {inputMode === "upload" && (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFileUpload(f); }}
                    onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all p-10 text-center"
                  >
                    <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={onFilePick} hidden />
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
                    <p className="font-medium text-sm">Drop a document here or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, TXT</p>
                    {isLoading && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-primary text-sm">
                        <Loader2 size={14} className="animate-spin" />{step}
                      </div>
                    )}
                  </div>
                )}

                {inputMode === "paste" && (
                  <div className="space-y-2">
                    {fileName && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <FileText size={12} /><span className="truncate flex-1">{fileName}</span>
                        <button onClick={() => { setFileName(""); setInputText(""); }} className="hover:text-foreground"><X size={12} /></button>
                      </div>
                    )}
                    <div className="relative">
                      <Textarea
                        placeholder="Paste your academic text containing citations here…

Example:
  The neural network architecture [1] achieves state-of-the-art results (Smith et al., 2023).
  Previous work by Jones (2021) demonstrated similar findings [2]."
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        className="min-h-[260px] resize-none pr-8 text-sm leading-relaxed"
                      />
                      {inputText && (
                        <button onClick={() => { setInputText(""); setFileName(""); }}
                          className="absolute top-2 right-2 p-1 rounded hover:bg-muted opacity-60 hover:opacity-100">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span className={overLimit ? "text-destructive font-medium" : ""}>
                        {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
                      </span>
                      {overLimit && <span className="text-destructive">Exceeds limit</span>}
                    </div>
                  </div>
                )}

                {/* Citation style */}
                <div className="space-y-1.5">
                  <Label>Citation Style</Label>
                  <Select value={citStyle} onValueChange={setCitStyle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STYLES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full" size="lg"
                  disabled={!inputText.trim() || overLimit || isLoading}
                  onClick={handleAnalyze}
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{step || "Analyzing…"}</>
                    : <><Sparkles className="w-4 h-4 mr-2" />Analyze Citations</>
                  }
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Empty state right */}
          <div className="lg:col-span-7">
            <Card className="h-full min-h-[420px] flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-16 px-8">
                <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-15" />
                <p className="font-medium">Citation analysis will appear here</p>
                <p className="text-sm mt-2">Paste or upload a document with citations</p>
                <div className="mt-6 text-xs text-left max-w-sm mx-auto space-y-1.5 bg-muted/30 p-4 rounded-lg">
                  <p className="font-medium text-center mb-2">What this tool does:</p>
                  <ul className="space-y-1">
                    <li>• Detects all citations in your text</li>
                    <li>• Supports IEEE, APA, Harvard, MLA, Chicago</li>
                    <li>• Flags fake or incorrect references</li>
                    <li>• Suggests corrections for bad citations</li>
                    <li>• Generates a formatted References section</li>
                    <li>• Text-to-speech with Azure Neural voices</li>
                    <li>• Download full report as .txt</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Results state ─────────────────────────────────────────────────────── */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: summary stats + actions */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Citation Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold">{result.totalCitations}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Total</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center bg-emerald-500/5 border-emerald-500/20">
                    <div className="text-2xl font-bold text-emerald-600">{result.validCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Valid</div>
                  </div>
                  <div className="border rounded-lg p-3 text-center bg-destructive/5 border-destructive/20">
                    <div className="text-2xl font-bold text-destructive">{result.fakeCount}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">Issues</div>
                  </div>
                </div>

                {/* Detected style */}
                <div className="border rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Detected Style</div>
                  <div className="text-lg font-semibold mt-0.5">{result.detectedStyle}</div>
                </div>

                {/* Summary text */}
                <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    className="w-full" size="sm"
                    onClick={() => downloadText(
                      buildReport(result, originalText),
                      "citation-report.txt"
                    )}
                  >
                    <Download className="w-4 h-4 mr-2" />Download Full Report
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleAnalyze} disabled={isLoading}>
                    <RefreshCw className="w-3.5 h-3.5" />Re-analyze
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleReset}>
                    <X className="w-3.5 h-3.5" />New Document
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: tabbed results */}
          <div className="lg:col-span-8">
            <Card>
              <CardContent className="pt-5">
                <Tabs defaultValue="paragraphs">
                  <TabsList className="mb-4">
                    <TabsTrigger value="paragraphs" className="gap-1.5">
                      <FileText className="w-3.5 h-3.5" />Paragraph Analysis
                    </TabsTrigger>
                    <TabsTrigger value="references" className="gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />References
                    </TabsTrigger>
                    <TabsTrigger value="report" className="gap-1.5">
                      <FileBarChart className="w-3.5 h-3.5" />Full Report
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Paragraph Analysis tab ── */}
                  <TabsContent value="paragraphs" className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span>{result.paragraphs.length} paragraphs analyzed</span>
                      <span>{result.paragraphs.filter(p => p.hasFakeCitations).length} paragraphs with issues</span>
                    </div>

                    <div className="space-y-3 max-h-[65vh] overflow-y-auto custom-scrollbar pr-1">
                      {result.paragraphs.map((para, pIdx) => (
                        <div key={pIdx} className={`border rounded-xl overflow-hidden ${
                          para.hasFakeCitations ? "border-destructive/30 bg-destructive/5" : "border-border"
                        }`}>
                          <button
                            className="w-full text-left px-4 py-3 flex items-start gap-3"
                            onClick={() => setExpandedPara(expandedPara === pIdx ? null : pIdx)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-xs font-semibold text-muted-foreground">¶ {pIdx + 1}</span>
                                {para.citations.map((c, ci) => (
                                  <CitationBadge key={ci} isValid={c.isValid} />
                                ))}
                                {para.citations.length === 0 && (
                                  <Badge variant="outline" className="text-[10px]">No citations</Badge>
                                )}
                              </div>
                              <p className="text-sm text-foreground/80 line-clamp-2">{para.paragraphText}</p>
                            </div>
                            {expandedPara === pIdx
                              ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                              : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />}
                          </button>

                          {expandedPara === pIdx && para.citations.length > 0 && (
                            <div className="border-t px-4 py-3 space-y-3 bg-background/50">
                              {para.citations.map((cit, ci) => (
                                <div key={ci} className={`rounded-lg p-3 border text-sm ${
                                  cit.isValid
                                    ? "border-emerald-500/20 bg-emerald-500/5"
                                    : "border-destructive/20 bg-destructive/5"
                                }`}>
                                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                                    <CitationBadge isValid={cit.isValid} />
                                    <Badge variant="outline" className="text-[10px]">{cit.style}</Badge>
                                  </div>
                                  <p className="font-mono text-xs text-muted-foreground mb-1">Found: "{cit.raw}"</p>
                                  {!cit.isValid && cit.issue && (
                                    <p className="text-destructive text-xs mt-1">
                                      <span className="font-semibold">Issue:</span> {cit.issue}
                                    </p>
                                  )}
                                  {!cit.isValid && cit.correctedText && (
                                    <p className="text-emerald-600 text-xs mt-1">
                                      <span className="font-semibold">Suggested:</span> {cit.correctedText}
                                    </p>
                                  )}
                                  {cit.formattedRef && (
                                    <p className="text-xs mt-2 pt-2 border-t text-muted-foreground">
                                      <span className="font-semibold">Full reference:</span> {cit.formattedRef}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Speech player */}
                    <SpeechPlayer
                      supported={supported}
                      speaking={speaking}
                      paused={paused}
                      progress={progress}
                      voices={voices}
                      rate={speechRate}
                      voiceName={speechVoice}
                      engineMode={engineMode}
                      onPlay={handlePlay}
                      onPause={pause}
                      onStop={stop}
                      onRateChange={r => { setSpeechRate(r); saveSpeechPrefs({ rate: r }); }}
                      onVoiceChange={v => { setSpeechVoice(v); saveSpeechPrefs({ voiceName: v }); }}
                      onEngineModeChange={m => { setEngineMode(m); saveSpeechPrefs({ engineMode: m }); }}
                    />
                  </TabsContent>

                  {/* ── References tab ── */}
                  <TabsContent value="references" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-primary" />
                        Generated References
                      </h3>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={copyRefs} className="gap-1.5">
                          {copied ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "Copied!" : "Copy All"}
                        </Button>
                        <Button size="sm" onClick={() => downloadText(
                          result.referenceSection.map((r, i) => `[${i + 1}] ${r}`).join("\n"),
                          "references.txt"
                        )} className="gap-1.5">
                          <FileDown className="w-3.5 h-3.5" />Download
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg min-h-[300px] max-h-[55vh] overflow-y-auto p-5 bg-card custom-scrollbar space-y-3">
                      {result.referenceSection.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          No references were generated. The document may not contain formal citations.
                        </p>
                      ) : (
                        result.referenceSection.map((ref, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="text-muted-foreground font-mono text-xs pt-0.5 flex-shrink-0">[{i + 1}]</span>
                            <p className="leading-relaxed">{ref}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Full Report tab ── */}
                  <TabsContent value="report" className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileBarChart className="w-4 h-4 text-primary" />
                        Full Analysis Report
                      </h3>
                      <Button size="sm" onClick={() => downloadText(buildReport(result, originalText), "citation-report.txt")} className="gap-1.5">
                        <Download className="w-3.5 h-3.5" />Download
                      </Button>
                    </div>

                    {/* Per-paragraph summary table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">¶</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Citations</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Valid</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Issues</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.paragraphs.map((p, i) => (
                            <tr key={i} className={`border-t ${p.hasFakeCitations ? "bg-destructive/5" : ""}`}>
                              <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{i + 1}</td>
                              <td className="px-4 py-2">{p.citations.length}</td>
                              <td className="px-4 py-2 text-emerald-600">{p.citations.filter(c => c.isValid).length}</td>
                              <td className="px-4 py-2 text-destructive">{p.citations.filter(c => !c.isValid).length}</td>
                              <td className="px-4 py-2">
                                {p.citations.length === 0
                                  ? <Badge variant="outline" className="text-[10px]">No citations</Badge>
                                  : p.hasFakeCitations
                                  ? <Badge variant="destructive" className="text-[10px]">Issues found</Badge>
                                  : <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white">All valid</Badge>
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Fake citations detail */}
                    {result.fakeCount > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4" />{result.fakeCount} citation issue{result.fakeCount !== 1 ? "s" : ""} found
                        </p>
                        {result.paragraphs.flatMap(p => p.citations.filter(c => !c.isValid)).map((c, i) => (
                          <div key={i} className="border border-destructive/20 bg-destructive/5 rounded-lg p-3 text-xs space-y-1">
                            <p className="font-mono text-muted-foreground">"{c.raw}"</p>
                            {c.issue && <p><span className="font-semibold text-destructive">Issue:</span> {c.issue}</p>}
                            {c.correctedText && <p><span className="font-semibold text-emerald-600">Fix:</span> {c.correctedText}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </GeneratorLayout>
  );
}
