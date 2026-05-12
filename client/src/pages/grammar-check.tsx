import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { readGrammarCheckPrefill } from "@/lib/humanize-transfer";
import { useMutation } from "@tanstack/react-query";
import {
  Sparkles, Loader2, CheckCircle2, RotateCcw, Eraser, Copy, Languages,
  Upload, Download, Printer, Globe, FileOutput,
} from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SpeechPlayer } from "@/components/speech-player";
import { useSpeech, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";

interface GrammarSuggestion {
  original: string;
  suggested: string;
  type: string;
  explanation: string;
}

interface GrammarResponse {
  suggestions: GrammarSuggestion[];
}

const typeColors: Record<string, string> = {
  grammar: "border-l-red-500",
  spelling: "border-l-orange-500",
  punctuation: "border-l-yellow-500",
  style: "border-l-blue-500",
  clarity: "border-l-purple-500",
  word_choice: "border-l-green-500",
};

const getSampleTexts = (t: (key: string) => string) => [
  {
    label: t("pages.grammarCheck.sampleResearchAbstract"),
    text: t("pages.grammarCheck.sampleResearchText"),
  },
  {
    label: t("pages.grammarCheck.sampleThesisIntroduction"),
    text: t("pages.grammarCheck.sampleThesisText"),
  },
  {
    label: t("pages.grammarCheck.sampleLabReport"),
    text: t("pages.grammarCheck.sampleLabText"),
  },
];

export default function GrammarCheck() {
  const { t } = useTranslation();
  const sampleTexts = getSampleTexts(t);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [textToCheck, setTextToCheck] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [grammarSuggestions, setGrammarSuggestions] = useState<GrammarSuggestion[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { supported, voices, speaking, paused, progress, speak, stop, pause, resume } = useSpeech();
  const prefs0 = getSpeechPrefs();
  const [speechRate, setSpeechRate] = useState<number>(prefs0.rate ?? 1);
  const [speechVoice, setSpeechVoice] = useState<string>(prefs0.voiceName ?? "");
  const [engineMode, setEngineMode] = useState<string>(prefs0.engineMode ?? "azure");

  const handleTTSPlay = () => {
    if (!textToCheck.trim()) return;
    const sents = textToCheck.match(/[^.!?]+[.!?]+/g) || [textToCheck];
    speak(sents, speechRate, speechVoice);
  };

  useEffect(() => {
    const prefill = readGrammarCheckPrefill();
    if (prefill.trim()) setTextToCheck(prefill);
  }, []);

  const wordCount = textToCheck.trim() ? textToCheck.trim().split(/\s+/).length : 0;
  const charCount = textToCheck.length;
  const hasChanges = !!originalText && originalText !== textToCheck;

  const grammarCheckMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/ai/grammar", { text });
      return response as unknown as GrammarResponse;
    },
    onSuccess: (data) => {
      setGrammarSuggestions(data.suggestions || []);
      if ((data.suggestions?.length ?? 0) === 0) {
        toast({
          title: t("pages.grammarCheck.noIssuesTitle"),
          description: t("pages.grammarCheck.noIssuesDesc"),
        });
      }
    },
    onError: (error: any) => {
      const msg = error?.message ?? "";
      const description = msg.includes("too long") || msg.includes("maximum")
        ? t("pages.grammarCheck.errorTooLong")
        : msg.includes("unavailable") || msg.includes("503") || msg.includes("500")
          ? t("pages.grammarCheck.errorApiDown")
          : t("pages.grammarCheck.errorDesc");
      toast({
        title: t("pages.grammarCheck.errorTitle"),
        description,
        variant: "destructive",
      });
    },
  });

  const handleGrammarCheck = () => {
    if (!textToCheck.trim()) {
      toast({
        title: t("pages.grammarCheck.noTextTitle"),
        description: t("pages.grammarCheck.noTextDesc"),
        variant: "destructive",
      });
      return;
    }
    setOriginalText(textToCheck);
    grammarCheckMutation.mutate(textToCheck);
  };

  const applySuggestion = (suggestion: GrammarSuggestion) => {
    if (suggestion.original && suggestion.suggested) {
      setTextToCheck(prev => prev.replace(suggestion.original, suggestion.suggested));
      setGrammarSuggestions(prev => prev.filter(s => s.original !== suggestion.original));
      toast({
        title: t("pages.grammarCheck.appliedTitle"),
        description: t("pages.grammarCheck.appliedDesc"),
      });
    }
  };

  const applyAllSuggestions = () => {
    let updatedText = textToCheck;
    let count = 0;
    grammarSuggestions.forEach(s => {
      if (s.original && s.suggested) {
        updatedText = updatedText.replace(s.original, s.suggested);
        count++;
      }
    });
    setTextToCheck(updatedText);
    setGrammarSuggestions([]);
    toast({
      title: t("pages.grammarCheck.allAppliedTitle"),
      description: t("pages.grammarCheck.allAppliedDesc", { count }),
    });
  };

  const resetToOriginal = () => {
    if (originalText) {
      setTextToCheck(originalText);
      setGrammarSuggestions([]);
      toast({
        title: t("pages.grammarCheck.resetTitle"),
        description: t("pages.grammarCheck.resetDesc"),
      });
    }
  };

  const clearAll = () => {
    setTextToCheck("");
    setOriginalText("");
    setGrammarSuggestions([]);
    grammarCheckMutation.reset();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t("pages.grammarCheck.copiedTitle") });
    } catch {
      toast({ title: t("pages.grammarCheck.copyFailedTitle"), variant: "destructive" });
    }
  };

  const exportAsHTML = () => {
    const content = textToCheck;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Grammar Checked Text – AcademicGen</title>
  <style>
    body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; font-size: 14pt; }
    h1 { font-size: 18pt; border-bottom: 1px solid #333; padding-bottom: 8px; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 24px; }
    p { margin-bottom: 14px; }
  </style>
</head>
<body>
  <h1>Grammar Checked Text</h1>
  <p class="meta">Exported from AcademicGen Grammar Check on ${new Date().toLocaleDateString()}</p>
  ${content.split('\n').filter(Boolean).map(p => `<p>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`).join('\n')}
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grammar_checked_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: t("pages.grammarCheck.exportedHTML") });
  };

  const exportAsWord = () => {
    const content = textToCheck;
    const docx = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Grammar Checked Text</w:t></w:r></w:p>
<w:p><w:r><w:t>Exported from AcademicGen Grammar Check – ${new Date().toLocaleDateString()}</w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>
${content.split('\n').filter(Boolean).map(p => `<w:p><w:r><w:t>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</w:t></w:r></w:p>`).join('\n')}
</w:body></w:wordDocument>`;
    const blob = new Blob([docx], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grammar_checked_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: t("pages.grammarCheck.exportedWord") });
  };

  const printText = () => {
    const content = textToCheck;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Grammar Checked Text</title>
  <style>
    @media print { body { margin: 1in; font-size: 12pt; line-height: 1.6; } }
    body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; font-size: 12pt; }
    p { margin-bottom: 12pt; }
  </style>
</head>
<body>
${content.split('\n').filter(Boolean).map(p => `<p>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`).join('\n')}
</body>
</html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/files/process", { method: "POST", body: formData });
      if (!response.ok) throw new Error("Failed to process file");
      const data = await response.json();
      const extracted = data.text || "";
      if (extracted.trim()) {
        setTextToCheck(extracted.trim());
        toast({ title: t("pages.grammarCheck.fileLoaded"), description: t("pages.grammarCheck.fileLoadedDesc", { name: file.name }) });
      } else {
        toast({ title: t("pages.grammarCheck.noTextFound"), description: t("pages.grammarCheck.noTextFoundDesc"), variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: t("pages.grammarCheck.uploadFailedTitle"), description: t("pages.grammarCheck.uploadFailedDesc"), variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <GeneratorLayout
      title={t("pages.grammarCheck.title")}
      description={t("pages.grammarCheck.subtitle")}
      icon={<Languages className="w-6 h-6 text-white" />}
      gradient="from-violet-500 to-purple-600"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Input panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t("pages.grammarCheck.inputTitle")}
            </CardTitle>
            <CardDescription>{t("pages.grammarCheck.inputDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Sample topics */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const random = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
                setTextToCheck(random.text);
                setOriginalText("");
                setGrammarSuggestions([]);
                grammarCheckMutation.reset();
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {t("common.surpriseMe")}
            </Button>

            <div className="relative">
              <Textarea
                value={textToCheck}
                onChange={(e) => setTextToCheck(e.target.value)}
                placeholder={t("pages.grammarCheck.placeholder")}
                rows={16}
                className="resize-none pb-8"
                data-testid="textarea-grammar-input"
              />
              <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                {wordCount} {t("common.words")} · {charCount} {t("common.characters")}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={handleGrammarCheck}
                disabled={grammarCheckMutation.isPending || !textToCheck.trim()}
                className="flex-1 min-w-[140px]"
                data-testid="button-check-grammar"
              >
                {grammarCheckMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t("pages.grammarCheck.checking")}</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" />{t("pages.grammarCheck.checkGrammar")}</>
                )}
              </Button>

              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title={t("pages.grammarCheck.uploadTitle")}
                data-testid="button-upload-file"
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              </Button>

              {textToCheck.trim() && (
                <Button variant="outline" onClick={() => copyToClipboard(textToCheck)} title={t("common.copy")}>
                  <Copy className="w-4 h-4" />
                </Button>
              )}
              {hasChanges && (
                <Button variant="outline" onClick={resetToOriginal} title={t("pages.grammarCheck.resetTitle")} data-testid="button-reset">
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
              {textToCheck.trim() && (
                <Button variant="outline" onClick={clearAll} title={t("pages.grammarCheck.clearAll")}>
                  <Eraser className="w-4 h-4" />
                </Button>
              )}
            </div>

            {textToCheck.trim() && (
              <SpeechPlayer
                supported={supported}
                speaking={speaking}
                paused={paused}
                progress={progress}
                voices={voices}
                rate={speechRate}
                voiceName={speechVoice}
                engineMode={engineMode}
                onPlay={handleTTSPlay}
                onPause={pause}
                onStop={stop}
                onRateChange={r => { setSpeechRate(r); saveSpeechPrefs({ rate: r }); }}
                onVoiceChange={v => { setSpeechVoice(v); saveSpeechPrefs({ voiceName: v }); }}
                onEngineModeChange={m => { setEngineMode(m); saveSpeechPrefs({ engineMode: m }); }}
              />
            )}

            <p className="text-xs text-muted-foreground">
              {t("pages.grammarCheck.supportedFormatsHint")}
            </p>
          </CardContent>
        </Card>

        {/* Right: Suggestions panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-lg">{t("pages.grammarCheck.suggestions")}</CardTitle>
                <CardDescription>
                  {grammarSuggestions.length > 0
                    ? t("pages.grammarCheck.foundSuggestions", { count: grammarSuggestions.length })
                    : t("pages.grammarCheck.suggestionsEmpty")}
                </CardDescription>
              </div>
              <div className="flex gap-2 items-center">
                {grammarSuggestions.length > 1 && (
                  <Button size="sm" variant="outline" onClick={applyAllSuggestions} data-testid="button-apply-all">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {t("pages.grammarCheck.applyAll")}
                  </Button>
                )}
                {/* Export dropdown — shown after a successful check */}
                {(grammarCheckMutation.isSuccess || hasChanges) && textToCheck.trim() && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-1" />
                        {t("common.export")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copyToClipboard(textToCheck)}>
                        <Copy className="w-4 h-4 mr-2" />
                        {t("pages.grammarCheck.copyText")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsHTML}>
                        <Globe className="w-4 h-4 mr-2" />
                        {t("common.exportAsHTML")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={exportAsWord}>
                        <FileOutput className="w-4 h-4 mr-2" />
                        {t("common.exportAsWord")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={printText}>
                        <Printer className="w-4 h-4 mr-2" />
                        {t("common.print")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {grammarSuggestions.length === 0 ? (
              hasChanges ? (
                /* All corrections applied state */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{t("pages.grammarCheck.allCorrected")}</span>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium text-green-700 dark:text-green-300">
                        {t("pages.grammarCheck.correctedText")}
                      </Label>
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(textToCheck)}>
                        <Copy className="w-3 h-3 mr-1" />
                        <span className="text-xs">{t("common.copy")}</span>
                      </Button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-green-800 dark:text-green-200">{textToCheck}</p>
                  </div>
                </div>
              ) : (
                /* Empty / initial state */
                <div className="text-center text-muted-foreground py-12 px-4">
                  <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="font-medium">{t("pages.grammarCheck.emptyState")}</p>
                  <p className="text-sm mt-2">{t("pages.grammarCheck.emptyStateHint")}</p>
                  <Separator className="my-6" />
                  <div className="text-xs text-left max-w-md mx-auto space-y-2">
                    <p className="font-medium text-center mb-3">{t("pages.grammarCheck.features")}</p>
                    <ul className="space-y-1">
                      <li>• {t("pages.grammarCheck.feature1")}</li>
                      <li>• {t("pages.grammarCheck.feature2")}</li>
                      <li>• {t("pages.grammarCheck.feature3")}</li>
                      <li>• {t("pages.grammarCheck.feature4")}</li>
                      <li>• {t("pages.grammarCheck.feature5")}</li>
                      <li>• {t("pages.grammarCheck.feature6")}</li>
                    </ul>
                  </div>
                </div>
              )
            ) : (
              /* Suggestions list */
              <div className="space-y-4">
                {grammarSuggestions.map((suggestion, index) => {
                  const borderColor = typeColors[suggestion.type.toLowerCase()] || "border-l-primary";
                  return (
                    <Card
                      key={index}
                      className={`border-l-4 ${borderColor}`}
                      data-testid={`card-suggestion-${index}`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <Badge variant="outline" className="text-xs capitalize">
                          {suggestion.type.replace(/_/g, " ")}
                        </Badge>
                        {suggestion.original && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("pages.grammarCheck.original")} </span>
                            <span className="line-through text-red-500">{suggestion.original}</span>
                          </div>
                        )}
                        {suggestion.suggested && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("pages.grammarCheck.suggested")} </span>
                            <span className="text-green-600 dark:text-green-400">{suggestion.suggested}</span>
                          </div>
                        )}
                        {suggestion.explanation && (
                          <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>
                        )}
                        {suggestion.original && suggestion.suggested && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applySuggestion(suggestion)}
                            data-testid={`button-apply-suggestion-${index}`}
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {t("pages.grammarCheck.apply")}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
