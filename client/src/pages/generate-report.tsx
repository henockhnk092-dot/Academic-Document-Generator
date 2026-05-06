import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Sparkles, Upload, Settings, Download, Save, X, FileIcon, FileDown, FileCode, Cloud, Printer, Volume2, Clipboard, RefreshCw } from "lucide-react";
import { useGeminiTTS } from "@/hooks/use-gemini-tts";
import { DocumentTTSControls } from "@/components/document-tts-controls";
import { useLocation } from "wouter";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useDocumentGenerator } from "@/hooks/use-document-generator";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useRandomTopic } from "@/hooks/use-random-topic";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { UsageGate } from "@/components/usage-gate";
import { parseMarkdownToHtml, sanitizeHtml } from "@/lib/markdown-parser";
import { saveDocument } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportHtmlToDocx } from "@/lib/docx-export";
import type { ToneType } from "@shared/schema";

export default function GenerateReport() {
  const { t } = useTranslation();
  const [topic, setTopic] = useState("");
  const [targetLength, setTargetLength] = useState("auto");
  const [tone, setTone] = useState<ToneType>("academic");
  const [citationStyle, setCitationStyle] = useState("auto");
  const [generateImages, setGenerateImages] = useState(true);
  const [sectionImageUrls, setSectionImageUrls] = usePersistedState<Record<number, string>>("report_section_images", {});
  
  const { generate, isGenerating, generatedContent, progress, updateSection } = useDocumentGenerator("report");
  const { generateTopic, isLoading: isLoadingTopic } = useRandomTopic();
  const { uploadedFiles, isProcessing, extractedText, handleFileUpload, removeFile } = useFileUpload();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regeneratingSections, setRegeneratingSections] = useState<Set<number>>(new Set());
  const [location] = useLocation();

  // TTS hook for reading document aloud (high-quality Gemini TTS)
  const tts = useGeminiTTS({ tone });

  // Load template data from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templatePrompt = params.get('template');
    const templateName = params.get('name');

    if (templatePrompt) {
      setTopic(templatePrompt);
      if (templateName) {
        toast({
          title: "Template loaded",
          description: `Using template: ${templateName}`,
        });
      }
    }
  }, [location]);

  // Fetch images client-side when report is generated (like PowerPoint does)
  useEffect(() => {
    if (generatedContent?.sections && generateImages) {
      generatedContent.sections.forEach(async (section: any, index: number) => {
        if (section.image_prompt && !sectionImageUrls[index]) {
          try {
            const response: any = await apiRequest("POST", "/api/images/random", {
              query: section.image_prompt
            });
            if (response.image) {
              const url = response.image.webformatURL || response.image.largeImageURL;
              setSectionImageUrls(prev => ({ ...prev, [index]: url }));
            }
          } catch (error) {
            console.error(`Failed to fetch image for section ${index}:`, error);
          }
        }
      });
    }
  }, [generatedContent, generateImages]);

  const handleGenerate = async (checkUsage: () => Promise<boolean>) => {
    // Prevent double-clicks by setting submitting state immediately
    if (isSubmitting || isGenerating) return;
    setIsSubmitting(true);

    try {
      const allowed = await checkUsage();
      if (!allowed) {
        setIsSubmitting(false);
        return;
      }

      // Reset image URLs when generating new report
      setSectionImageUrls({});

      const finalTopic = extractedText ? `${topic}\n\nAdditional Context:\n${extractedText}` : topic;
      generate({
        topic: finalTopic,
        targetLength,
        tone,
        citationStyle,
        generateImages,
      });
    } finally {
      // Reset submitting state after a short delay to allow isGenerating to take over
      setTimeout(() => setIsSubmitting(false), 100);
    }
  };

  const handleRegenerateSection = async (index: number, sectionHeading: string) => {
    if (regeneratingSections.has(index)) return;
    setRegeneratingSections(prev => new Set(prev).add(index));
    try {
      const response = await fetch("/api/generate/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, sectionHeading, tone }),
      });
      if (!response.ok) throw new Error("Failed to regenerate");
      const data = await response.json();
      updateSection(index, data.content);
      toast({ title: t("pages.report.sectionRegenerated"), description: `"${sectionHeading}" ${t("pages.report.sectionRewritten")}` });
    } catch {
      toast({ title: t("pages.report.regenerationFailed"), description: t("pages.report.failedRegenerate"), variant: "destructive" });
    } finally {
      setRegeneratingSections(prev => { const s = new Set(prev); s.delete(index); return s; });
    }
  };

  const handleExportHTML = () => {
    if (!generatedContent) {
      toast({
        title: "No content to export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    // Build HTML content
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generatedContent.title || 'Technical Report'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #1e3a8a; border-bottom: 2px solid #93c5fd; padding-bottom: 5px; margin-top: 30px; text-transform: uppercase; }
    .abstract { background: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    img { max-width: 80%; height: auto; display: block; margin: 20px auto; border: 1px solid #ddd; padding: 5px; }
    figcaption { text-align: center; font-weight: bold; margin-top: 10px; font-size: 14px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${generatedContent.title || 'Technical Report'}</h1>`;

    if (generatedContent.abstract) {
      html += `
  <div class="abstract">
    <h2>Abstract</h2>
    <p>${generatedContent.abstract}</p>
  </div>`;
    }

    generatedContent.sections?.forEach((section: any, index: number) => {
      const sectionHeading = section.heading || section.title;
      html += `
  <div>
    <h2>${sectionHeading}</h2>
    ${sanitizeHtml(parseMarkdownToHtml(section.content || ""))}`;

      if (sectionImageUrls[index]) {
        html += `
    <figure>
      <img src="${sectionImageUrls[index]}" alt="${section.image_caption || `Figure ${index + 1}`}" />
      ${section.image_caption ? `<figcaption>${section.image_caption}</figcaption>` : ''}
    </figure>`;
      }

      html += `
  </div>`;
    });

    html += `
</body>
</html>`;

    // Download HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedContent.title?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_') || 'report'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Report exported as HTML",
    });
  };

  const handleExportDOCX = async () => {
    if (!generatedContent) {
      toast({
        title: "No content to export",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Show loading toast
      toast({
        title: "Preparing Export",
        description: "Converting images for DOCX format...",
      });

      // Build HTML content for DOCX conversion with images as base64
      let html = `<h1>${generatedContent.title || 'Technical Report'}</h1>`;

      if (generatedContent.abstract) {
        html += `<h2>Abstract</h2><p>${generatedContent.abstract}</p>`;
      }

      // Process sections with images
      for (let i = 0; i < (generatedContent.sections?.length || 0); i++) {
        const section = generatedContent.sections[i];
        const sectionHeading = section.heading || section.title;
        html += `<h2>${sectionHeading}</h2>`;
        html += sanitizeHtml(parseMarkdownToHtml(section.content || ""));

        // Add image if available
        if (sectionImageUrls[i]) {
          try {
            // Fetch image and convert to base64
            const response = await fetch(sectionImageUrls[i]);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });

            html += `<figure>
              <img src="${base64}" alt="${section.image_caption || `Figure ${i + 1}`}" style="max-width: 600px;" />
              ${section.image_caption ? `<figcaption>${section.image_caption}</figcaption>` : ''}
            </figure>`;
          } catch (imgError) {
            console.error('Failed to fetch image for DOCX:', imgError);
            // Just add caption without image
            if (section.image_caption) {
              html += `<p><em>${section.image_caption}</em></p>`;
            }
          }
        } else if (section.image_caption) {
          html += `<p><em>${section.image_caption}</em></p>`;
        }
      }

      // Add references if available
      if (generatedContent.references && generatedContent.references.length > 0) {
        html += `<h2>References</h2>`;
        generatedContent.references.forEach((ref: string) => {
          html += `<p>${ref}</p>`;
        });
      }

      await exportHtmlToDocx(html, {
        title: generatedContent.title || 'Technical Report',
        twoColumn: false,
      });

      toast({
        title: "Export Successful",
        description: "DOCX file has been downloaded",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export to DOCX format",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (!generatedContent) {
      toast({
        title: "No content to print",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    // Build HTML content for printing
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generatedContent.title || 'Technical Report'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #1a1a1a; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
    h2 { color: #1e3a8a; border-bottom: 2px solid #93c5fd; padding-bottom: 5px; margin-top: 30px; text-transform: uppercase; }
    .abstract { background: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    img { max-width: 80%; height: auto; display: block; margin: 20px auto; border: 1px solid #ddd; padding: 5px; }
    figcaption { text-align: center; font-weight: bold; margin-top: 10px; font-size: 14px; }
    code { background-color: #f3f4f6; color: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
    pre { background-color: #f3f4f6; color: #1a1a1a; padding: 15px; border-radius: 5px; overflow-x: auto; margin: 20px 0; }
    pre code { background-color: transparent; padding: 0; }
    @media print {
      body { margin: 0; }
      @page { margin: 1in; }
    }
  </style>
</head>
<body>
  <h1>${generatedContent.title || 'Technical Report'}</h1>`;

    if (generatedContent.abstract) {
      html += `
  <div class="abstract">
    <h2>Abstract</h2>
    <p>${generatedContent.abstract}</p>
  </div>`;
    }

    generatedContent.sections?.forEach((section: any, index: number) => {
      const sectionHeading = section.heading || section.title;
      html += `
  <div>
    <h2>${sectionHeading}</h2>
    ${sanitizeHtml(parseMarkdownToHtml(section.content || ""))}`;

      if (sectionImageUrls[index]) {
        html += `
    <figure>
      <img src="${sectionImageUrls[index]}" alt="${section.image_caption || `Figure ${index + 1}`}" />
      ${section.image_caption ? `<figcaption>${section.image_caption}</figcaption>` : ''}
    </figure>`;
      }

      html += `
  </div>`;
    });

    // Add references if available
    if (generatedContent.references && generatedContent.references.length > 0) {
      html += `
  <div>
    <h2>References</h2>`;
      generatedContent.references.forEach((ref: string) => {
        html += `
    <p>${ref}</p>`;
      });
      html += `
  </div>`;
    }

    html += `
</body>
</html>`;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };

      toast({
        title: "Print Ready",
        description: "Print dialog opened",
      });
    } else {
      toast({
        title: "Print Failed",
        description: "Please allow popups to print",
        variant: "destructive",
      });
    }
  };

  const wordCount = useMemo(() => {
    if (!generatedContent?.sections) return 0;
    return generatedContent.sections.reduce((acc: number, s: any) => {
      return acc + (s.content?.split(/\s+/).filter(Boolean).length ?? 0);
    }, 0);
  }, [generatedContent]);

  const handleCopy = () => {
    if (!generatedContent?.sections) return;
    const text = [
      generatedContent.title ?? "",
      generatedContent.abstract ? `Abstract\n${generatedContent.abstract}` : "",
      ...generatedContent.sections.map((s: any) => `${s.heading ?? s.title}\n\n${s.content ?? ""}`),
    ].filter(Boolean).join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied!", description: "Report text copied to clipboard." });
    });
  };

  const handleExportPDF = async () => {
    if (!generatedContent) {
      toast({ title: "No content to export", description: "Please generate a report first", variant: "destructive" });
      return;
    }
    toast({ title: "Generating PDF…", description: "This may take a few seconds." });
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: generatedContent, imageUrls: sectionImageUrls, type: "report" }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(generatedContent.title ?? "report").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded!", description: "Your report has been exported as PDF." });
    } catch {
      toast({ title: "PDF Export Failed", description: "Please try the Print option instead.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!generatedContent) {
      toast({
        title: "No content to save",
        description: "Please generate a report first",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save documents",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Merge image URLs into sections before saving
      const contentWithImages = {
        ...generatedContent,
        sections: generatedContent.sections?.map((section: any, index: number) => ({
          ...section,
          imageUrl: sectionImageUrls[index] || null
        }))
      };

      // Extract title from generated content first, then fall back to user input
      const documentTitle = generatedContent.title || topic || "Technical Report";

      // Generate a description from topic or content summary
      const description = topic ||
        generatedContent.executive_summary?.substring(0, 200) ||
        generatedContent.abstract?.substring(0, 200) ||
        generatedContent.sections?.[0]?.content?.substring(0, 200) ||
        documentTitle;

      await saveDocument({
        type: "report",
        title: documentTitle.substring(0, 100),
        topic: description,
        content: contentWithImages,
        settings: {
          targetLength,
          tone,
          citationStyle,
          generateImages,
        },
        language: "en",
      });

      // Invalidate documents query to refresh Document History
      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: t("common.save"),
        description: "Your report has been saved successfully",
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, usageStatus, openPricing }) => (
        <GeneratorLayout
          title={t("pages.report.title")}
          description={t("pages.report.subtitle")}
          icon={<FileText className="w-6 h-6 text-white" />}
          gradient="from-blue-500 to-cyan-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card>
            <CardHeader>
              <CardTitle>Input Configuration</CardTitle>
              <CardDescription>Define your report topic and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" data-testid="tab-text-input">{t("common.textInput")}</TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-file-upload">{t("common.fileUpload")}</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-4">
                  <div>
                    <Label htmlFor="topic">{t("pages.report.topicLabel")}</Label>
                    <Textarea
                      id="topic"
                      placeholder={t("pages.report.topicPlaceholder")}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-32 mt-2"
                      data-testid="input-report-topic"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      {topic?.length || 0} {t("common.characters")}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      const randomResult = await generateTopic();
                      setTopic(randomResult.topic);
                      toast({
                        title: randomResult.category,
                        description: `Topic: ${randomResult.topic}`,
                      });
                    }}
                    disabled={isLoadingTopic}
                    data-testid="button-surprise-me"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("common.surpriseMe")}
                  </Button>
                </TabsContent>
                <TabsContent value="upload" className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("common.dropFiles")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("common.supportedFormats")}
                    </p>
                    <input
                      type="file"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      multiple
                      accept=".pdf,.docx,.txt,image/*"
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      data-testid="input-file-upload"
                    />
                  </div>
                  
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t("common.uploadedFiles")}</Label>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm truncate">{file.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="target-length">{t("common.targetLength")}</Label>
                  <Select value={targetLength} onValueChange={setTargetLength}>
                    <SelectTrigger id="target-length" className="mt-2" data-testid="select-target-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t("common.autoAIDetermined")}</SelectItem>
                      <SelectItem value="2-5">2-5 Pages</SelectItem>
                      <SelectItem value="6-10">6-10 Pages</SelectItem>
                      <SelectItem value="11-20">11-20 Pages</SelectItem>
                      <SelectItem value="20+">20+ Pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tone">{t("common.writingTone")}</Label>
                  <Select value={tone} onValueChange={(val) => setTone(val as ToneType)}>
                    <SelectTrigger id="tone" className="mt-2" data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">{t("common.toneAcademic")}</SelectItem>
                      <SelectItem value="professional">{t("common.toneProfessional")}</SelectItem>
                      <SelectItem value="essay">{t("common.toneEssay")}</SelectItem>
                      <SelectItem value="creative">{t("common.toneCreative")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="generate-images">{t("common.generateImages")}</Label>
                  <Switch
                    id="generate-images"
                    checked={generateImages}
                    onCheckedChange={setGenerateImages}
                    data-testid="switch-generate-images"
                  />
                </div>
              </div>

              <div className="space-y-2">
                {remainingAttempts !== Infinity && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span>{remainingAttempts} generation{remainingAttempts !== 1 ? 's' : ''} remaining</span>
                    <button
                      type="button"
                      onClick={openPricing}
                      className="text-primary hover:underline font-medium"
                      data-testid="button-view-pricing"
                    >
                      {t("common.viewPricing")}
                    </button>
                  </div>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!topic?.trim() || isGenerating || isProcessing || isSubmitting}
                  onClick={() => handleGenerate(checkUsage)}
                  data-testid="button-generate-report"
                >
                  {isGenerating || isSubmitting ? (
                    <>{t("common.generating")}</>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {t("pages.report.generateButton")}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {t("common.advancedSettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t("common.citationStyle")}</Label>
                <Select value={citationStyle} onValueChange={setCitationStyle}>
                  <SelectTrigger className="mt-2" data-testid="select-citation-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">{t("common.auto")}</SelectItem>
                    <SelectItem value="ieee">IEEE</SelectItem>
                    <SelectItem value="harvard">Harvard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t("common.documentPreview")}</CardTitle>
                  <CardDescription>{t("pages.report.previewSubtitle")}</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* TTS Controls */}
                  {generatedContent && (
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
                  )}
                  {generatedContent && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      ~{wordCount.toLocaleString()} {t("common.words")}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!generatedContent}
                    title="Copy text to clipboard"
                  >
                    <Clipboard className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={!generatedContent || isSaving}
                    data-testid="button-cloud-save"
                  >
                    <Cloud className="w-4 h-4 mr-2" />
                    {isSaving ? t("common.saving") : t("common.save")}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-export-menu">
                        <Download className="w-4 h-4 mr-2" />
                        {t("common.export")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem data-testid="export-pdf" onClick={handleExportPDF}>
                        <FileText className="w-4 h-4 mr-2" />
                        {t("common.exportAsPDF")}
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="export-html" onClick={handleExportHTML}>
                        <FileCode className="w-4 h-4 mr-2" />
                        {t("common.exportAsHTML")}
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="export-docx" onClick={handleExportDOCX}>
                        <FileDown className="w-4 h-4 mr-2" />
                        {t("common.exportAsWord")}
                      </DropdownMenuItem>
                      <DropdownMenuItem data-testid="export-print" onClick={handlePrint}>
                        <Printer className="w-4 h-4 mr-2" />
                        {t("common.print")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isGenerating && (
                <div className="space-y-4 mb-6">
                  <Progress value={progress} className="w-full" />
                  <div className="text-sm text-muted-foreground text-center">
                    Generating content with AI...
                  </div>
                </div>
              )}
              
              <div className="border rounded-lg bg-white dark:bg-card min-h-[600px] p-8 overflow-auto shadow-inner">
                {generatedContent ? (
                  <div className="max-w-none text-foreground">
                    <h1 className="text-2xl font-bold text-center mb-6 pb-4 border-b">{generatedContent.title}</h1>
                    {generatedContent.abstract && (
                      <div className="mb-8 p-4 bg-muted/30 rounded-lg">
                        <h2 className="text-xl font-bold mb-3">Abstract</h2>
                        <div
                          className="leading-relaxed italic"
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(parseMarkdownToHtml(generatedContent.abstract))
                          }}
                        />
                      </div>
                    )}
                    {generatedContent.sections?.map((section: any, index: number) => {
                      const sectionHeading = section.heading || section.title;
                      const isReferencesSection = sectionHeading?.toLowerCase().includes('reference');
                      const isAppendix = sectionHeading?.toLowerCase().startsWith('appendix');

                      return (
                        <div key={index} className="mb-12 break-inside-avoid">
                          <div className="flex items-start justify-between gap-2 mb-6">
                            <h2 className={`text-2xl font-bold border-b-2 pb-2 uppercase tracking-wide flex-1 ${
                              isAppendix ? 'text-gray-700 border-gray-200' : 'text-blue-900 border-blue-100'
                            }`}>
                              {sectionHeading}
                            </h2>
                            {!isReferencesSection && (
                              <button
                                onClick={() => handleRegenerateSection(index, sectionHeading)}
                                disabled={regeneratingSections.has(index)}
                                title="Regenerate this section"
                                className="mt-1 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 shrink-0 print:hidden"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${regeneratingSections.has(index) ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                          </div>
                          <div
                            className="document-content leading-relaxed text-justify"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(parseMarkdownToHtml(section.content || ""))
                            }}
                          />
                          {sectionImageUrls[index] && (
                            <div className="my-8 flex flex-col items-center break-inside-avoid">
                              <div className="bg-white p-2 border border-gray-300 shadow-sm max-w-[80%]">
                                <img
                                  src={sectionImageUrls[index]}
                                  alt={section.image_caption || `Figure ${index + 1}`}
                                  className="w-full h-auto"
                                  style={{ maxHeight: '400px', objectFit: 'contain' }}
                                  onError={(e) => {
                                    console.error('Image failed to load:', sectionImageUrls[index]);
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                              {section.image_caption && (
                                <figcaption className="mt-3 text-sm text-gray-700 font-semibold text-center max-w-[80%]">
                                  {section.image_caption}
                                </figcaption>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {generatedContent.references && generatedContent.references.length > 0 &&
                     !generatedContent.sections?.some((s: any) =>
                       (s.heading || s.title || '').toLowerCase().includes('reference')
                     ) && (
                      <div className="mt-10 pt-6 border-t">
                        <h2 className="text-xl font-bold mb-4">References</h2>
                        <ol className="list-decimal pl-6 space-y-2">
                          {generatedContent.references.map((ref: string, idx: number) => (
                            <li key={idx} className="text-sm leading-relaxed">{ref}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-16 px-4">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">{t("pages.report.emptyState")}</p>
                    <p className="text-sm mt-2">{t("pages.report.emptyStateHint")}</p>
                    <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                      <p className="font-medium text-center mb-3">{t("pages.report.features")}</p>
                      <ul className="space-y-1">
                        <li>• {t("pages.report.feature1")}</li>
                        <li>• {t("pages.report.feature2")}</li>
                        <li>• {t("pages.report.feature3")}</li>
                        <li>• {t("pages.report.feature4")}</li>
                        <li>• {t("pages.report.feature5")}</li>
                        <li>• {t("pages.report.feature6")}</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
          </div>
        </GeneratorLayout>
      )}
    </UsageGate>
  );
}
