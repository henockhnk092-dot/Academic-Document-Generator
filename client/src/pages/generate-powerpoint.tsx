import { useState, useRef, useEffect, useCallback } from "react";
import { Presentation, Sparkles, Upload, Download, Save, Play, Pause, X, FileIcon, FileCode, Cloud, Image as ImageIcon, Mic, MessageSquare, Volume2, LayoutTemplate, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Printer, FileText } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useDocumentGenerator } from "@/hooks/use-document-generator";
import { useRandomTopic } from "@/hooks/use-random-topic";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { UsageGate } from "@/components/usage-gate";
import { parseMarkdownToHtml, sanitizeHtml } from "@/lib/markdown-parser";
import { saveDocument } from "@/lib/firebase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { exportToPPTX, exportToHTML } from "@/lib/pptx-export";
import { azureAvailable, AZURE_VOICES, fetchAzureAudio, getSpeechPrefs } from "@/hooks/use-speech";
import type { ToneType } from "@shared/schema";

interface SlideImage {
  url: string;
  source: string;
}

interface PresentationCoachProps {
  script: string;
  tone: string;
  showTts: boolean;
  slideId: number;
}

function PresentationCoach({ script, tone, showTts, slideId }: PresentationCoachProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Convert script to string if it's an object (do this once at component level)
  const scriptText = typeof script === 'string'
    ? script
    : typeof script === 'object' && script !== null
      ? JSON.stringify(script, null, 2)
      : "";

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setAudioError(null);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [slideId]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleTogglePlay = async () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioUrl && audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.error("Audio play error:", e);
          setAudioError("Unable to play audio");
        }
      } else if (showTts && scriptText) {
        setIsLoadingAudio(true);
        setAudioError(null);
        try {
          let blob: Blob | null = null;

          // Try Azure TTS first (highest quality, generous limits)
          const azureVoice = getSpeechPrefs().voiceName || AZURE_VOICES[0]?.name || "en-US-JennyNeural";
          if (azureAvailable) {
            try {
              blob = await fetchAzureAudio(scriptText, azureVoice, 1);
            } catch {
              // fall through to Gemini TTS
            }
          }

          // Fall back to Gemini TTS
          if (!blob) {
            const response = await apiRequest("POST", "/api/tts/generate", {
              text: scriptText,
              tone: tone
            }) as { success: boolean; audio?: { audioBase64: string; mimeType: string }; error?: string };
            if (response.audio?.audioBase64) {
              const binaryString = atob(response.audio.audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              blob = new Blob([bytes], { type: response.audio.mimeType || "audio/wav" });
            }
          }

          if (blob) {
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
            if (audioRef.current) {
              audioRef.current.src = url;
              await audioRef.current.play();
              setIsPlaying(true);
            }
          } else {
            setAudioError("TTS not available");
          }
        } catch (e: any) {
          console.error("Audio generation error:", e);
          setAudioError(e.message || "Audio generation failed");
        } finally {
          setIsLoadingAudio(false);
        }
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioError = () => {
    setIsPlaying(false);
    setAudioError("Audio format not supported");
  };

  return (
    <div className="mt-4 bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <audio ref={audioRef} onEnded={handleAudioEnded} onError={handleAudioError} style={{ display: 'none' }} />

      <div className="bg-primary/10 px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-primary uppercase tracking-wide">Speaker Notes:</h4>
        </div>
        <div className="flex items-center gap-2">
          {audioError && (
            <span className="text-xs text-destructive">{audioError}</span>
          )}
          {showTts && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePlay}
              disabled={isLoadingAudio || !scriptText}
              className="h-7 px-3"
              data-testid="button-play-voice"
            >
              {isLoadingAudio ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : isPlaying ? (
                <Pause className="w-3 h-3 mr-1" />
              ) : (
                <Play className="w-3 h-3 mr-1" />
              )}
              <span className="text-xs">
                {isLoadingAudio ? "Loading..." : isPlaying ? "Pause" : "Play Voice"}
              </span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span className="text-xs font-bold uppercase tracking-wider">What to Say</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed italic whitespace-pre-wrap">
            {scriptText || "No specific script generated for this slide."}
          </p>
        </div>
        <div className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Volume2 className="w-3 h-3" />
            <span className="text-xs font-bold uppercase tracking-wider">Tone & Delivery</span>
          </div>
          <div className="text-sm text-foreground font-medium">
            "{tone || "Natural and conversational"}"
          </div>
        </div>
      </div>
    </div>
  );
}

interface SlideProps {
  slide: any;
  index: number;
  total: number;
  showImages: boolean;
  showTts: boolean;
  imageUrl: string | null;
  onImageLoaded: (index: number, url: string) => void;
}

function Slide({ slide, index, total, showImages, showTts, imageUrl, onImageLoaded }: SlideProps) {
  const [loadingImg, setLoadingImg] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    setImageLoaded(!!slide.imgData);
  }, [slide.imgData]);

  useEffect(() => {
    if (showImages && slide.visual_prompt && !slide.imgData && (slide.type === 'image_split' || slide.type === 'chart' || slide.type === 'title')) {
      setLoadingImg(true);
      apiRequest("POST", "/api/images/random", { query: slide.visual_prompt })
        .then((response: any) => {
          if (response.image) {
            const url = response.image.webformatURL || response.image.largeImageURL;
            onImageLoaded(index, url);
          }
        })
        .catch(e => console.error("Image generation error:", e))
        .finally(() => setLoadingImg(false));
    }
  }, [slide.visual_prompt, slide.imgData, index, showImages, onImageLoaded, slide.type]);

  const handleManualGenerate = async () => {
    if (slide.visual_prompt) {
      setLoadingImg(true);
      try {
        const response = await apiRequest("POST", "/api/images/random", { query: slide.visual_prompt }) as any;
        if (response.image) {
          const url = response.image.webformatURL || response.image.largeImageURL;
          onImageLoaded(index, url);
        }
      } catch (e) {
        console.error("Image generation error:", e);
      } finally {
        setLoadingImg(false);
      }
    }
  };

  const isTitle = slide.type === 'title';
  const isSplit = slide.type === 'image_split' || slide.type === 'chart';

  const renderContent = () => {
    if (!slide.content) return null;
    
    const contentText = Array.isArray(slide.content) 
      ? slide.content.map((item: string) => `• ${item}`).join('\n') 
      : slide.content;
    
    return (
      <div 
        className="document-content leading-relaxed"
        dangerouslySetInnerHTML={{ 
          __html: sanitizeHtml(parseMarkdownToHtml(contentText)) 
        }} 
      />
    );
  };

  return (
    <div className="bg-white dark:bg-card shadow-xl rounded-lg flex flex-col border border-border overflow-hidden">
      <div
        className={`px-6 py-4 ${isTitle ? 'text-white flex-grow flex flex-col justify-center items-center text-center py-12 rounded-t-lg relative min-h-[300px]' : 'bg-muted/30 border-b border-border rounded-t-lg'}`}
        style={isTitle && slide.imgData ? {
          backgroundImage: `linear-gradient(rgba(30, 58, 138, 0.4), rgba(30, 58, 138, 0.5)), url(${slide.imgData})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : isTitle ? { backgroundColor: 'hsl(var(--primary))' } : {}}
      >
        {isTitle && showImages && !slide.imgData && slide.visual_prompt && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/80 backdrop-blur-sm">
            {loadingImg ? (
              <div className="text-center">
                <Loader2 className="animate-spin mx-auto text-white mb-2" size={32} />
                <p className="text-white text-sm">Loading background image...</p>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManualGenerate}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Load Background Image
              </Button>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mb-2 relative z-10">
          <Badge variant="secondary" className="text-xs">
            {index + 1} / {total}
          </Badge>
          {slide.type && <Badge variant="outline" className="text-xs capitalize">{slide.type.replace('_', ' ')}</Badge>}
        </div>
        <h2 className={`text-xl font-bold tracking-tight leading-tight ${isTitle ? 'text-white text-2xl md:text-4xl relative z-10' : 'text-foreground'}`} style={isTitle ? { textShadow: '0 2px 4px rgba(0,0,0,0.5)' } : {}}>
          {slide.title}
        </h2>
        {isTitle && slide.content && (
          <div className="mt-4 text-base opacity-90 font-light space-y-1 relative z-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {Array.isArray(slide.content) && slide.content.map((line: string, i: number) => <p key={i}>{line}</p>)}
          </div>
        )}
      </div>

      {!isTitle && (
        <div className="flex-grow p-6 flex flex-col md:flex-row gap-6">
          <div className={`flex-1 flex flex-col justify-start ${isSplit ? 'md:w-1/2' : ''}`}>
            {renderContent()}

            {slide.layout_guide && (
              <div className="mt-auto pt-6 text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2">
                <LayoutTemplate className="w-3 h-3" />
                Layout: {slide.layout_guide}
              </div>
            )}
          </div>

          {isSplit && showImages && (
            <div className="flex-1 flex flex-col justify-center md:w-1/2">
              <div className="flex-grow bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-border relative min-h-[200px]">
                {slide.imgData ? (
                  <img src={slide.imgData} alt="Slide Visual" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center p-6">
                    {loadingImg ? (
                      <Loader2 className="animate-spin mx-auto text-primary mb-2" size={32} />
                    ) : (
                      <ImageIcon className="mx-auto text-muted-foreground mb-2" size={40} />
                    )}
                    <p className="text-sm text-muted-foreground font-medium">
                      {loadingImg ? "Loading image..." : "Image placeholder"}
                    </p>
                    {!loadingImg && slide.visual_prompt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManualGenerate}
                        className="mt-3"
                        data-testid={`button-generate-image-${index}`}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Generate Image
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {slide.visual_prompt && (
                <p className="text-xs text-muted-foreground mt-2 text-center italic truncate">
                  Search: {slide.visual_prompt}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function GeneratePowerPoint() {
  const [topic, setTopic] = useState("");
  const [slideCount, setSlideCount] = useState("auto");
  const [tone, setTone] = useState<ToneType>("professional");
  const [generateImages, setGenerateImages] = useState(true);
  const [speakerNotes, setSpeakerNotes] = useState(true);
  const [ttsCoaching, setTtsCoaching] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'slideshow' | 'scroll'>('slideshow');
  const [slideImageUrls, setSlideImageUrls] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [presentation, setPresentation] = useState<any>(null);

  const { generate, isGenerating, generatedContent, progress } = useDocumentGenerator("powerpoint");

  // Sync generatedContent to presentation state when it changes
  useEffect(() => {
    if (generatedContent) {
      setPresentation(generatedContent);
    }
  }, [generatedContent]);
  const { generateTopic, isLoading: isLoadingTopic } = useRandomTopic();
  const { uploadedFiles, isProcessing, extractedText, handleFileUpload, removeFile } = useFileUpload();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [location] = useLocation();

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

  const handleGenerate = async (checkUsage: () => Promise<boolean>) => {
    const allowed = await checkUsage();
    if (!allowed) return;
    
    setSlideImageUrls({});
    setCurrentSlide(0);
    
    const finalTopic = extractedText ? `${topic}\n\nAdditional Context:\n${extractedText}` : topic;
    generate({
      topic: finalTopic,
      slideCount,
      tone,
      generateImages,
    });
  };

  const handleImageLoaded = useCallback((index: number, url: string) => {
    // Update separate image URLs state (for backward compatibility)
    setSlideImageUrls(prev => ({ ...prev, [index]: url }));

    // Also update the presentation slides with imgData (like the reference implementation)
    setPresentation((prev: any) => {
      if (!prev || !prev.slides) return prev;
      const newSlides = [...prev.slides];
      newSlides[index] = {
        ...newSlides[index],
        imgData: url
      };
      return { ...prev, slides: newSlides };
    });
  }, []);

  const handleExportHTML = () => {
    if (!presentation || !presentation.slides) {
      toast({ title: "No content to export", description: "Please generate a presentation first",  variant: "destructive" });
      return;
    }
    exportToHTML(presentation, `${topic.substring(0, 30) || "presentation"}.html`);
    toast({ title: "Export successful", description: "HTML file downloaded successfully" });
  };

  const handleExportPPTX = async () => {
    if (!presentation || !presentation.slides) {
      toast({ title: "No content to export", description: "Please generate a presentation first", variant: "destructive" });
      return;
    }
    try {
      // Show progress messages during export - presentation already has imgData from handleImageLoaded
      await exportToPPTX(
        presentation,
        `${topic.substring(0, 30) || "presentation"}.pptx`,
        (message: string) => {
          toast({ title: "Exporting...", description: message });
        }
      );
      toast({ title: "Export successful", description: "PowerPoint file downloaded successfully" });
    } catch (error) {
      console.error("PowerPoint export error:", error);
      toast({ title: "Export failed", description: "Failed to export PowerPoint file", variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    if (!presentation || !presentation.slides) {
      toast({ title: "No content to export", description: "Please generate a presentation first", variant: "destructive" });
      return;
    }
    toast({ title: "Generating PDF…", description: "This may take a few seconds." });
    try {
      const slideImageUrls: Record<number, string> = {};
      presentation.slides.forEach((slide: any, i: number) => {
        if (slide.imgData) slideImageUrls[i] = slide.imgData;
        else if (slide.imageUrl) slideImageUrls[i] = slide.imageUrl;
      });
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: presentation, imageUrls: slideImageUrls, type: "powerpoint" }),
      });
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(presentation.title ?? "presentation").replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded!", description: "Your presentation has been exported as PDF." });
    } catch {
      toast({ title: "PDF Export Failed", description: "Please try the Print option instead.", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    if (!presentation || !presentation.slides) {
      toast({ title: "No content to print", description: "Please generate a presentation first", variant: "destructive" });
      return;
    }

    // Build HTML content for printing
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${presentation.title || 'Presentation'}</title>
  <style>
    body { font-family: 'Arial', sans-serif; margin: 40px; line-height: 1.6; color: #1a1a1a; }
    .slide { page-break-after: always; margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; }
    .slide:last-child { page-break-after: auto; }
    .slide-header { background: #1e3a8a; color: white; padding: 15px; margin: -20px -20px 20px -20px; }
    .slide-number { font-size: 12px; opacity: 0.8; }
    .slide-title { font-size: 24px; font-weight: bold; margin: 10px 0; }
    .slide-content { margin: 20px 0; }
    .slide-content ul { margin: 10px 0; padding-left: 30px; }
    .slide-content li { margin: 8px 0; }
    .speaker-notes { background: #f3f4f6; padding: 15px; margin-top: 20px; border-left: 4px solid #3b82f6; }
    .speaker-notes-title { font-weight: bold; margin-bottom: 8px; font-size: 14px; }
    img { max-width: 100%; height: auto; margin: 15px 0; }
    @media print {
      body { margin: 0; }
      @page { margin: 1in; }
      .slide { page-break-after: always; }
    }
  </style>
</head>
<body>
  <h1 style="text-align: center; margin-bottom: 40px; color: #1e3a8a;">${presentation.title || 'Presentation'}</h1>`;

    presentation.slides.forEach((slide: any, index: number) => {
      html += `
  <div class="slide">
    <div class="slide-header">
      <div class="slide-number">Slide ${index + 1} of ${presentation.slides.length}</div>
      <div class="slide-title">${slide.title || ''}</div>
    </div>
    <div class="slide-content">`;

      if (Array.isArray(slide.content)) {
        html += `<ul>`;
        slide.content.forEach((item: string) => {
          html += `<li>${item}</li>`;
        });
        html += `</ul>`;
      } else if (slide.content) {
        html += sanitizeHtml(parseMarkdownToHtml(slide.content));
      }

      // Add image if available
      if (slide.imgData) {
        html += `<img src="${slide.imgData}" alt="Slide visual" />`;
      }

      html += `</div>`;

      // Add speaker notes if available
      const speakerNotes = slide.speaker_script || slide.speakerNotes;
      if (speakerNotes) {
        html += `
    <div class="speaker-notes">
      <div class="speaker-notes-title">Speaker Notes:</div>
      <div>${speakerNotes}</div>
    </div>`;
      }

      html += `
  </div>`;
    });

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

      toast({ title: "Print Ready", description: "Print dialog opened" });
    } else {
      toast({ title: "Print Failed", description: "Please allow popups to print", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save your presentation",
        variant: "destructive"
      });
      return;
    }

    if (!presentation || !presentation.slides) {
      toast({
        title: "No content to save",
        description: "Please generate a presentation first",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Get first slide content - could be string or array
      const firstSlideContent = presentation.slides?.[0]?.content;
      const contentText = Array.isArray(firstSlideContent)
        ? firstSlideContent.join(' ').substring(0, 200)
        : typeof firstSlideContent === 'string'
          ? firstSlideContent.substring(0, 200)
          : null;

      // Extract title from presentation first, then fall back to user input
      const documentTitle = presentation.title || topic || "Presentation";

      const description = topic ||
        contentText ||
        documentTitle;

      await saveDocument({
        type: "powerpoint",
        title: documentTitle.substring(0, 100),
        topic: description,
        content: presentation,
        settings: {
          slideCount,
          tone,
          generateImages,
          speakerNotes,
          ttsCoaching
        },
        language: "en",
      });

      // Invalidate documents query to refresh Document History
      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: "Saved successfully",
        description: "Your presentation has been saved to the cloud"
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: "Failed to save presentation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const totalSlides = presentation?.slides?.length || 0;

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, usageStatus, openPricing }) => (
        <GeneratorLayout
          title="PowerPoint Presentation Generator"
          description="Professional slides with AI structuring, auto-images, speaker notes, and voice coaching"
          icon={<Presentation className="w-6 h-6 text-white" />}
          gradient="from-orange-500 to-red-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Presentation Configuration</CardTitle>
                  <CardDescription>Define your presentation topic and settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="text" data-testid="tab-text-input">Text Input</TabsTrigger>
                      <TabsTrigger value="upload" data-testid="tab-file-upload">File Upload</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="space-y-4">
                      <div>
                        <Label htmlFor="topic">Presentation Topic</Label>
                        <Textarea
                          id="topic"
                          placeholder="Enter your presentation topic..."
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          className="min-h-32 mt-2"
                          data-testid="input-presentation-topic"
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
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate transition-colors relative">
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
                      <Label htmlFor="slide-count">Number of Slides</Label>
                      <Select value={slideCount} onValueChange={setSlideCount}>
                        <SelectTrigger id="slide-count" className="mt-2" data-testid="select-slide-count">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (AI-determined)</SelectItem>
                          <SelectItem value="5-10">5-10 Slides</SelectItem>
                          <SelectItem value="11-15">11-15 Slides</SelectItem>
                          <SelectItem value="16-20">16-20 Slides</SelectItem>
                          <SelectItem value="20+">20+ Slides</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tone">Presentation Style</Label>
                      <Select value={tone} onValueChange={(val) => setTone(val as ToneType)}>
                        <SelectTrigger id="tone" className="mt-2" data-testid="select-tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="academic">Academic</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="creative">Creative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="generate-images">Auto-Generate Images</Label>
                        <p className="text-xs text-muted-foreground">Add relevant images from Pixabay</p>
                      </div>
                      <Switch
                        id="generate-images"
                        checked={generateImages}
                        onCheckedChange={setGenerateImages}
                        data-testid="switch-generate-images"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="speaker-notes">Speaker Notes & Scripts</Label>
                        <p className="text-xs text-muted-foreground">Include what to say for each slide</p>
                      </div>
                      <Switch
                        id="speaker-notes"
                        checked={speakerNotes}
                        onCheckedChange={setSpeakerNotes}
                        data-testid="switch-speaker-notes"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="tts-coaching">Voice Coaching (TTS)</Label>
                        <p className="text-xs text-muted-foreground">AI reads speaker notes aloud</p>
                      </div>
                      <Switch
                        id="tts-coaching"
                        checked={ttsCoaching}
                        onCheckedChange={setTtsCoaching}
                        data-testid="switch-tts-coaching"
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
                          View Pricing
                        </button>
                      </div>
                    )}
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!topic?.trim() || isGenerating || isProcessing}
                      onClick={() => handleGenerate(checkUsage)}
                      data-testid="button-generate-presentation"
                    >
                      {isGenerating ? (
                        <>Generating...</>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Presentation
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
                      <CardTitle>Slide Preview</CardTitle>
                      <CardDescription>
                        {presentation ? `${totalSlides} slides generated` : "Real-time preview of your presentation"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {totalSlides > 0 && viewMode === 'slideshow' && (
                        <div className="flex items-center gap-1 mr-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                            disabled={currentSlide === 0}
                            data-testid="button-prev-slide"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-sm px-2">
                            {currentSlide + 1} / {totalSlides}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentSlide(Math.min(totalSlides - 1, currentSlide + 1))}
                            disabled={currentSlide === totalSlides - 1}
                            data-testid="button-next-slide"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      {totalSlides > 0 && (
                        <div className="flex bg-muted/50 rounded-lg p-1 mr-2">
                          <Button
                            variant={viewMode === 'slideshow' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('slideshow')}
                            className="text-xs font-bold"
                            data-testid="button-view-slideshow"
                          >
                            Slideshow
                          </Button>
                          <Button
                            variant={viewMode === 'scroll' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('scroll')}
                            className="text-xs font-bold"
                            data-testid="button-view-scroll"
                          >
                            Scroll
                          </Button>
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || !presentation}
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
                          <Button variant="outline" size="sm" data-testid="button-export-menu">
                            <Download className="w-4 h-4 mr-2" />
                            Export
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleExportPDF} data-testid="export-pdf">
                            <FileText className="w-4 h-4 mr-2" />
                            Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportHTML} data-testid="export-html">
                            <FileCode className="w-4 h-4 mr-2" />
                            Export as HTML
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportPPTX} data-testid="export-pptx">
                            <Presentation className="w-4 h-4 mr-2" />
                            Export as PowerPoint (.pptx)
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
                        Creating slides with AI...
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg bg-background min-h-[600px] overflow-auto p-4" style={{ maxHeight: '800px' }}>
                    {presentation?.slides && presentation.slides.length > 0 ? (
                      <>
                        {/* Slideshow View - One slide at a time */}
                        {viewMode === 'slideshow' && (
                          <div className="space-y-4">
                            <Slide
                              slide={presentation.slides[currentSlide]}
                              index={currentSlide}
                              total={totalSlides}
                              showImages={generateImages}
                              showTts={ttsCoaching}
                              imageUrl={slideImageUrls[currentSlide] || null}
                              onImageLoaded={handleImageLoaded}
                            />

                            {/* Speaker Notes for current slide (outside the slide) */}
                            {(presentation.slides[currentSlide].speaker_script || presentation.slides[currentSlide].speakerNotes) && (
                              <PresentationCoach
                                script={presentation.slides[currentSlide].speaker_script || presentation.slides[currentSlide].speakerNotes}
                                tone={presentation.slides[currentSlide].speaker_tone || "Professional"}
                                showTts={ttsCoaching}
                                slideId={currentSlide}
                              />
                            )}

                            <div className="flex justify-center gap-1 pt-4">
                              {presentation.slides.map((_: any, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => setCurrentSlide(idx)}
                                  className={`w-2 h-2 rounded-full transition-colors ${
                                    idx === currentSlide ? 'bg-primary' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                                  }`}
                                  data-testid={`button-slide-dot-${idx}`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Scroll View - All slides shown */}
                        {viewMode === 'scroll' && (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Slide Navigation Sidebar - Only in Scroll Mode */}
                            <div className="hidden lg:block lg:col-span-3">
                              <div className="sticky top-4 space-y-2 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="flex items-center gap-2 mb-3">
                                  <ChevronDown className="w-4 h-4 text-primary animate-bounce" />
                                  <h3 className="text-sm font-bold text-foreground">Jump to Slide</h3>
                                </div>
                                {presentation.slides.map((slide: any, idx: number) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      const element = document.getElementById(`slide-${idx}`);
                                      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent hover:border-primary transition-all group"
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0">
                                        {idx + 1}
                                      </div>
                                      <span className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">{slide.title}</span>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Slides Content */}
                            <div className="lg:col-span-9 space-y-8 pb-10">
                              {presentation.slides.map((slide: any, idx: number) => (
                                <div key={idx} id={`slide-${idx}`} className="space-y-4 scroll-mt-4">
                                  <Slide
                                    slide={slide}
                                    index={idx}
                                    total={totalSlides}
                                    showImages={generateImages}
                                    showTts={ttsCoaching}
                                    imageUrl={slideImageUrls[idx] || null}
                                    onImageLoaded={handleImageLoaded}
                                  />

                                  {/* Speaker Notes for each slide (outside the slide) */}
                                  {(slide.speaker_script || slide.speakerNotes) && (
                                    <PresentationCoach
                                      script={slide.speaker_script || slide.speakerNotes}
                                      tone={slide.speaker_tone || "Professional"}
                                      showTts={ttsCoaching}
                                      slideId={idx}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground py-16 px-4">
                        <Presentation className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">Your presentation slides will appear here</p>
                        <p className="text-sm mt-2">Configure settings and click "Generate Presentation" to start</p>
                        <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                          <p className="font-medium text-center mb-3">PowerPoint Features:</p>
                          <ul className="space-y-1">
                            <li>• Professional title slide with background images</li>
                            <li>• AI-structured content with 6x6 rule</li>
                            <li>• Auto-generated visuals from Pixabay</li>
                            <li>• Speaker notes with delivery guidance</li>
                            <li>• TTS voice coaching for practice</li>
                            <li>• Export to .pptx or HTML format</li>
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
