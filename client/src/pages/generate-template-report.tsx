import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Upload, Settings, Download, Save, X, FileIcon,
  FileDown, FileCode, Printer, Clipboard, RefreshCw, LayoutTemplate,
  Loader2, FileText, PenLine, Shuffle, Wand2, BookOpenCheck,
} from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLocation } from "wouter";
import { storeForHumanizer, storeForCitations } from "@/lib/humanize-transfer";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useRandomTopic } from "@/hooks/use-random-topic";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { UsageGate } from "@/components/usage-gate";
import { useGeminiTTS } from "@/hooks/use-gemini-tts";
import { DocumentTTSControls } from "@/components/document-tts-controls";
import { parseMarkdownToHtml, sanitizeHtml } from "@/lib/markdown-parser";
import { saveDocument } from "@/lib/firebase";
import { exportHtmlToDocx } from "@/lib/docx-export";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ToneType } from "@shared/schema";

// Accept all formats the server can process
const ALL_FORMATS = ".pdf,.docx,.doc,.txt,.rtf,.odt,.pptx,.ppt,.xlsx,.xls,.csv,.md,.jpg,.jpeg,.png,.webp,.gif";

export default function GenerateTemplateReport() {
  const [, navigate] = useLocation();
  // ── template input ──────────────────────────────────────────────────────────
  const [templateTab, setTemplateTab] = useState<"upload" | "paste">("upload");
  const [pastedTemplate, setPastedTemplate] = useState("");
  const templateUpload = useFileUpload();

  // ── guidelines input ────────────────────────────────────────────────────────
  const [guidelines, setGuidelines] = useState("");
  const guidelinesUpload = useFileUpload();
  // When a guidelines file is uploaded, append its extracted text into the textarea
  const prevGuidelinesExtracted = useRef("");
  useEffect(() => {
    if (
      guidelinesUpload.extractedText &&
      guidelinesUpload.extractedText !== prevGuidelinesExtracted.current
    ) {
      prevGuidelinesExtracted.current = guidelinesUpload.extractedText;
      setGuidelines(prev =>
        prev ? `${prev}\n\n${guidelinesUpload.extractedText}` : guidelinesUpload.extractedText
      );
    }
  }, [guidelinesUpload.extractedText]);

  // ── settings ────────────────────────────────────────────────────────────────
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<ToneType>("academic");
  const [citationStyle, setCitationStyle] = useState("auto");
  const [targetLength, setTargetLength] = useState("auto");

  // ── generation state ────────────────────────────────────────────────────────
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  const [sectionImageUrls, setSectionImageUrls] = useState<Record<number, string>>({});
  const [regeneratingSections, setRegeneratingSections] = useState<Set<number>>(new Set());
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const pendingCheckUsage = useRef<(() => Promise<boolean>) | null>(null);

  // ── save state ──────────────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const tts = useGeminiTTS({ tone });
  const { generateTopic, isLoading: isLoadingTopic } = useRandomTopic();

  // ── fetch images for every section ─────────────────────────────────────────
  useEffect(() => {
    if (!generatedContent?.sections) return;
    setSectionImageUrls({});
    generatedContent.sections.forEach(async (section: any, index: number) => {
      const imageQuery = section.image_prompt || section.heading || section.title;
      if (!imageQuery) return;
      try {
        const res: any = await apiRequest("POST", "/api/images/random", { query: imageQuery });
        const url = res?.image?.webformatURL || res?.image?.largeImageURL;
        if (url) setSectionImageUrls(prev => ({ ...prev, [index]: url }));
      } catch {
        // image not critical — fail silently
      }
    });
  }, [generatedContent]);

  const handleSuggestTopic = async () => {
    const result = await generateTopic();
    if (result?.topic) {
      setTopic(result.topic);
      toast({ title: "Topic suggested", description: `From: ${result.category}` });
    }
  };

  // ── derived template content ────────────────────────────────────────────────
  const templateContent =
    templateTab === "paste" ? pastedTemplate : templateUpload.extractedText;

  const canGenerate =
    !isGenerating &&
    !isSubmitting &&
    !templateUpload.isProcessing &&
    !guidelinesUpload.isProcessing &&
    (!!templateContent || !!topic || !!guidelines);

  // ── core generate ───────────────────────────────────────────────────────────
  const runGenerate = async (checkUsage: () => Promise<boolean>) => {
    const allowed = await checkUsage();
    if (!allowed) return;

    setIsGenerating(true);
    setIsSaved(false);
    setProgress(20);

    try {
      setProgress(50);
      const res: any = await apiRequest("POST", "/api/generate/template-report", {
        templateContent: templateContent || undefined,
        topic: topic || undefined,
        guidelines: guidelines || undefined,
        tone,
        citationStyle,
        targetLength,
      });
      setProgress(90);

      if (res?.content) {
        setGeneratedContent(res.content);
        toast({ title: "Report generated!", description: "Your template report is ready." });
      } else {
        throw new Error("No content returned from server");
      }
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err.message?.replace(/^\d+:\s*/, "") || "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      setProgress(100);
      setTimeout(() => setProgress(0), 800);
    }
  };

  const handleGenerate = async (checkUsage: () => Promise<boolean>) => {
    if (isSubmitting || isGenerating) return;
    if (generatedContent) {
      pendingCheckUsage.current = checkUsage;
      setShowConfirmDialog(true);
      return;
    }
    setIsSubmitting(true);
    try { await runGenerate(checkUsage); } finally { setIsSubmitting(false); }
  };

  const handleConfirmRegenerate = async () => {
    setShowConfirmDialog(false);
    const check = pendingCheckUsage.current;
    if (!check) return;
    pendingCheckUsage.current = null;
    setIsSubmitting(true);
    try { await runGenerate(check); } finally { setIsSubmitting(false); }
  };

  // ── section regenerate ──────────────────────────────────────────────────────
  const handleRegenerateSection = async (index: number, heading: string) => {
    setRegeneratingSections(prev => new Set(prev).add(index));
    try {
      const res: any = await apiRequest("POST", "/api/generate/section", {
        topic: topic || "Based on uploaded template",
        sectionHeading: heading,
        tone,
      });
      if (res.content && generatedContent?.sections) {
        const updated = generatedContent.sections.map((s: any, i: number) =>
          i === index ? { ...s, content: res.content } : s
        );
        setGeneratedContent({ ...generatedContent, sections: updated });
      }
    } catch {
      toast({ title: "Failed to regenerate section", variant: "destructive" });
    } finally {
      setRegeneratingSections(prev => { const s = new Set(prev); s.delete(index); return s; });
    }
  };

  // ── copy ────────────────────────────────────────────────────────────────────
  const handleCopy = () => {
    if (!generatedContent?.sections) return;
    const text = [
      generatedContent.title ?? "",
      generatedContent.abstract ? `Abstract\n${generatedContent.abstract}` : "",
      ...generatedContent.sections.map((s: any) => `${s.heading ?? s.title}\n\n${s.content ?? ""}`),
    ].filter(Boolean).join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: "Copied to clipboard" })
    );
  };

  // ── export ──────────────────────────────────────────────────────────────────
  const handleExportDocx = async () => {
    if (!generatedContent?.sections) return;
    try {
      let html = `<h1>${generatedContent.title ?? "Template Report"}</h1>`;
      if (generatedContent.abstract) {
        html += `<div><h2>Abstract</h2><p>${generatedContent.abstract}</p></div>`;
      }
      generatedContent.sections.forEach((s: any, i: number) => {
        html += `<h2>${s.heading ?? s.title}</h2>${sanitizeHtml(parseMarkdownToHtml(s.content ?? ""))}`;
        if (sectionImageUrls[i]) {
          html += `<figure style="text-align:center;margin:1.5em 0"><img src="${sectionImageUrls[i]}" alt="${s.image_caption || `Figure ${i + 1}`}" style="max-width:100%;border-radius:6px;border:1px solid #e2e8f0" />${s.image_caption ? `<figcaption style="font-size:0.85em;margin-top:0.5em">${s.image_caption}</figcaption>` : ""}</figure>`;
        }
      });
      if (generatedContent.references?.length) {
        html += `<h2>References</h2>` + generatedContent.references.map((r: string) => `<p>${r}</p>`).join("");
      }
      await exportHtmlToDocx(html, { title: generatedContent.title ?? "template-report" });
      toast({ title: "DOCX exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleExportTxt = () => {
    if (!generatedContent?.sections) return;
    const lines: string[] = [];
    if (generatedContent.title) lines.push(generatedContent.title, "");
    if (generatedContent.abstract) lines.push("Abstract", generatedContent.abstract, "");
    generatedContent.sections.forEach((s: any) => {
      lines.push(s.heading ?? s.title, "─".repeat(40), s.content ?? "", "");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(generatedContent.title ?? "report").replace(/\s+/g, "_")}.txt`;
    a.click();
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) { toast({ title: "Allow popups to print", variant: "destructive" }); return; }
    let html = `<h1>${generatedContent?.title ?? ""}</h1>`;
    if (generatedContent?.abstract) html += `<p><em>${generatedContent.abstract}</em></p>`;
    generatedContent?.sections?.forEach((s: any, i: number) => {
      html += `<h2>${s.heading ?? s.title}</h2>${parseMarkdownToHtml(s.content ?? "")}`;
      if (sectionImageUrls[i]) {
        html += `<figure style="text-align:center;margin:1.5em 0"><img src="${sectionImageUrls[i]}" alt="${s.image_caption || `Figure ${i + 1}`}" style="max-width:100%" />${s.image_caption ? `<figcaption>${s.image_caption}</figcaption>` : ""}</figure>`;
      }
    });
    win.document.write(`<html><head><title>${generatedContent?.title ?? "Report"}</title><style>body{font-family:serif;max-width:800px;margin:40px auto;line-height:1.7}h2{margin-top:2em}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.print();
  };

  // ── save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!generatedContent) return;
    if (!isAuthenticated) { toast({ title: "Sign in to save", variant: "destructive" }); return; }
    setIsSaving(true);
    try {
      await saveDocument({
        type: "report",
        title: generatedContent.title ?? "Template Report",
        topic: topic || guidelines || "Template-based report",
        content: generatedContent,
        settings: { tone, citationStyle, targetLength, guidelines },
        language: "en",
      });
      if (user) queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });
      setIsSaved(true);
      toast({ title: "Saved!", description: "Report saved to My Projects." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const wordCount = generatedContent?.sections
    ? [generatedContent.abstract ?? "", ...generatedContent.sections.map((s: any) => s.content ?? "")]
        .join(" ").trim().split(/\s+/).filter(Boolean).length
    : 0;

  const hasContent = !!generatedContent;

  const handleHumanize = () => {
    if (!generatedContent) return;
    storeForHumanizer(generatedContent);
    navigate("/humanize");
  };

  const handleCitationCheck = () => {
    if (!generatedContent) return;
    storeForCitations(generatedContent);
    navigate("/citations");
  };

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, openPricing }) => (
        <>
          <GeneratorLayout
            title="Template Report Generator"
            description="Upload or paste your template, add guidelines, and let AI generate a report that follows your exact structure"
            icon={<LayoutTemplate className="w-8 h-8" />}
            gradient="from-violet-500 to-purple-600"
          >
            <div className="grid grid-cols-12 gap-6">

              {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
              <div className="col-span-12 lg:col-span-4 space-y-6">

                {/* Template Input */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LayoutTemplate className="w-5 h-5" />
                      Template
                    </CardTitle>
                    <CardDescription>
                      Upload a file or paste your template — the AI follows its structure exactly
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={templateTab} onValueChange={(v) => setTemplateTab(v as "upload" | "paste")}>
                      <TabsList className="w-full mb-4">
                        <TabsTrigger value="upload" className="flex-1 gap-1.5">
                          <Upload className="w-3.5 h-3.5" /> Upload File
                        </TabsTrigger>
                        <TabsTrigger value="paste" className="flex-1 gap-1.5">
                          <PenLine className="w-3.5 h-3.5" /> Paste Text
                        </TabsTrigger>
                      </TabsList>

                      {/* Upload tab */}
                      <TabsContent value="upload" className="space-y-3 mt-0">
                        <div
                          className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
                          onClick={() => document.getElementById("template-upload")?.click()}
                        >
                          <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium">Click to upload template</p>
                          <p className="text-xs text-muted-foreground mt-1">All formats supported</p>
                          <input
                            id="template-upload"
                            type="file"
                            className="hidden"
                            accept={ALL_FORMATS}
                            multiple
                            onChange={(e) => e.target.files && templateUpload.handleFileUpload(e.target.files)}
                          />
                        </div>

                        {templateUpload.isProcessing && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Extracting content…
                          </div>
                        )}

                        {templateUpload.uploadedFiles.length > 0 && (
                          <div className="space-y-1.5">
                            {templateUpload.uploadedFiles.map((file, i) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                <FileIcon className="w-4 h-4 text-primary shrink-0" />
                                <span className="text-xs flex-1 truncate">{file.name}</span>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                                  onClick={() => templateUpload.removeFile(i)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                            {templateUpload.extractedText && (
                              <Badge variant="secondary" className="text-xs">
                                ✓ {templateUpload.extractedText.split(/\s+/).filter(Boolean).length} words extracted
                              </Badge>
                            )}
                          </div>
                        )}
                      </TabsContent>

                      {/* Paste tab */}
                      <TabsContent value="paste" className="mt-0">
                        <Textarea
                          value={pastedTemplate}
                          onChange={(e) => setPastedTemplate(e.target.value)}
                          placeholder="Paste your template here — headings, sections, placeholders, anything you want the AI to follow…"
                          className="min-h-[160px] resize-y font-mono text-xs"
                        />
                        {pastedTemplate && (
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {pastedTemplate.split(/\s+/).filter(Boolean).length} words
                          </p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Guidelines */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Guidelines
                    </CardTitle>
                    <CardDescription>
                      Type your requirements or upload a guidelines file — both are combined
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={guidelines}
                      onChange={(e) => setGuidelines(e.target.value)}
                      placeholder="Describe requirements, target audience, mandatory sections, formatting rules, word count targets, etc."
                      className="min-h-[120px] resize-y"
                    />

                    {/* Guidelines file upload */}
                    <div>
                      <Label className="text-xs text-muted-foreground mb-2 block">
                        Or attach a guidelines file — its content will be appended above
                      </Label>
                      <div
                        className="border border-dashed border-border rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                        onClick={() => document.getElementById("guidelines-upload")?.click()}
                      >
                        <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {guidelinesUpload.isProcessing ? "Processing…" : "Attach file (all formats)"}
                        </p>
                        <input
                          id="guidelines-upload"
                          type="file"
                          className="hidden"
                          accept={ALL_FORMATS}
                          multiple
                          onChange={(e) => e.target.files && guidelinesUpload.handleFileUpload(e.target.files)}
                        />
                      </div>

                      {guidelinesUpload.uploadedFiles.length > 0 && (
                        <div className="space-y-1 mt-2">
                          {guidelinesUpload.uploadedFiles.map((file, i) => (
                            <div key={i} className="flex items-center gap-2 p-1.5 bg-muted/40 rounded text-xs">
                              <FileIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="flex-1 truncate">{file.name}</span>
                              <Button
                                variant="ghost" size="icon" className="h-5 w-5 shrink-0"
                                onClick={() => guidelinesUpload.removeFile(i)}
                              >
                                <X className="w-2.5 h-2.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* Topic */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="topic">
                          Report Topic
                          <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSuggestTopic}
                          disabled={isLoadingTopic}
                          className="text-xs h-7 px-2"
                        >
                          {isLoadingTopic ? (
                            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Suggesting…</>
                          ) : (
                            <><Shuffle className="w-3 h-3 mr-1" /> Random Topic</>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. Impact of AI on academic research productivity"
                        rows={2}
                        className="resize-none"
                        data-testid="input-topic"
                      />
                    </div>

                    {/* Tone */}
                    <div className="space-y-2">
                      <Label htmlFor="tone">Writing Tone</Label>
                      <Select value={tone} onValueChange={(v) => setTone(v as ToneType)}>
                        <SelectTrigger id="tone"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="academic">Academic</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="persuasive">Persuasive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Citation Style */}
                    <div className="space-y-2">
                      <Label htmlFor="citation">Citation Style</Label>
                      <Select value={citationStyle} onValueChange={setCitationStyle}>
                        <SelectTrigger id="citation"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (from template)</SelectItem>
                          <SelectItem value="apa">APA</SelectItem>
                          <SelectItem value="ieee">IEEE</SelectItem>
                          <SelectItem value="harvard">Harvard</SelectItem>
                          <SelectItem value="chicago">Chicago</SelectItem>
                          <SelectItem value="mla">MLA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Target Length */}
                    <div className="space-y-2">
                      <Label htmlFor="length">Target Length</Label>
                      <Select value={targetLength} onValueChange={setTargetLength}>
                        <SelectTrigger id="length"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="3-5">Short (3–5 pages)</SelectItem>
                          <SelectItem value="5-10">Medium (5–10 pages)</SelectItem>
                          <SelectItem value="10-20">Long (10–20 pages)</SelectItem>
                          <SelectItem value="20-40">Extended (20–40 pages)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Usage */}
                    {remainingAttempts !== Infinity && (
                      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span>{remainingAttempts} generation{remainingAttempts !== 1 ? "s" : ""} remaining</span>
                        <button type="button" onClick={openPricing} className="text-primary hover:underline font-medium">
                          View Pricing
                        </button>
                      </div>
                    )}

                    {/* Generate */}
                    {remainingAttempts === 0 ? (
                      <Button className="w-full" size="lg" onClick={openPricing}>
                        <Sparkles className="w-4 h-4 mr-2" /> Upgrade to Generate
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => handleGenerate(checkUsage)}
                        disabled={!canGenerate}
                        data-testid="button-generate"
                      >
                        {isGenerating || isSubmitting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" /> Generate Report</>
                        )}
                      </Button>
                    )}

                    {isGenerating && progress > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Generating…</span><span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── RIGHT PANEL ────────────────────────────────────────────── */}
              <div className="col-span-12 lg:col-span-8">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle>Preview</CardTitle>
                        {hasContent && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {wordCount.toLocaleString()} words · {generatedContent.sections?.length ?? 0} sections
                          </p>
                        )}
                      </div>

                      {hasContent && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <DocumentTTSControls
                            status={tts.status}
                            progress={tts.progress}
                            onPlay={() => tts.play(generatedContent)}
                            onPause={tts.pause}
                            onResume={tts.resume}
                            onStop={tts.stop}
                            onRestart={tts.restart}
                            disabled={!generatedContent}
                            showProgress={false}
                            compact={true}
                            engineMode={tts.engineMode}
                            voiceName={tts.voiceName}
                            voices={tts.voices}
                            onEngineModeChange={tts.setEngineMode}
                            onVoiceChange={tts.setVoiceName}
                            azureVoices={tts.azureVoices}
                          />

                          <Button variant="outline" size="sm" onClick={handleCopy}>
                            <Clipboard className="w-4 h-4 mr-1" /> Copy
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleHumanize}
                            disabled={!hasContent}
                            title="Send to AI Humanizer"
                            aria-label="Send to AI Humanizer"
                          >
                            <Wand2 className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Humanize</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCitationCheck}
                            disabled={!hasContent}
                            title="Check Citations"
                            aria-label="Check Citations"
                          >
                            <BookOpenCheck className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Check Citations</span>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 mr-1" /> Export
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={handleExportDocx}>
                                <FileDown className="w-4 h-4 mr-2" /> Download DOCX
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={handleExportTxt}>
                                <FileCode className="w-4 h-4 mr-2" /> Download TXT
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={handlePrint}>
                                <Printer className="w-4 h-4 mr-2" /> Print
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <div className="relative">
                            {!isSaved && !isSaving && (
                              <span className="absolute -top-1.5 -right-1.5 z-10 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                              </span>
                            )}
                            <Button
                              variant="outline" size="sm"
                              onClick={handleSave}
                              disabled={isSaving || !isAuthenticated}
                            >
                              {isSaving
                                ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                : <Save className="w-4 h-4 mr-1" />}
                              {isSaved ? "Saved" : "Save"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert bg-background p-6 rounded-lg border min-h-[600px] [&_code]:text-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:text-foreground [&_pre_code]:bg-transparent"
                      data-testid="preview-content"
                    >
                      {!hasContent ? (
                        <div className="flex flex-col items-center justify-center h-[560px] text-center text-muted-foreground">
                          <LayoutTemplate className="w-16 h-16 mb-4 opacity-20" />
                          <p className="text-lg font-medium">No report yet</p>
                          <p className="text-sm mt-2 max-w-sm">
                            Upload or paste your template, add a topic and guidelines, then click Generate.
                          </p>
                        </div>
                      ) : (
                        <>
                          <h1 className="text-center mb-8">{generatedContent.title}</h1>

                          {generatedContent.abstract && (
                            <div className="bg-muted p-4 rounded-lg mb-6">
                              <h2>Abstract</h2>
                              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(generatedContent.abstract)) }} />
                            </div>
                          )}

                          {generatedContent.sections?.map((section: any, index: number) => (
                            <div key={index} className="mb-8">
                              <div className="flex items-center justify-between mb-2 gap-2">
                                <h2 className="!my-0 flex-1">{section.heading ?? section.title}</h2>
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => handleRegenerateSection(index, section.heading ?? section.title)}
                                  disabled={regeneratingSections.has(index)}
                                  className="h-7 px-2 text-xs shrink-0"
                                >
                                  <RefreshCw className={`w-3 h-3 mr-1 ${regeneratingSections.has(index) ? "animate-spin" : ""}`} />
                                  Regenerate
                                </Button>
                              </div>
                              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(section.content ?? "")) }} />
                              {sectionImageUrls[index] && (
                                <figure className="my-6 not-prose">
                                  <img
                                    src={sectionImageUrls[index]}
                                    alt={section.image_caption || `Figure ${index + 1}`}
                                    className="mx-auto rounded-lg border max-w-full"
                                  />
                                  {section.image_caption && (
                                    <figcaption className="text-center text-sm font-semibold mt-2 text-muted-foreground">
                                      {section.image_caption}
                                    </figcaption>
                                  )}
                                </figure>
                              )}
                            </div>
                          ))}

                          {generatedContent.references?.length > 0 && (
                            <div className="mt-12 border-t pt-6">
                              <h2>References</h2>
                              <div className="space-y-2">
                                {generatedContent.references.map((ref: string, idx: number) => (
                                  <div key={idx} className="text-sm pl-5 -indent-5">{ref}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </GeneratorLayout>

          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Overwrite existing report?</AlertDialogTitle>
                <AlertDialogDescription>
                  You already have a generated report. Generating a new one will replace it. Make sure you have saved or exported anything you want to keep.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRegenerate}>Generate New</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </UsageGate>
  );
}
