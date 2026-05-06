import { useState, useRef, useEffect } from "react";
import { BookOpen, Sparkles, Upload, Download, Save, X, FileIcon, Settings, UserPlus, Trash2, FileCode, Printer, Cloud, Loader2, Volume2, FileText } from "lucide-react";
import { useGeminiTTS } from "@/hooks/use-gemini-tts";
import { DocumentTTSControls } from "@/components/document-tts-controls";
import { useLocation } from "wouter";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UsageGate } from "@/components/usage-gate";
import { useDocumentGenerator } from "@/hooks/use-document-generator";
import { useRandomTopic } from "@/hooks/use-random-topic";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { saveDocument } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ToneType } from "@shared/schema";

interface Author {
  name: string;
  affiliation: string;
  email: string;
}

export default function GenerateConference() {
  const [topic, setTopic] = useState("");
  const [targetPages, setTargetPages] = useState("auto");
  const [tone, setTone] = useState<ToneType>("academic");
  const [citationStyle, setCitationStyle] = useState("ieee");
  const [generateImages, setGenerateImages] = useState(true);
  const [sectionImageUrls, setSectionImageUrls] = useState<Record<number, string>>({});

  const [useManualAuthors, setUseManualAuthors] = useState(false);
  const [authors, setAuthors] = useState<Author[]>([{ name: "", affiliation: "", email: "" }]);
  
  const [useCustomFormatting, setUseCustomFormatting] = useState(false);
  const [customFormat, setCustomFormat] = useState({
    fontSize: "10",
    lineSpacing: "1.4",
    padding: "1.0",
    textAlign: "justify",
    textColor: "#000000",
    fontFamily: "Times New Roman"
  });
  
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { generate, isGenerating, generatedContent, progress } = useDocumentGenerator("conference");
  const { generateTopic, isLoading: isLoadingTopic } = useRandomTopic();
  const { uploadedFiles, isProcessing, extractedText, handleFileUpload, removeFile } = useFileUpload();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
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

  // Fetch images for figures
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

  const addAuthor = () => {
    setAuthors([...authors, { name: "", affiliation: "", email: "" }]);
  };

  const removeAuthor = (index: number) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index));
    }
  };

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const updated = [...authors];
    updated[index][field] = value;
    setAuthors(updated);
  };

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

      const finalTopic = extractedText ? `${topic}\n\nAdditional Context:\n${extractedText}` : topic;
      generate({
        topic: finalTopic,
        targetPages,
        tone,
        citationStyle,
        generateImages,
        authors: useManualAuthors ? authors : undefined,
        customFormat: useCustomFormatting ? customFormat : undefined,
      });
    } finally {
      // Reset submitting state after a short delay to allow isGenerating to take over
      setTimeout(() => setIsSubmitting(false), 100);
    }
  };

  const sanitizeHtml = (html: string) => {
    let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    return sanitized;
  };

  const getHtmlContent = (): string => {
    if (!generatedContent) return '';
    if (generatedContent.type === 'html' && generatedContent.html) {
      return sanitizeHtml(generatedContent.html);
    }
    if (typeof generatedContent === 'string') {
      return sanitizeHtml(generatedContent);
    }
    return '';
  };

  const handleExportPDF = async () => {
    if (!generatedContent) {
      toast({ title: "No content to export", description: "Please generate a paper first", variant: "destructive" });
      return;
    }
    toast({ title: "Generating PDF…", description: "This may take a few seconds." });
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: generatedContent, imageUrls: sectionImageUrls, type: "conference" }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(generatedContent.title ?? "conference-paper").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded!", description: "Your conference paper has been exported as PDF." });
    } catch {
      toast({ title: "PDF Export Failed", description: "Please try the Print option instead.", variant: "destructive" });
    }
  };

  const handleDownloadHTML = () => {
    const htmlContent = getHtmlContent();
    if (!htmlContent) return;

    const completeHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IEEE Conference Paper</title>
  <style>
    /* Print and display formatting */
    body {
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      font-family: 'Times New Roman', serif;
      font-size: 10pt;
      line-height: 1.5;
    }
    .ieee-paper-preview {
      max-width: 210mm;
      margin: 0 auto;
      background: white;
      padding: 1.8cm 1.5cm;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    /* Two-column layout for IEEE format */
    .ieee-paper-preview > h1:first-child,
    .ieee-paper-preview > h2:first-of-type,
    .ieee-paper-preview > .abstract,
    .ieee-paper-preview > h1,
    .ieee-paper-preview > h2:not(.section-title) {
      column-span: all;
      -webkit-column-span: all;
    }
    .ieee-paper-preview {
      column-count: 2 !important;
      column-gap: 0.5cm !important;
      -webkit-column-count: 2 !important;
      -webkit-column-gap: 0.5cm !important;
      -moz-column-count: 2 !important;
      -moz-column-gap: 0.5cm !important;
    }
    /* Prevent nested elements from creating additional columns */
    .ieee-paper-preview div:not(.ieee-paper-preview),
    .ieee-paper-preview section,
    .ieee-paper-preview article {
      column-count: auto !important;
      -webkit-column-count: auto !important;
      -moz-column-count: auto !important;
    }
    .ieee-paper-preview table {
      width: 100% !important;
      max-width: 100% !important;
      break-inside: avoid !important;
      -webkit-column-break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    h1, h2, h3, h4 {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      page-break-inside: avoid;
    }
    h1 {
      text-align: center;
      font-size: 18pt;
      margin-bottom: 0.5cm;
      column-span: all;
      -webkit-column-span: all;
    }
    h2 {
      font-size: 12pt;
      margin-top: 0.4cm;
      margin-bottom: 0.2cm;
      text-transform: uppercase;
    }
    h3 {
      font-size: 11pt;
      margin-top: 0.3cm;
      margin-bottom: 0.15cm;
      font-style: italic;
    }
    p {
      text-align: justify;
      margin-bottom: 0.3cm;
    }
    .abstract {
      font-style: italic;
      margin-bottom: 0.5cm;
      padding: 0.3cm;
      background: #f9f9f9;
      border-left: 3px solid #333;
      column-span: all;
      -webkit-column-span: all;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .ieee-paper-preview {
        max-width: none;
        box-shadow: none;
        page-break-after: auto;
      }
    }
    @page {
      size: A4;
      margin: 1.8cm 1.5cm;
    }
  </style>
</head>
<body>
  <div class="ieee-paper-preview">
    ${htmlContent}
  </div>
</body>
</html>`;

    const blob = new Blob([completeHTML], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conference_paper.html';
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "HTML file saved successfully",
    });
  };

  const handlePrint = () => {
    const htmlContent = getHtmlContent();
    if (!htmlContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow pop-ups to print",
        variant: "destructive",
      });
      return;
    }

    const printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>IEEE Conference Paper - Print</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Times New Roman', serif;
      font-size: 10pt;
      line-height: 1.5;
    }
    .ieee-paper-preview {
      padding: 1.8cm 1.5cm;
      column-count: 2 !important;
      column-gap: 0.5cm !important;
      -webkit-column-count: 2 !important;
      -webkit-column-gap: 0.5cm !important;
      -moz-column-count: 2 !important;
      -moz-column-gap: 0.5cm !important;
    }
    /* Prevent nested elements from creating additional columns */
    .ieee-paper-preview div:not(.ieee-paper-preview),
    .ieee-paper-preview section,
    .ieee-paper-preview article {
      column-count: auto !important;
      -webkit-column-count: auto !important;
      -moz-column-count: auto !important;
    }
    .ieee-paper-preview table {
      width: 100% !important;
      max-width: 100% !important;
      break-inside: avoid !important;
      -webkit-column-break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    /* Title and abstract span both columns */
    .ieee-paper-preview > h1:first-child,
    .ieee-paper-preview > h2:first-of-type,
    .ieee-paper-preview > .abstract,
    .ieee-paper-preview > h1 {
      column-span: all;
      -webkit-column-span: all;
    }
    h1, h2, h3, h4 {
      break-inside: avoid;
      -webkit-column-break-inside: avoid;
      page-break-inside: avoid;
    }
    h1 {
      text-align: center;
      font-size: 18pt;
      margin-bottom: 0.5cm;
      column-span: all;
      -webkit-column-span: all;
    }
    h2 {
      font-size: 12pt;
      margin-top: 0.4cm;
      margin-bottom: 0.2cm;
      text-transform: uppercase;
    }
    h3 {
      font-size: 11pt;
      margin-top: 0.3cm;
      margin-bottom: 0.15cm;
      font-style: italic;
    }
    p {
      text-align: justify;
      margin-bottom: 0.3cm;
    }
    .abstract {
      font-style: italic;
      margin-bottom: 0.5cm;
      padding: 0.3cm;
      background: #f9f9f9;
      border-left: 3px solid #333;
      column-span: all;
      -webkit-column-span: all;
    }
    @page {
      size: A4;
      margin: 1.8cm 1.5cm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .ieee-paper-preview {
        page-break-after: auto;
      }
    }
  </style>
</head>
<body>
  <div class="ieee-paper-preview">
    ${htmlContent}
  </div>
<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
      window.close();
    }, 500);
  };
</script>
</body>
</html>`;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const handleSave = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save your conference paper",
        variant: "destructive"
      });
      return;
    }

    if (!generatedContent) {
      toast({
        title: "No content to save",
        description: "Please generate a conference paper first",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const settings: any = {
        targetPages,
        tone,
        citationStyle,
        generateImages,
      };
      if (useManualAuthors && authors) {
        settings.authors = authors;
      }
      if (useCustomFormatting && customFormat) {
        settings.customFormat = customFormat;
      }

      // Merge image URLs into sections before saving
      const sectionsWithImages = generatedContent.sections
        ? generatedContent.sections.map((section: any, index: number) => ({
            ...section,
            imageUrl: sectionImageUrls[index] || null
          }))
        : [];

      const contentWithImages = {
        ...generatedContent,
        sections: sectionsWithImages
      };

      // Extract title from generated content first, then fall back to user input
      const documentTitle = generatedContent.title || topic || "Conference Paper";

      // Generate a description from topic or content
      const description = topic ||
        generatedContent.abstract?.substring(0, 200) ||
        generatedContent.sections?.[0]?.content?.substring(0, 200) ||
        documentTitle;

      await saveDocument({
        type: "conference",
        title: documentTitle.substring(0, 100),
        topic: description,
        content: contentWithImages,
        settings,
        language: "en",
      });

      // Invalidate documents query to refresh Document History
      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: "Document saved",
        description: "Your conference paper has been saved successfully to Firebase"
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save document. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const htmlContent = getHtmlContent();
  const hasContent = htmlContent.length > 0;

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, usageStatus, openPricing }) => (
        <GeneratorLayout
          title="Conference Paper Generator"
          description="IEEE-formatted papers with proper citations and academic structure"
          icon={<BookOpen className="w-6 h-6 text-white" />}
          gradient="from-purple-500 to-pink-500"
        >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paper Configuration</CardTitle>
              <CardDescription>Define your conference paper topic and settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text" data-testid="tab-text-input">Text Input</TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-file-upload">File Upload</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="space-y-4">
                  <div>
                    <Label htmlFor="topic">Research Topic/Abstract</Label>
                    <Textarea
                      id="topic"
                      placeholder="Enter your conference paper topic or abstract..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-32 mt-2"
                      data-testid="input-paper-topic"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      {topic?.length || 0} characters
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
                    Surprise Me
                  </Button>
                </TabsContent>
                <TabsContent value="upload" className="space-y-4">
                  <div className="relative border-2 border-dashed rounded-lg p-8 text-center hover-elevate transition-colors">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drop files here or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports PDF, DOCX, TXT, and images
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
                      <Label>Uploaded Files</Label>
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
                  <Label htmlFor="target-length">Target Length</Label>
                  <Select value={targetPages} onValueChange={setTargetPages}>
                    <SelectTrigger id="target-length" className="mt-2" data-testid="select-target-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (AI-determined)</SelectItem>
                      <SelectItem value="1-2 pages">1-2 Pages</SelectItem>
                      <SelectItem value="3-5 pages">3-5 Pages</SelectItem>
                      <SelectItem value="6-10 pages">6-10 Pages</SelectItem>
                      <SelectItem value="10+ pages">10+ Pages</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tone">Tone & Style</Label>
                  <Select value={tone} onValueChange={(val) => setTone(val as ToneType)}>
                    <SelectTrigger id="tone" className="mt-2" data-testid="select-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="academic">Academic</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="essay">Essay</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="citation-style">Reference Style</Label>
                  <Select value={citationStyle} onValueChange={setCitationStyle}>
                    <SelectTrigger id="citation-style" className="mt-2" data-testid="select-citation-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ieee">IEEE (Numeric)</SelectItem>
                      <SelectItem value="harvard">Harvard (Author-Date)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="generate-images">Generate Figures</Label>
                  <Switch
                    id="generate-images"
                    checked={generateImages}
                    onCheckedChange={setGenerateImages}
                    data-testid="switch-generate-images"
                  />
                </div>
              </div>

              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between" data-testid="button-advanced-settings">
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Advanced Settings
                    </span>
                    <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>
                      ▼
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label>Manual Author Details</Label>
                      <Switch
                        checked={useManualAuthors}
                        onCheckedChange={setUseManualAuthors}
                        data-testid="switch-manual-authors"
                      />
                    </div>
                    
                    {useManualAuthors && (
                      <div className="space-y-4">
                        {authors.map((author, index) => (
                          <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/20">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Author {index + 1}</Label>
                              {authors.length > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAuthor(index)}
                                  data-testid={`button-remove-author-${index}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            <Input
                              placeholder="Full Name"
                              value={author.name}
                              onChange={(e) => updateAuthor(index, "name", e.target.value)}
                              data-testid={`input-author-name-${index}`}
                            />
                            <Input
                              placeholder="Affiliation (University/Organization)"
                              value={author.affiliation}
                              onChange={(e) => updateAuthor(index, "affiliation", e.target.value)}
                              data-testid={`input-author-affiliation-${index}`}
                            />
                            <Input
                              type="email"
                              placeholder="Email Address"
                              value={author.email}
                              onChange={(e) => updateAuthor(index, "email", e.target.value)}
                              data-testid={`input-author-email-${index}`}
                            />
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={addAuthor}
                          className="w-full"
                          data-testid="button-add-author"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Add Author
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label>Custom Formatting</Label>
                      <Switch
                        checked={useCustomFormatting}
                        onCheckedChange={setUseCustomFormatting}
                        data-testid="switch-custom-formatting"
                      />
                    </div>
                    
                    {useCustomFormatting && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Font Size</Label>
                          <Select
                            value={customFormat.fontSize}
                            onValueChange={(v) => setCustomFormat({ ...customFormat, fontSize: v })}
                          >
                            <SelectTrigger data-testid="select-font-size">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9">9pt</SelectItem>
                              <SelectItem value="10">10pt</SelectItem>
                              <SelectItem value="11">11pt</SelectItem>
                              <SelectItem value="12">12pt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Line Spacing</Label>
                          <Select
                            value={customFormat.lineSpacing}
                            onValueChange={(v) => setCustomFormat({ ...customFormat, lineSpacing: v })}
                          >
                            <SelectTrigger data-testid="select-line-spacing">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1.0">1.0</SelectItem>
                              <SelectItem value="1.15">1.15</SelectItem>
                              <SelectItem value="1.4">1.4</SelectItem>
                              <SelectItem value="1.5">1.5</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Margins (cm)</Label>
                          <Select
                            value={customFormat.padding}
                            onValueChange={(v) => setCustomFormat({ ...customFormat, padding: v })}
                          >
                            <SelectTrigger data-testid="select-margins">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.5">0.5cm</SelectItem>
                              <SelectItem value="1.0">1.0cm</SelectItem>
                              <SelectItem value="1.5">1.5cm</SelectItem>
                              <SelectItem value="2.0">2.0cm</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Text Align</Label>
                          <Select
                            value={customFormat.textAlign}
                            onValueChange={(v) => setCustomFormat({ ...customFormat, textAlign: v })}
                          >
                            <SelectTrigger data-testid="select-text-align">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="justify">Justify</SelectItem>
                              <SelectItem value="left">Left</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Font Family</Label>
                          <Select
                            value={customFormat.fontFamily}
                            onValueChange={(v) => setCustomFormat({ ...customFormat, fontFamily: v })}
                          >
                            <SelectTrigger data-testid="select-font-family">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Calibri">Calibri</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Text Color</Label>
                          <Input
                            type="color"
                            value={customFormat.textColor}
                            onChange={(e) => setCustomFormat({ ...customFormat, textColor: e.target.value })}
                            className="h-9 w-full cursor-pointer"
                            data-testid="input-text-color"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

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
                      View Pricing
                    </button>
                  </div>
                )}
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!topic?.trim() || isGenerating || isProcessing || isSubmitting}
                  onClick={() => handleGenerate(checkUsage)}
                  data-testid="button-generate-conference"
                >
                  {isGenerating || isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Conference Paper
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle>Paper Preview</CardTitle>
                  <CardDescription>IEEE-formatted conference paper preview</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* TTS Controls */}
                  {hasContent && (
                    <DocumentTTSControls
                      status={tts.status}
                      progress={tts.progress}
                      onPlay={() => tts.play({ html: htmlContent })}
                      onPause={tts.pause}
                      onResume={tts.resume}
                      onStop={tts.stop}
                      onRestart={tts.restart}
                      disabled={!hasContent}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasContent || isSaving}
                    data-testid="button-cloud-save"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4 mr-2" />
                    )}
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!hasContent} data-testid="button-export-menu">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleExportPDF} data-testid="export-pdf">
                        <FileText className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleDownloadHTML} data-testid="export-html">
                        <FileCode className="w-4 h-4 mr-2" />
                        Export as HTML (IEEE)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handlePrint} data-testid="export-print">
                        <Printer className="w-4 h-4 mr-2" />
                        Print
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
                    {progress < 50 ? "Generating IEEE-formatted conference paper..." : 
                     progress < 90 ? "Processing figures and formatting..." : 
                     "Finalizing document..."}
                  </div>
                </div>
              )}
              
              <div
                ref={previewRef}
                className="border rounded-lg bg-background min-h-[600px] overflow-auto shadow-inner"
                style={{ maxHeight: '800px' }}
              >
                {hasContent ? (
                  <div
                    className="ieee-paper-preview"
                    dangerouslySetInnerHTML={{ __html: htmlContent }}
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-16 px-4">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p className="font-medium">Your IEEE conference paper will appear here</p>
                    <p className="text-sm mt-2">Configure settings and click "Generate Conference Paper" to start</p>
                    <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                      <p className="font-medium text-center mb-3">IEEE Paper Features:</p>
                      <ul className="space-y-1">
                        <li>• Two-column layout with proper spacing</li>
                        <li>• Roman numeral section headings (I., II., III.)</li>
                        <li>• Abstract with keywords section</li>
                        <li>• Auto-generated figures with captions</li>
                        <li>• IEEE-style numbered references [1], [2]</li>
                        <li>• Print-ready A4 format</li>
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
