import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { readHumanizerPrefill, storeForCitations, storeForGrammarCheck } from "@/lib/humanize-transfer";
import {
  Wand2, Copy, Download, CheckCheck, Loader2, RefreshCw,
  FileText, Sparkles, X, AlertTriangle, ShieldCheck,
  UploadCloud, ClipboardPaste, Trash2, Undo2, FileBarChart,
  FileDown, FileCode, BookOpenCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SpeechPlayer } from "@/components/speech-player";
import { useSpeech, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SentenceScore {
  idx: number;
  text: string;
  score: number;
  isAI: boolean;
}

interface Round {
  roundNumber: number;
  aiBefore: number;
  aiAfter: number;
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function ScoreRing({ value, size = 110, label = "AI Score", sublabel }: {
  value: number | null; size?: number; label?: string; sublabel?: string;
}) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ   = 2 * Math.PI * radius;
  const offset = value === null ? circ : circ - (value / 100) * circ;
  const color  =
    value === null ? "#64748b"
    : value > 70   ? "#ef4444"
    : value > 40   ? "#f59e0b"
    : "#10b981";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute" style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="currentColor"
          strokeWidth={stroke} className="text-muted/20" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .7s ease, stroke .35s ease",
                   filter: value !== null ? `drop-shadow(0 0 6px ${color}88)` : undefined }}
        />
      </svg>
      <div className="relative z-10 text-center select-none">
        <div className="text-2xl font-bold tabular-nums" style={{ color }}>
          {value === null ? "—" : `${value}%`}
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
        {sublabel && <div className="text-[10px] text-muted-foreground/70 leading-tight">{sublabel}</div>}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  const { t } = useTranslation();
  if (score === null) return null;
  if (score > 70) return (
    <Badge variant="destructive" className="gap-1 text-[11px]">
      <AlertTriangle className="w-3 h-3" />{t("pages.humanize.scoreHighAI", { score })}
    </Badge>
  );
  if (score > 40) return (
    <Badge className="gap-1 text-[11px] bg-amber-500 hover:bg-amber-500 text-white">
      <AlertTriangle className="w-3 h-3" />{t("pages.humanize.scoreModerate", { score })}
    </Badge>
  );
  return (
    <Badge className="gap-1 text-[11px] bg-emerald-500 hover:bg-emerald-500 text-white">
      <ShieldCheck className="w-3 h-3" />{t("pages.humanize.scoreLowAI", { score })}
    </Badge>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_WORDS = 10000;
const countWords = (t: string) => t.trim() ? t.trim().split(/\s+/).length : 0;


function downloadBlob(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function buildReport(params: {
  originalText: string;
  humanizedText: string;
  originalAiScore: number | null;
  humanizedAiScore: number | null;
  rounds: Round[];
  scores: SentenceScore[];
  t: (key: string, options?: Record<string, unknown>) => string;
}): string {
  const { originalText, humanizedText, originalAiScore, humanizedAiScore, rounds, scores, t } = params;
  const lines: string[] = [
    t("pages.humanize.reportTitle"),
    "================================",
    `${t("pages.humanize.reportOriginalAiScore")}  : ${originalAiScore ?? t("common.notAvailable")}%`,
    `${t("pages.humanize.reportFinalAiScore")}     : ${humanizedAiScore ?? t("common.notAvailable")}%`,
    `${t("pages.humanize.reportTotalRounds")}       : ${rounds.length}`,
    `${t("pages.humanize.reportWordCount")}         : ${countWords(humanizedText)}`,
    "",
    t("pages.humanize.reportRoundProgression"),
    "-----------------",
  ];
  if (rounds.length === 0) {
    lines.push(t("pages.humanize.reportNoRounds"));
  } else {
    rounds.forEach(r =>
      lines.push(t("pages.humanize.reportRoundLine", { round: r.roundNumber, before: r.aiBefore, after: r.aiAfter, delta: r.aiBefore - r.aiAfter }))
    );
  }
  lines.push("", t("pages.humanize.reportSentenceAnalysis"), "-----------------");
  if (scores.length === 0) {
    lines.push(t("pages.humanize.reportNoSentenceData"));
  } else {
    scores.forEach(s =>
      lines.push(`[${s.isAI ? t("pages.humanize.reportAiLabel", { score: Math.round(s.score) }) : t("pages.humanize.reportHumanLabel", { score: Math.round(s.score) })}] ${s.text}`)
    );
  }
  lines.push("", t("pages.humanize.reportOriginalText"), originalText, "");
  return lines.join("\n");
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Humanize() {
  const { t } = useTranslation();

  const MODES = [
    { value: "academic",     label: t("common.toneAcademic"),        desc: t("pages.humanize.modeAcademicDesc") },
    { value: "professional", label: t("common.toneProfessional"),    desc: t("pages.humanize.modeProfessionalDesc") },
    { value: "casual",       label: t("pages.humanize.modeCasualLabel"), desc: t("pages.humanize.modeCasualDesc") },
    { value: "creative",     label: t("common.toneCreative"),        desc: t("pages.humanize.modeCreativeDesc") },
  ];

  // Input state
  const [inputMode, setInputMode] = useState<"paste" | "upload">("paste");
  const [inputText, setInputText] = useState("");
  const [mode, setMode]           = useState("academic");
  const [fileName, setFileName]   = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Processing
  const [isLoading, setIsLoading]         = useState(false);
  const [isParaphrasing, setIsParaphrasing] = useState(false);
  const [step, setStep]                   = useState("");

  // Results
  const [humanizedText, setHumanizedText]     = useState("");
  const [originalText, setOriginalText]       = useState("");
  const [scores, setScores]                   = useState<SentenceScore[]>([]);
  const [originalScores, setOriginalScores]   = useState<SentenceScore[]>([]);
  const [originalAiScore, setOriginalAiScore] = useState<number | null>(null);
  const [humanizedAiScore, setHumanizedAiScore] = useState<number | null>(null);
  const [rounds, setRounds]                   = useState<Round[]>([]);

  // Copy state
  const [copiedH, setCopiedH] = useState(false);
  const [copiedO, setCopiedO] = useState(false);

  // Speech
  const { supported, browserSupported, voices, speaking, paused, currentSentIdx, progress, speak, stop, pause, resume } = useSpeech();
  const prefs0 = getSpeechPrefs();
  const [speechRate, setSpeechRate]     = useState<number>(prefs0.rate    ?? 1);
  const [speechVoice, setSpeechVoice]   = useState<string>(prefs0.voiceName ?? "");
  const [engineMode, setEngineMode]     = useState<string>(prefs0.engineMode ?? "azure");
  const sentRefs = useRef<Record<number, HTMLSpanElement | null>>({});

  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Load text passed from a generator page via sessionStorage
  useEffect(() => {
    const prefill = readHumanizerPrefill();
    if (prefill.trim()) {
      setInputText(prefill);
      setInputMode("paste");
    }
  }, []);

  const hasResult  = !!humanizedText;
  const wordCount  = countWords(inputText);
  const overLimit  = wordCount > MAX_WORDS;
  const improvement = originalAiScore !== null && humanizedAiScore !== null
    ? originalAiScore - humanizedAiScore : null;

  // Auto-scroll to currently spoken sentence
  useEffect(() => {
    if (currentSentIdx >= 0 && sentRefs.current[currentSentIdx]) {
      sentRefs.current[currentSentIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentSentIdx]);

  // Stop TTS on unmount
  useEffect(() => () => stop(), []); // eslint-disable-line

  // ── File upload ─────────────────────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setStep(t("pages.humanize.extractingText"));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/humanize/upload", { method: "POST", body: fd });
      const data = await r.json().catch(() => ({ error: t("pages.humanize.serverNoResponse") }));
      if (!r.ok) throw new Error(data.error || t("pages.humanize.extractFailed"));
      setInputText(data.text || "");
      setFileName(data.fileName || file.name);
      setInputMode("paste");
      toast({ title: t("pages.humanize.fileExtractedTitle"), description: t("pages.humanize.fileExtractedDesc", { words: countWords(data.text), name: file.name }) });
    } catch (err: any) {
      toast({ title: t("pages.humanize.uploadFailedTitle"), description: t("pages.humanize.uploadFailedDesc"), variant: "destructive" });
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileUpload(f);
  };

  // ── Humanize ────────────────────────────────────────────────────────────────
  const handleHumanize = async () => {
    if (!inputText.trim() || overLimit || isLoading || isParaphrasing) return;

    setIsLoading(true);
    setStep(t("pages.humanize.humanizingText"));
    stop();
    try {
      const data: any = await apiRequest("POST", "/api/humanize", { text: inputText, mode });
      setHumanizedText(data.humanizedText || "");
      setOriginalText(data.originalText || inputText);
      setScores(data.humanizedScores || []);
      setOriginalScores(data.originalScores || []);
      setOriginalAiScore(data.originalAiScore ?? null);
      setHumanizedAiScore(data.humanizedAiScore ?? null);
      setRounds([]);
      toast({
        title: t("pages.humanize.humanizedTitle"),
        description: data.humanizedAiScore !== null
          ? t("pages.humanize.humanizedDesc", { before: data.originalAiScore, after: data.humanizedAiScore })
          : t("pages.humanize.humanizedDescNoScore"),
      });
    } catch (err: any) {
      toast({ title: t("pages.humanize.humanizeFailedTitle"), description: t("pages.humanize.humanizeFailedDesc"), variant: "destructive" });
    } finally {
      setIsLoading(false);
      setStep("");
    }
  };

  // ── Paraphrase another round ─────────────────────────────────────────────────
  const handleParaphrase = async () => {
    if (!humanizedText || isParaphrasing) return;
    setIsParaphrasing(true);
    setStep(t("pages.humanize.paraphrasingStep"));
    stop();
    try {
      const aiBefore = humanizedAiScore ?? 0;
      const data: any = await apiRequest("POST", "/api/humanize", { text: humanizedText, mode });
      const aiAfter = data.humanizedAiScore ?? 0;
      setHumanizedText(data.humanizedText || humanizedText);
      setScores(data.humanizedScores || scores);
      setHumanizedAiScore(aiAfter);
      setRounds(prev => [...prev, { roundNumber: prev.length + 1, aiBefore, aiAfter }]);
      toast({
        title: t("pages.humanize.paraphraseCompleteTitle", { round: rounds.length + 1 }),
        description: t("pages.humanize.paraphraseCompleteDesc", { before: aiBefore, after: aiAfter }),
      });
    } catch (err: any) {
      toast({ title: t("pages.humanize.paraphraseFailedTitle"), description: t("pages.humanize.paraphraseFailedDesc"), variant: "destructive" });
    } finally {
      setIsParaphrasing(false);
      setStep("");
    }
  };

  // ── Copy helpers ─────────────────────────────────────────────────────────────
  const copyText = async (text: string, which: "h" | "o") => {
    await navigator.clipboard.writeText(text);
    which === "h" ? setCopiedH(true) : setCopiedO(true);
    setTimeout(() => which === "h" ? setCopiedH(false) : setCopiedO(false), 2000);
    toast({ title: t("pages.humanize.copiedTitle") });
  };

  // ── Reset ────────────────────────────────────────────────────────────────────
  const [undoSnapshot, setUndoSnapshot] = useState<{
    inputText: string; humanizedText: string; originalText: string;
    scores: SentenceScore[]; originalScores: SentenceScore[];
    originalAiScore: number | null; humanizedAiScore: number | null;
    rounds: Round[];
  } | null>(null);

  const handleReset = () => {
    setUndoSnapshot({ inputText, humanizedText, originalText, scores, originalScores, originalAiScore, humanizedAiScore, rounds });
    stop();
    setInputText(""); setFileName(""); setHumanizedText(""); setOriginalText("");
    setScores([]); setOriginalScores([]); setOriginalAiScore(null); setHumanizedAiScore(null);
    setRounds([]); setStep("");
  };

  const handleUndoReset = () => {
    if (!undoSnapshot) return;
    setInputText(undoSnapshot.inputText);
    setHumanizedText(undoSnapshot.humanizedText);
    setOriginalText(undoSnapshot.originalText);
    setScores(undoSnapshot.scores);
    setOriginalScores(undoSnapshot.originalScores);
    setOriginalAiScore(undoSnapshot.originalAiScore);
    setHumanizedAiScore(undoSnapshot.humanizedAiScore);
    setRounds(undoSnapshot.rounds);
    setUndoSnapshot(null);
  };

  const handleCitationCheck = () => {
    const text = humanizedText || inputText;
    if (!text) return;
    storeForCitations(text);
    navigate("/citations");
  };

  const handleGrammarCheck = () => {
    const text = humanizedText || inputText;
    if (!text) return;
    storeForGrammarCheck(text);
    navigate("/grammar-check");
  };

  // ── Speech handlers ──────────────────────────────────────────────────────────
  const handlePlay = () => {
    if (paused) { resume(); return; }
    speak(scores.length ? scores.map(s => s.text) : humanizedText.match(/[^.!?]+[.!?]+/g) || [humanizedText],
      speechRate, speechVoice);
  };

  // ── Export: DOCX-like HTML ───────────────────────────────────────────────────
  const exportHtml = (which: "humanized" | "original") => {
    const txt  = which === "humanized" ? humanizedText : originalText;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${which === "humanized" ? t("pages.humanize.tabHumanized") : t("pages.humanize.tabOriginal")} ${t("common.text")}</title>
<style>body{font-family:'Times New Roman',serif;max-width:800px;margin:40px auto;line-height:1.8;}</style>
</head><body><p>${txt.replace(/\n/g, "</p><p>")}</p></body></html>`;
    downloadBlob(html, `${which}-text.html`);
    toast({ title: t("pages.humanize.exportedHTMLTitle") });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <GeneratorLayout
      title={t("pages.humanizer.title")}
      description={t("pages.humanizer.subtitle")}
      icon={<Wand2 className="w-6 h-6 text-white" />}
      gradient="from-violet-500 to-purple-600"
    >
      {/* ── Input state ─────────────────────────────────────────────────────── */}
      {!hasResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>{t("pages.humanizer.inputTitle")}</CardTitle>
                <CardDescription>{t("pages.humanizer.inputDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input mode tabs */}
                <div className="flex flex-wrap p-1 rounded-lg bg-muted gap-1">
                  <button
                    onClick={() => setInputMode("upload")}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      inputMode === "upload"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UploadCloud size={13} /> {t("common.uploadFile")}
                  </button>
                  <button
                    onClick={() => setInputMode("paste")}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      inputMode === "paste"
                        ? "bg-background shadow text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ClipboardPaste size={13} /> {t("common.pasteText")}
                  </button>
                </div>

                {/* Upload zone */}
                {inputMode === "upload" && (
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={onDrop}
                    onClick={() => fileRef.current?.click()}
                    className="cursor-pointer rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 hover:bg-primary/5 transition-all p-10 text-center"
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".pdf,.docx,.txt,.md,.jpg,.jpeg,.png,.webp"
                      onChange={onFilePick}
                      hidden
                    />
                    <UploadCloud className="w-10 h-10 mx-auto mb-3 text-muted-foreground/60" />
                    <p className="font-medium text-sm">{t("pages.humanizer.dropZoneText")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("pages.humanizer.supportedFormats")}</p>
                    {isLoading && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-primary text-sm">
                        <Loader2 size={14} className="animate-spin" />{step}
                      </div>
                    )}
                  </div>
                )}

                {/* Paste area */}
                {inputMode === "paste" && (
                  <div className="space-y-2">
                    {fileName && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <FileText size={12} />
                        <span className="truncate">{fileName}</span>
                        <button onClick={() => { setFileName(""); setInputText(""); }} className="ml-auto hover:text-foreground">
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    <div className="relative">
                      <Textarea
                        placeholder={t("pages.humanize.textPlaceholder")}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        className="min-h-[260px] resize-none pr-8 font-mono text-sm leading-relaxed"
                      />
                      {inputText && (
                        <button
                          onClick={() => { setInputText(""); setFileName(""); }}
                          className="absolute top-2 right-2 p-1 rounded hover:bg-muted opacity-60 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span className={overLimit ? "text-destructive font-medium" : ""}>
                        {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} {t("common.words")}
                      </span>
                      {overLimit && <span className="text-destructive">{t("pages.humanize.exceedsLimit")}</span>}
                    </div>
                  </div>
                )}

                {/* Mode */}
                <div className="space-y-1.5">
                  <Label>{t("pages.humanize.writingMode")}</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <span className="font-medium">{m.label}</span>
                          <span className="ml-1 text-muted-foreground text-xs">— {m.desc}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full" size="lg"
                  disabled={!inputText.trim() || overLimit || isLoading || isParaphrasing}
                  onClick={handleHumanize}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("pages.humanize.humanizingEllipsis")}</>
                  ) : (
                    <><Wand2 className="w-4 h-4 mr-2" />{t("pages.humanize.humanizeText")}</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Empty state right */}
          <div className="lg:col-span-7">
            <Card className="h-full min-h-[400px] flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-16 px-8">
                <Wand2 className="w-16 h-16 mx-auto mb-4 opacity-15" />
                <p className="font-medium">{t("pages.humanizer.emptyState")}</p>
                <p className="text-sm mt-2">{t("pages.humanizer.emptyStateHint")}</p>
                <div className="mt-6 text-xs text-left max-w-sm mx-auto space-y-1.5 bg-muted/30 p-4 rounded-lg">
                  <p className="font-medium text-center mb-2">{t("pages.humanizer.features")}</p>
                  <ul className="space-y-1">
                    <li>• {t("pages.humanizer.feature1")}</li>
                    <li>• {t("pages.humanizer.feature2")}</li>
                    <li>• {t("pages.humanizer.feature3")}</li>
                    <li>• {t("pages.humanizer.feature4")}</li>
                    <li>• {t("pages.humanizer.feature5")}</li>
                    <li>• {t("pages.humanizer.feature6")}</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Results state ────────────────────────────────────────────────────── */}
      {hasResult && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel: stats + actions */}
          <div className="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {t("pages.humanize.aiDetectionScores")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Score rings */}
                <div className="flex items-center justify-around">
                  <div className="text-center space-y-2">
                    <ScoreRing value={originalAiScore} label={t("pages.humanize.scoreOriginalLabel")} sublabel={t("pages.humanize.scoreBeforeLabel")} />
                    <ScoreBadge score={originalAiScore} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl text-muted-foreground">→</span>
                    {improvement !== null && improvement > 0 && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px] font-semibold">
                        −{improvement}%
                      </Badge>
                    )}
                  </div>
                  <div className="text-center space-y-2">
                    <ScoreRing value={humanizedAiScore} label={t("pages.humanize.scoreHumanizedLabel")} sublabel={t("pages.humanize.scoreAfterLabel")} />
                    <ScoreBadge score={humanizedAiScore} />
                  </div>
                </div>

                {/* Rounds history */}
                {rounds.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("pages.humanize.statRounds")}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {rounds.map(r => (
                        <span key={r.roundNumber} className="px-2 py-1 rounded bg-muted text-[11px] font-mono">
                          R{r.roundNumber}: {r.aiBefore}%→{r.aiAfter}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                {humanizedAiScore === 0 ? (
                  <div className="rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-sm flex items-center gap-2">
                    <Sparkles size={14} /> {t("pages.humanize.fullHuman")}
                  </div>
                ) : (
                  <Button
                    className="w-full" size="sm"
                    disabled={isParaphrasing || isLoading}
                    onClick={handleParaphrase}
                  >
                    {isParaphrasing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("pages.humanize.paraphrasingEllipsis")}</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" />{t("pages.humanize.paraphraseRound", { n: rounds.length + 1 })}</>
                    )}
                  </Button>
                )}

                {/* Download menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <Download className="w-4 h-4" /> {t("common.download")}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => downloadBlob(humanizedText, "humanized-text.txt")}>
                      <FileText className="w-4 h-4 mr-2" />{t("pages.humanize.downloadHumanizedTxt")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadBlob(originalText, "original-text.txt")}>
                      <FileText className="w-4 h-4 mr-2" />{t("pages.humanize.downloadOriginalTxt")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => exportHtml("humanized")}>
                      <FileCode className="w-4 h-4 mr-2" />{t("pages.humanize.downloadHumanizedHtml")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportHtml("original")}>
                      <FileCode className="w-4 h-4 mr-2" />{t("pages.humanize.downloadOriginalHtml")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => downloadBlob(
                      buildReport({ originalText, humanizedText, originalAiScore, humanizedAiScore, rounds, scores, t }),
                      "ai-detection-report.txt"
                    )}>
                      <FileBarChart className="w-4 h-4 mr-2" />{t("pages.humanize.downloadDetectionReport")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Next steps suggestion */}
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                    {t("pages.humanize.nextSteps")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 justify-start text-left h-auto py-2"
                    onClick={handleGrammarCheck}
                  >
                    <Sparkles className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <div className="text-xs font-medium">{t("pages.humanize.checkGrammarBtn")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("pages.humanize.checkGrammarDesc")}</div>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 justify-start text-left h-auto py-2"
                    onClick={handleCitationCheck}
                  >
                    <BookOpenCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-xs font-medium">{t("pages.humanize.checkCitationsBtn")}</div>
                      <div className="text-[10px] text-muted-foreground">{t("pages.humanize.checkCitationsDesc")}</div>
                    </div>
                  </Button>
                </div>

                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleReset}>
                  <Trash2 className="w-4 h-4" /> {t("common.clear")}
                </Button>
                {undoSnapshot && (
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground" onClick={handleUndoReset}>
                    <Undo2 className="w-4 h-4" /> {t("common.undo")}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right panel: tabbed content */}
          <div className="lg:col-span-8">
            <Card>
              <CardContent className="pt-5">
                <Tabs defaultValue="humanized">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <TabsList>
                      <TabsTrigger value="humanized" className="gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />{t("pages.humanize.tabHumanized")}
                      </TabsTrigger>
                      <TabsTrigger value="original" className="gap-1.5">
                        <FileText className="w-3.5 h-3.5" />{t("pages.humanize.tabOriginal")}
                      </TabsTrigger>
                      <TabsTrigger value="report" className="gap-1.5">
                        <FileBarChart className="w-3.5 h-3.5" />{t("pages.humanize.tabReport")}
                      </TabsTrigger>
                    </TabsList>

                    {/* Re-run */}
                    <Button variant="outline" size="sm" onClick={handleHumanize} disabled={isLoading || isParaphrasing} className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" />{t("pages.humanize.rerun")}
                    </Button>
                  </div>

                  {/* ── Humanized tab ── */}
                  <TabsContent value="humanized" className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {countWords(humanizedText).toLocaleString()} {t("common.words")}
                        </span>
                        <ScoreBadge score={humanizedAiScore} />
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => copyText(humanizedText, "h")} className="gap-1.5">
                          {copiedH ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedH ? t("pages.humanize.copied") : t("common.copy")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadBlob(humanizedText, "humanized-text.txt")} className="gap-1.5">
                          <FileDown className="w-3.5 h-3.5" />{t("common.download")}
                        </Button>
                      </div>
                    </div>

                    {/* Legend */}
                    {scores.length > 0 && (
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-red-500/30 border-b border-red-500/60" />{t("pages.humanize.legendAIFlagged")}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-emerald-500/20 border-b border-emerald-500/50" />{t("pages.humanize.legendHuman")}
                        </span>
                        {speaking && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm bg-primary/30" />{t("pages.humanize.legendReading")}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Sentence-highlighted text */}
                    <div className="border rounded-lg bg-card min-h-[380px] max-h-[60vh] overflow-y-auto p-5 custom-scrollbar text-sm leading-7">
                      {scores.length === 0 ? (
                        <p className="whitespace-pre-wrap">{humanizedText}</p>
                      ) : (
                        <p>
                          {scores.map(s => (
                            <span
                              key={s.idx}
                              ref={el => { sentRefs.current[s.idx] = el; }}
                              className={`${s.isAI ? "sentence-ai" : "sentence-human"} ${currentSentIdx === s.idx ? "sentence-reading" : ""}`}
                              title={t("pages.humanize.aiScoreTitle", { score: Math.round(s.score) })}
                            >
                              {s.text}{" "}
                            </span>
                          ))}
                        </p>
                      )}
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

                  {/* ── Original tab ── */}
                  <TabsContent value="original" className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {countWords(originalText).toLocaleString()} {t("common.words")}
                        </span>
                        <ScoreBadge score={originalAiScore} />
                      </div>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => copyText(originalText, "o")} className="gap-1.5">
                          {copiedO ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedO ? t("pages.humanize.copied") : t("common.copy")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => downloadBlob(originalText, "original-text.txt")} className="gap-1.5">
                          <FileDown className="w-3.5 h-3.5" />{t("common.download")}
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg bg-muted/20 min-h-[380px] max-h-[60vh] overflow-y-auto p-5 custom-scrollbar text-sm leading-7">
                      {originalScores.length === 0 ? (
                        <p className="whitespace-pre-wrap text-muted-foreground">{originalText}</p>
                      ) : (
                        <p>
                          {originalScores.map(s => (
                            <span
                              key={s.idx}
                              className={s.isAI ? "sentence-ai" : "sentence-human"}
                              title={t("pages.humanize.aiScoreTitle", { score: Math.round(s.score) })}
                            >
                              {s.text}{" "}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Report tab ── */}
                  <TabsContent value="report" className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileBarChart className="w-4 h-4 text-primary" />{t("pages.humanize.detectionReport")}
                      </h3>
                      <Button
                        size="sm"
                        onClick={() => downloadBlob(
                          buildReport({ originalText, humanizedText, originalAiScore, humanizedAiScore, rounds, scores, t }),
                          "ai-detection-report.txt"
                        )}
                        className="gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />{t("pages.humanize.downloadReport")}
                      </Button>
                    </div>

                    {/* Summary stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="border rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("pages.humanize.statAI")}</div>
                        <div className="text-2xl font-bold mt-0.5">{humanizedAiScore ?? "—"}%</div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("pages.humanize.statFlagged")}</div>
                        <div className="text-2xl font-bold mt-0.5">{scores.filter(s => s.isAI).length}/{scores.length}</div>
                      </div>
                      <div className="border rounded-lg p-3">
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("pages.humanize.statRounds")}</div>
                        <div className="text-2xl font-bold mt-0.5">{rounds.length}</div>
                      </div>
                    </div>

                    {/* Round table */}
                    {rounds.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("pages.humanize.roundProgression")}</p>
                        {rounds.map(r => (
                          <div key={r.roundNumber} className="flex items-center justify-between border rounded-lg px-3 py-2 text-sm">
                            <span className="font-mono text-muted-foreground">{t("pages.humanize.roundN", { n: r.roundNumber })}</span>
                            <span>
                              <span className="text-destructive">{r.aiBefore}%</span>
                              {" → "}
                              <span className="text-emerald-600">{r.aiAfter}%</span>
                            </span>
                            <span className="text-xs text-muted-foreground">−{r.aiBefore - r.aiAfter}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Sentence breakdown */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t("pages.humanize.sentenceAnalysis")}
                      </p>
                      <div className="max-h-[40vh] overflow-y-auto space-y-1 custom-scrollbar">
                        {scores.length === 0 && (
                          <p className="text-sm text-muted-foreground py-4 text-center">{t("pages.humanize.noSentenceData")}</p>
                        )}
                        {scores.map(s => (
                          <div
                            key={s.idx}
                            className={`text-xs rounded-md px-3 py-2 border ${
                              s.isAI
                                ? "bg-destructive/5 border-destructive/20"
                                : "bg-emerald-500/5 border-emerald-500/20"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest mb-1">
                              <span className={s.isAI ? "text-destructive" : "text-emerald-600"}>
                                {s.isAI ? t("pages.humanize.sentenceAI") : t("pages.humanize.sentenceHuman")}
                              </span>
                              <span className="font-mono text-muted-foreground">{Math.round(s.score)}{t("pages.humanize.aiScoreSuffix")}</span>
                            </div>
                            <p className="text-foreground/80">{s.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
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
