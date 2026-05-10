import { useState, useRef, useEffect } from "react";
import { FileText, Sparkles, Upload, Download, X, FileIcon, Settings, Save, Trash2, FileCode, Printer, Cloud, FileDown, Loader2, Plus, Minus, Image, Table, BookOpen, FileSignature, Volume2 } from "lucide-react";
import { useGeminiTTS } from "@/hooks/use-gemini-tts";
import { DocumentTTSControls } from "@/components/document-tts-controls";
import { useLocation } from "wouter";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useDocumentGenerator } from "@/hooks/use-document-generator";
import { useRandomTopic } from "@/hooks/use-random-topic";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { UsageGate } from "@/components/usage-gate";
import { parseMarkdownToHtml, sanitizeHtml } from "@/lib/markdown-parser";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportHtmlToDocx } from "@/lib/docx-export";
import { saveDocument } from "@/lib/firebase";
import type { ToneType } from "@shared/schema";

const REFERENCE_TYPES = [
  "Journal Articles",
  "Conference Papers",
  "Books",
  "Technical Reports",
  "Websites",
  "Standards Documents",
  "Patents",
  "Theses/Dissertations"
];

const CITATION_STYLES = [
  { value: "ieee", label: "IEEE" },
  { value: "apa", label: "APA" },
  { value: "harvard", label: "Harvard" },
  { value: "chicago", label: "Chicago" },
  { value: "mla", label: "MLA" },
];

const INSTRUCTION_SUGGESTIONS = [
  "Include detailed methodology section with step-by-step procedures",
  "Add case studies and real-world examples to support theoretical concepts",
  "Incorporate statistical analysis and data visualization for findings",
  "Include comparison with existing solutions or approaches in the literature",
  "Add a limitations section discussing potential weaknesses and future improvements",
  "Include code snippets or pseudocode for technical implementations",
  "Add timeline and project management considerations",
  "Include cost-benefit analysis and resource requirements",
  "Add ethical considerations and potential societal impacts",
  "Include performance metrics and evaluation criteria",
  "Add troubleshooting guide and common pitfalls to avoid",
  "Include validation methods and testing strategies",
  "Add discussion on scalability and future extensions",
  "Include stakeholder analysis and requirements gathering",
  "Add risk assessment and mitigation strategies",
];

export default function GenerateCustomReport() {
  const [topic, setTopic] = useState("");
  const [targetPages, setTargetPages] = useState(10);
  const [numChapters, setNumChapters] = useState(5);
  const [numTables, setNumTables] = useState(3);
  const [numFigures, setNumFigures] = useState(5);
  const [citationStyle, setCitationStyle] = useState("ieee");
  const [selectedReferenceTypes, setSelectedReferenceTypes] = useState<string[]>(["Journal Articles", "Conference Papers"]);
  const [minReferences, setMinReferences] = useState(10);
  const [customInstructions, setCustomInstructions] = useState("");
  const [tone, setTone] = useState<ToneType>("academic");
  const [includeAbstract, setIncludeAbstract] = useState(true);
  const [includeToc, setIncludeToc] = useState(true);
  const [includeAppendices, setIncludeAppendices] = useState(true);
  const [sectionImageUrls, setSectionImageUrls] = useState<Record<number, string>>({});

  const { generate, isGenerating, generatedContent, progress } = useDocumentGenerator("report");
  const { generateTopic, isLoading: isLoadingTopic } = useRandomTopic();
  const { uploadedFiles, isProcessing, extractedText, handleFileUpload, removeFile } = useFileUpload();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location] = useLocation();
  const previewRef = useRef<HTMLDivElement>(null);

  // TTS hook for reading document aloud (high-quality Gemini TTS)
  const tts = useGeminiTTS({ tone });

  const toggleReferenceType = (type: string) => {
    setSelectedReferenceTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSuggestTopic = async () => {
    const result = await generateTopic();
    if (result?.topic) {
      setTopic(result.topic);
      toast({
        title: "Topic Suggested",
        description: `Generated topic from ${result.category}`,
      });
    }
  };

  const handleSuggestInstructions = () => {
    const randomIndex = Math.floor(Math.random() * INSTRUCTION_SUGGESTIONS.length);
    const suggestion = INSTRUCTION_SUGGESTIONS[randomIndex];
    setCustomInstructions(prev =>
      prev ? `${prev}\n\n${suggestion}` : suggestion
    );
    toast({
      title: "Instruction Suggested",
      description: "A helpful instruction has been added",
    });
  };

  // Academic writing guidelines
  const ACADEMIC_GUIDELINES = `
**Important Academic Guidelines:**

1. **Figures and Tables Introduction:**
   - Always introduce figures and tables with comprehensive information BEFORE presenting them
   - Never use "the table below" or "the figure above"
   - Use direct references: "Table 1 illustrates..." or "As shown in Figure 4..."
   - Figures: Number + descriptive title placed UNDERNEATH (e.g., Figure 5: Voltage Regulator Output Waveform)
   - Tables: Number + name placed ABOVE (e.g., Table 2: Component Cost Breakdown)

2. **Appendices:**
   - Use for supplementary materials (datasheets, code, schematics)
   - Clearly title each appendix (e.g., Appendix A: PCB Schematic)
   - Reference appendices in main text

3. **References:**
   - Every source in reference list must be cited in main text
   - Every in-text citation must be in reference list
   - All references must be real and verifiable
   - Use proper ${citationStyle.toUpperCase()} citation format
  `;

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

      // Build comprehensive prompt
      let finalPrompt = `${topic}\n\n`;

      finalPrompt += `**Document Specifications:**\n`;
      finalPrompt += `- Target Length: ${targetPages} pages\n`;
      finalPrompt += `- Number of Chapters/Sections: ${numChapters}\n`;
      finalPrompt += `- Number of Tables: ${numTables}\n`;
      finalPrompt += `- Number of Figures: ${numFigures}\n`;
      finalPrompt += `- Citation Style: ${citationStyle.toUpperCase()}\n`;
      finalPrompt += `- Minimum References: ${minReferences}\n`;
      finalPrompt += `- Reference Types: ${selectedReferenceTypes.join(', ')}\n`;
      finalPrompt += `- Include Abstract: ${includeAbstract ? 'Yes' : 'No'}\n`;
      finalPrompt += `- Include Table of Contents: ${includeToc ? 'Yes' : 'No'}\n`;
      finalPrompt += `- Include Appendices: ${includeAppendices ? 'Yes' : 'No'}\n\n`;

      finalPrompt += ACADEMIC_GUIDELINES;

      if (customInstructions) {
        finalPrompt += `\n\n**Additional Instructions:**\n${customInstructions}\n`;
      }

      if (extractedText) {
        finalPrompt += `\n\n**Uploaded Content Context:**\n${extractedText}`;
      }

      generate({
        topic: finalPrompt,
        targetLength: `${targetPages} pages`,
        tone,
        generateImages: numFigures > 0,
      });
    } finally {
      // Reset submitting state after a short delay to allow isGenerating to take over
      setTimeout(() => setIsSubmitting(false), 100);
    }
  };

  // Fetch images for figures
  useEffect(() => {
    if (generatedContent?.sections && numFigures > 0) {
      generatedContent.sections.forEach(async (section: any, index: number) => {
        if (section.image_prompt && !sectionImageUrls[index] && index < numFigures) {
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
  }, [generatedContent, numFigures]);

  const handleSave = async () => {
    if (!generatedContent || !isAuthenticated) {
      toast({
        title: "Cannot save",
        description: isAuthenticated ? "No content to save" : "Please sign in to save documents",
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
      const documentTitle = generatedContent.title || topic || "Custom Report";

      // Generate description from topic or content
      const description = topic ||
        generatedContent.abstract?.substring(0, 200) ||
        generatedContent.sections?.[0]?.content?.substring(0, 200) ||
        generatedContent.title ||
        "Custom Report";

      await saveDocument({
        type: "report",
        title: documentTitle.substring(0, 100),
        topic: description,
        content: contentWithImages,
        settings: {
          targetPages,
          numChapters,
          numTables,
          numFigures,
          citationStyle,
          selectedReferenceTypes,
          minReferences,
          customInstructions,
          tone,
          includeAbstract,
          includeToc,
          includeAppendices,
        },
        language: "en",
      });

      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: "Document Saved",
        description: "Your custom report has been saved successfully",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save document",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${generatedContent.title || 'Custom Report'}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; color: #1a1a1a; background: #ffffff; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #1e3a8a; border-bottom: 2px solid #93c5fd; padding-bottom: 5px; margin-top: 30px; }
    .abstract { background: #f3f4f6; padding: 20px; border-radius: 5px; margin: 20px 0; font-style: italic; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f3f4f6; font-weight: bold; }
    img { max-width: 80%; height: auto; display: block; margin: 20px auto; border: 1px solid #ddd; padding: 5px; }
    figcaption { text-align: center; font-weight: bold; margin-top: 10px; font-size: 14px; }
    .table-caption { text-align: center; font-weight: bold; margin-bottom: 10px; font-size: 14px; }
    .references { margin-top: 40px; }
    .reference-item { margin-bottom: 10px; padding-left: 20px; text-indent: -20px; }
    code { background-color: #f3f4f6; color: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 0.9em; }
    pre { background-color: #f3f4f6; color: #1a1a1a; padding: 15px; border-radius: 5px; overflow-x: auto; margin: 20px 0; }
    pre code { background-color: transparent; padding: 0; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${generatedContent.title || 'Custom Report'}</h1>`;

    if (includeAbstract && generatedContent.abstract) {
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

    if (generatedContent.references && generatedContent.references.length > 0) {
      html += `
  <div class="references">
    <h2>References</h2>`;
      generatedContent.references.forEach((ref: string) => {
        html += `
    <div class="reference-item">${ref}</div>`;
      });
      html += `
  </div>`;
    }

    html += `
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedContent.title || 'custom-report'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "HTML file has been downloaded",
    });
  };

  const handleExportDocx = async () => {
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

      // Helper function to convert image URL to base64
      const convertImageToBase64 = async (url: string): Promise<string> => {
        try {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Failed to convert image:', error);
          return url; // Return original URL if conversion fails
        }
      };

      // Build HTML content from structured data
      let htmlContent = `<h1>${generatedContent.title || 'Custom Report'}</h1>`;

      // Add abstract if included
      if (includeAbstract && generatedContent.abstract) {
        htmlContent += `
          <div class="abstract">
            <h2>Abstract</h2>
            <p>${generatedContent.abstract}</p>
          </div>`;
      }

      // Add sections with images converted to base64
      if (generatedContent.sections) {
        for (let index = 0; index < generatedContent.sections.length; index++) {
          const section = generatedContent.sections[index];
          const sectionHeading = section.heading || section.title;
          htmlContent += `<h2>${sectionHeading}</h2>`;
          htmlContent += sanitizeHtml(parseMarkdownToHtml(section.content || ""));

          // Add figure if available - convert to base64 for DOCX embedding
          if (sectionImageUrls[index]) {
            const imageUrl = sectionImageUrls[index];
            const base64Image = imageUrl.startsWith('http')
              ? await convertImageToBase64(imageUrl)
              : imageUrl;

            htmlContent += `
              <figure>
                <img src="${base64Image}" alt="${section.image_caption || `Figure ${index + 1}`}" />
                ${section.image_caption ? `<figcaption>${section.image_caption}</figcaption>` : ''}
              </figure>`;
          }
        }
      }

      // Add references
      if (generatedContent.references && generatedContent.references.length > 0) {
        htmlContent += `<h2>References</h2>`;
        generatedContent.references.forEach((ref: string) => {
          htmlContent += `<p>${ref}</p>`;
        });
      }

      await exportHtmlToDocx(htmlContent, {
        title: generatedContent.title || "Custom Report"
      });

      toast({
        title: "Export Successful",
        description: "DOCX file has been downloaded",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export to DOCX format",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (previewRef.current) {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Print Report</title>');
        printWindow.document.write('<style>body { font-family: Times New Roman, serif; margin: 40px; line-height: 1.6; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(previewRef.current.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const hasContent = generatedContent && Object.keys(generatedContent).length > 0;

  return (
    <GeneratorLayout
      title="Custom Report Generator"
      description="Create fully customized reports with complete control over structure and content"
      icon={<FileSignature className="w-8 h-8" />}
      gradient="from-indigo-500 to-purple-500"
    >
      <div className="grid grid-cols-12 gap-6">
        {/* Configuration Panel - 4 columns */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Report Configuration
              </CardTitle>
              <CardDescription>
                Customize every aspect of your report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Topic */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="topic">Report Topic / Title</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestTopic}
                    disabled={isLoadingTopic}
                    className="text-xs"
                  >
                    {isLoadingTopic ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Suggesting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 mr-1" />
                        Suggest Topic
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter your report topic or title..."
                  className="min-h-[80px]"
                  data-testid="input-topic"
                />
              </div>

              {/* Structure Specifications */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Document Structure</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pages">Number of Pages</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setTargetPages(Math.max(1, targetPages - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="pages"
                        type="number"
                        value={targetPages}
                        onChange={(e) => setTargetPages(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center"
                        min="1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setTargetPages(targetPages + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="chapters">Chapters/Sections</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumChapters(Math.max(1, numChapters - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="chapters"
                        type="number"
                        value={numChapters}
                        onChange={(e) => setNumChapters(Math.max(1, parseInt(e.target.value) || 1))}
                        className="text-center"
                        min="1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumChapters(numChapters + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tables" className="flex items-center gap-2">
                      <Table className="w-4 h-4" />
                      Tables
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumTables(Math.max(0, numTables - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="tables"
                        type="number"
                        value={numTables}
                        onChange={(e) => setNumTables(Math.max(0, parseInt(e.target.value) || 0))}
                        className="text-center"
                        min="0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumTables(numTables + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="figures" className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      Figures
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumFigures(Math.max(0, numFigures - 1))}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="figures"
                        type="number"
                        value={numFigures}
                        onChange={(e) => setNumFigures(Math.max(0, parseInt(e.target.value) || 0))}
                        className="text-center"
                        min="0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNumFigures(numFigures + 1)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* References Configuration */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  References Configuration
                </h3>

                <div className="space-y-2">
                  <Label htmlFor="citation-style">Citation Style</Label>
                  <Select value={citationStyle} onValueChange={setCitationStyle}>
                    <SelectTrigger id="citation-style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CITATION_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min-refs">Minimum References</Label>
                  <Input
                    id="min-refs"
                    type="number"
                    value={minReferences}
                    onChange={(e) => setMinReferences(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Reference Types</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {REFERENCE_TYPES.map((type) => (
                      <div key={type} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`ref-${type}`}
                          checked={selectedReferenceTypes.includes(type)}
                          onChange={() => toggleReferenceType(type)}
                          className="rounded border-gray-300"
                        />
                        <Label htmlFor={`ref-${type}`} className="text-sm font-normal cursor-pointer">
                          {type}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Document Options */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">Document Options</h3>

                <div className="flex items-center justify-between">
                  <Label htmlFor="abstract">Include Abstract</Label>
                  <Switch
                    id="abstract"
                    checked={includeAbstract}
                    onCheckedChange={setIncludeAbstract}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="toc">Table of Contents</Label>
                  <Switch
                    id="toc"
                    checked={includeToc}
                    onCheckedChange={setIncludeToc}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="appendices">Include Appendices</Label>
                  <Switch
                    id="appendices"
                    checked={includeAppendices}
                    onCheckedChange={setIncludeAppendices}
                  />
                </div>
              </div>

              {/* Tone */}
              <div className="space-y-2">
                <Label htmlFor="tone">Writing Tone</Label>
                <Select value={tone} onValueChange={(v) => setTone(v as ToneType)}>
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="persuasive">Persuasive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Custom Instructions */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="instructions">Additional Instructions</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSuggestInstructions}
                    className="text-xs"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Suggest Instructions
                  </Button>
                </div>
                <Textarea
                  id="instructions"
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add any specific instructions or requirements..."
                  className="min-h-[100px]"
                />
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label>Upload Supporting Files</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    accept=".txt,.pdf,.docx,.doc,.jpg,.jpeg,.png"
                    multiple
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Upload reference text, images, PDFs, or Word files
                    </p>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                        <div className="flex items-center gap-2">
                          <FileIcon className="w-4 h-4" />
                          <span className="text-sm truncate">{file.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <UsageGate>
                {({ checkUsage, remainingAttempts, openPricing }) => (
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
                      onClick={() => handleGenerate(checkUsage)}
                      disabled={isGenerating || !topic || isProcessing || isSubmitting}
                      className="w-full"
                      size="lg"
                      data-testid="button-generate"
                    >
                      {isGenerating || isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Custom Report
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </UsageGate>

              {/* Progress */}
              {isGenerating && progress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Generating report...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Academic Guidelines Alert */}
          <Alert>
            <AlertDescription className="text-xs">
              <strong>Academic Standards Applied:</strong> This generator automatically follows proper figure/table introduction, reference formatting, and academic writing standards.
            </AlertDescription>
          </Alert>
        </div>

        {/* Preview Panel - 8 columns */}
        <div className="col-span-12 lg:col-span-8">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    Generated custom report preview
                  </CardDescription>
                </div>
                {hasContent && (
                  <div className="flex gap-2 flex-wrap">
                    {/* TTS Controls */}
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || !isAuthenticated}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-1" />
                      )}
                      Save
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-1" />
                          Export
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={handleExportHTML}>
                          <FileCode className="w-4 h-4 mr-2" />
                          Export as HTML
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportDocx}>
                          <FileDown className="w-4 h-4 mr-2" />
                          Export as DOCX
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handlePrint}>
                          <Printer className="w-4 h-4 mr-2" />
                          Print
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div
                ref={previewRef}
                className="prose prose-sm max-w-none dark:prose-invert bg-background p-6 rounded-lg border min-h-[600px] [&_code]:text-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-muted [&_pre]:text-foreground [&_pre_code]:bg-transparent"
                data-testid="preview-content"
              >
                {!hasContent ? (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center text-muted-foreground">
                    <FileSignature className="w-16 h-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No content yet</p>
                    <p className="text-sm">
                      Configure your report settings and click "Generate Custom Report"
                    </p>
                  </div>
                ) : (
                  <>
                    <h1 className="text-center mb-8">{generatedContent.title}</h1>

                    {includeAbstract && generatedContent.abstract && (
                      <div className="bg-muted p-4 rounded-lg mb-6">
                        <h2>Abstract</h2>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(parseMarkdownToHtml(generatedContent.abstract))
                          }}
                        />
                      </div>
                    )}

                    {generatedContent.sections?.map((section: any, index: number) => (
                      <div key={index} className="mb-8">
                        <h2>{section.heading || section.title}</h2>
                        <div
                          dangerouslySetInnerHTML={{
                            __html: sanitizeHtml(parseMarkdownToHtml(section.content || "")),
                          }}
                        />
                        {sectionImageUrls[index] && (
                          <figure className="my-6">
                            <img
                              src={sectionImageUrls[index]}
                              alt={section.image_caption || `Figure ${index + 1}`}
                              className="mx-auto rounded-lg border"
                            />
                            {section.image_caption && (
                              <figcaption className="text-center text-sm font-semibold mt-2">
                                {section.image_caption}
                              </figcaption>
                            )}
                          </figure>
                        )}
                      </div>
                    ))}

                    {generatedContent.references && generatedContent.references.length > 0 && (
                      <div className="mt-12 border-t pt-6">
                        <h2>References</h2>
                        <div className="space-y-2">
                          {generatedContent.references.map((ref: string, idx: number) => (
                            <div key={idx} className="text-sm pl-5 -indent-5">
                              {ref}
                            </div>
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
  );
}
