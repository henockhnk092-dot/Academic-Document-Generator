import { useState, useRef, useEffect, useCallback } from "react";
import { Presentation, Sparkles, Upload, Download, Save, Play, Pause, X, FileIcon, FileCode, Cloud, Image as ImageIcon, Mic, MessageSquare, Volume2, LayoutTemplate, Loader2, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, Printer, FileText, Wand2, BookOpenCheck, Trash2, Undo2 } from "lucide-react";
import { useLocation } from "wouter";
import { storeForHumanizer, storeForCitations } from "@/lib/humanize-transfer";
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
import { useCtrlEnter } from "@/hooks/use-ctrl-enter";
import { usePersistedState } from "@/hooks/use-persisted-state";
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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
          setAudioError(t("pages.powerpoint.errUnableToPlay"));
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
            setAudioError(t("pages.powerpoint.errTtsUnavailable"));
          }
        } catch (e: any) {
          console.error("Audio generation error:", e);
          setAudioError(e.message || t("pages.powerpoint.errAudioFailed"));
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
    setAudioError(t("pages.powerpoint.errAudioFormat"));
  };

  return (
    <div className="mt-4 bg-white dark:bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <audio ref={audioRef} onEnded={handleAudioEnded} onError={handleAudioError} style={{ display: 'none' }} />

      <div className="bg-primary/10 px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-primary uppercase tracking-wide">{t("pages.powerpoint.speakerNotesHeading")}:</h4>
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
                {isLoadingAudio ? t("common.loading") : isPlaying ? t("components.tts.pause") : t("pages.powerpoint.playVoice")}
              </span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
        <div className="p-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span className="text-xs font-bold uppercase tracking-wider">{t("pages.powerpoint.whatToSay")}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed italic whitespace-pre-wrap">
            {scriptText || t("pages.powerpoint.noScript")}
          </p>
        </div>
        <div className="p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground">
            <Volume2 className="w-3 h-3" />
            <span className="text-xs font-bold uppercase tracking-wider">{t("pages.powerpoint.toneDelivery")}</span>
          </div>
          <div className="text-sm text-foreground font-medium">
            "{tone || t("pages.powerpoint.defaultTone")}"
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
  const { t } = useTranslation();
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
        className={`px-3 py-3 sm:px-6 sm:py-4 ${isTitle ? 'text-white flex-grow flex flex-col justify-center items-center text-center py-8 sm:py-12 rounded-t-lg relative min-h-[180px] sm:min-h-[300px]' : 'bg-muted/30 border-b border-border rounded-t-lg'}`}
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
                <p className="text-white text-sm">{t("pages.powerpoint.loadingBackgroundImage")}</p>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleManualGenerate}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {t("pages.powerpoint.loadBackgroundImage")}
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
        <h2 className={`font-bold tracking-tight leading-tight ${isTitle ? 'text-white text-xl sm:text-2xl md:text-4xl relative z-10' : 'text-lg sm:text-xl text-foreground'}`} style={isTitle ? { textShadow: '0 2px 4px rgba(0,0,0,0.5)' } : {}}>
          {slide.title}
        </h2>
        {isTitle && slide.content && (
          <div className="mt-4 text-base opacity-90 font-light space-y-1 relative z-10" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {Array.isArray(slide.content) && slide.content.map((line: string, i: number) => <p key={i}>{line}</p>)}
          </div>
        )}
      </div>

      {!isTitle && (
        <div className="flex-grow p-3 sm:p-6 flex flex-col md:flex-row gap-3 sm:gap-6">
          <div className={`flex-1 flex flex-col justify-start ${isSplit ? 'md:w-1/2' : ''}`}>
            {renderContent()}

            {slide.layout_guide && (
              <div className="mt-auto pt-6 text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-2">
                <LayoutTemplate className="w-3 h-3" />
                {t("pages.powerpoint.layoutLabel")} {slide.layout_guide}
              </div>
            )}
          </div>

          {isSplit && showImages && (
            <div className="flex-1 flex flex-col justify-center md:w-1/2">
              <div className="flex-grow bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center border-2 border-dashed border-border relative min-h-[150px] sm:min-h-[200px]">
                {slide.imgData ? (
                  <img src={slide.imgData} alt={t("pages.powerpoint.altSlideVisual")} className="w-full h-full object-contain" />
                ) : (
                  <div className="text-center p-6">
                    {loadingImg ? (
                      <Loader2 className="animate-spin mx-auto text-primary mb-2" size={32} />
                    ) : (
                      <ImageIcon className="mx-auto text-muted-foreground mb-2" size={40} />
                    )}
                    <p className="text-sm text-muted-foreground font-medium">
                      {loadingImg ? t("pages.powerpoint.loadingImage") : t("pages.powerpoint.imagePlaceholder")}
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
                        {t("pages.powerpoint.generateImage")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {slide.visual_prompt && (
                <p className="text-xs text-muted-foreground mt-2 text-center italic truncate">
                  {t("pages.powerpoint.searchLabel")} {slide.visual_prompt}
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
  const { t } = useTranslation();
  const [topic, setTopic] = usePersistedState("ppt_form_topic", "");
  const [slideCount, setSlideCount] = usePersistedState("ppt_form_slides", "auto");
  const [tone, setTone] = usePersistedState<ToneType>("ppt_form_tone", "professional");
  const [generateImages, setGenerateImages] = useState(true);
  const [speakerNotes, setSpeakerNotes] = useState(true);
  const [ttsCoaching, setTtsCoaching] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'slideshow' | 'scroll'>('slideshow');
  const [slideImageUrls, setSlideImageUrls] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [presentation, setPresentation] = useState<any>(null);

  const { generate, isGenerating, generatedContent, progress, clearContent, restore } = useDocumentGenerator("powerpoint");
  const [undoContent, setUndoContent] = useState<any>(null);
  const [undoImageUrls, setUndoImageUrls] = useState<Record<number, string>>({});
  const generateButtonRef = useRef<HTMLButtonElement>(null);
  useCtrlEnter(() => { generateButtonRef.current?.click(); }, isGenerating);

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
  const [location, navigate] = useLocation();

  // Load template data from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templatePrompt = params.get('template');
    const templateName = params.get('name');

    if (templatePrompt) {
      setTopic(templatePrompt);
      if (templateName) {
        toast({
          title: t("common.templateLoaded"),
          description: t("common.templateLoadedDesc", { name: templateName }),
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
      toast({ title: t("common.noContentToExport"), description: t("pages.powerpoint.noContentDesc"),  variant: "destructive" });
      return;
    }
    exportToHTML(presentation, `${topic.substring(0, 30) || "presentation"}.html`);
    toast({ title: t("common.exportSuccess"), description: t("pages.powerpoint.exportSuccessHTMLDesc") });
  };

  const handleExportPPTX = async () => {
    if (!presentation || !presentation.slides) {
      toast({ title: t("common.noContentToExport"), description: t("pages.powerpoint.noContentDesc"), variant: "destructive" });
      return;
    }
    try {
      // Show progress messages during export - presentation already has imgData from handleImageLoaded
      await exportToPPTX(
        presentation,
        `${topic.substring(0, 30) || "presentation"}.pptx`,
        (message: string) => {
          toast({ title: t("pages.powerpoint.exporting"), description: message });
        }
      );
      toast({ title: t("common.exportSuccess"), description: t("pages.powerpoint.exportSuccessPPTXDesc") });
    } catch (error) {
      console.error("PowerPoint export error:", error);
      toast({ title: t("pages.powerpoint.exportFailed"), description: t("pages.powerpoint.exportFailedDesc"), variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    if (!presentation || !presentation.slides) {
      toast({ title: t("common.noContentToExport"), description: t("pages.powerpoint.noContentDesc"), variant: "destructive" });
      return;
    }
    toast({ title: t("common.generatingPDF"), description: t("common.mayTakeSeconds") });
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
      toast({ title: t("common.pdfDownloaded"), description: t("pages.powerpoint.exportedPDF") });
    } catch {
      toast({ title: t("common.pdfExportFailed"), description: t("common.printOptionInstead"), variant: "destructive" });
    }
  };

  const handlePrint = () => {
    if (!presentation || !presentation.slides) {
      toast({ title: t("common.noContentToPrint"), description: t("pages.powerpoint.noContentDesc"), variant: "destructive" });
      return;
    }

    // Build HTML content for printing
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${presentation.title || t("generators.powerpoint")}</title>
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
  <h1 style="text-align: center; margin-bottom: 40px; color: #1e3a8a;">${presentation.title || t("generators.powerpoint")}</h1>`;

    presentation.slides.forEach((slide: any, index: number) => {
      html += `
  <div class="slide">
    <div class="slide-header">
      <div class="slide-number">${t("pages.powerpoint.slideNumberOfTotal", { current: index + 1, total: presentation.slides.length })}</div>
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
        html += `<img src="${slide.imgData}" alt="${t("pages.powerpoint.altSlideVisual")}" />`;
      }

      html += `</div>`;

      // Add speaker notes if available
      const speakerNotes = slide.speaker_script || slide.speakerNotes;
      if (speakerNotes) {
        html += `
    <div class="speaker-notes">
      <div class="speaker-notes-title">${t("pages.powerpoint.speakerNotes")}:</div>
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

      toast({ title: t("common.printReady"), description: t("common.printReadyDesc") });
    } else {
      toast({ title: t("common.printFailed"), description: t("common.printFailedDesc"), variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!isAuthenticated || !user) {
      toast({
        title: t("common.authRequired"),
        description: t("pages.powerpoint.authRequiredDesc"),
        variant: "destructive"
      });
      return;
    }

    if (!presentation || !presentation.slides) {
      toast({
        title: t("common.noContentToSave"),
        description: t("pages.powerpoint.noContentDesc"),
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
      const documentTitle = presentation.title || topic || t("generators.powerpoint");

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
        title: t("pages.powerpoint.saved"),
        description: t("pages.powerpoint.savedSuccess")
      });
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: t("common.saveFailed"),
        description: t("pages.powerpoint.saveFailedDesc"),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setUndoContent(generatedContent);
    setUndoImageUrls(slideImageUrls);
    clearContent();
    setPresentation(null);
    setSlideImageUrls({});
  };

  const handleUndo = () => {
    restore(undoContent);
    setSlideImageUrls(undoImageUrls);
    setUndoContent(null);
    setUndoImageUrls({});
  };

  const handleHumanize = () => {
    if (!presentation) return;
    storeForHumanizer(presentation);
    navigate("/humanize");
  };

  const handleCitationCheck = () => {
    if (!presentation) return;
    storeForCitations(presentation);
    navigate("/citations");
  };

  const totalSlides = presentation?.slides?.length || 0;

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, usageStatus, openPricing }) => (
        <GeneratorLayout
          title={t("pages.powerpoint.title")}
          description={t("pages.powerpoint.subtitle")}
          icon={<Presentation className="w-6 h-6 text-white" />}
          gradient="from-orange-500 to-red-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("pages.powerpoint.configTitle")}</CardTitle>
                  <CardDescription>{t("pages.powerpoint.configSubtitle")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Tabs defaultValue="text" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="text" data-testid="tab-text-input">{t("common.textInput")}</TabsTrigger>
                      <TabsTrigger value="upload" data-testid="tab-file-upload">{t("common.fileUpload")}</TabsTrigger>
                    </TabsList>
                    <TabsContent value="text" className="space-y-4">
                      <div>
                        <Label htmlFor="topic">{t("pages.powerpoint.topicLabel")}</Label>
                        <Textarea
                          id="topic"
                          placeholder={t("pages.powerpoint.topicPlaceholder")}
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          className="min-h-32 mt-2"
                          data-testid="input-presentation-topic"
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
                            description: t("common.topicIs", { topic: randomResult.topic }),
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
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover-elevate transition-colors relative">
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
                      <Label htmlFor="slide-count">{t("pages.powerpoint.slideCount")}</Label>
                      <Select value={slideCount} onValueChange={setSlideCount}>
                        <SelectTrigger id="slide-count" className="mt-2" data-testid="select-slide-count">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">{t("common.autoAIDetermined")}</SelectItem>
                        <SelectItem value="5-10">{t("pages.powerpoint.slides5to10")}</SelectItem>
                        <SelectItem value="11-15">{t("pages.powerpoint.slides11to15")}</SelectItem>
                        <SelectItem value="16-20">{t("pages.powerpoint.slides16to20")}</SelectItem>
                        <SelectItem value="20+">{t("pages.powerpoint.slides20plus")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="tone">{t("pages.powerpoint.presentationStyle")}</Label>
                      <Select value={tone} onValueChange={(val) => setTone(val as ToneType)}>
                        <SelectTrigger id="tone" className="mt-2" data-testid="select-tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="academic">{t("common.toneAcademic")}</SelectItem>
                          <SelectItem value="professional">{t("common.toneProfessional")}</SelectItem>
                          <SelectItem value="creative">{t("common.toneCreative")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="generate-images">{t("pages.powerpoint.autoImages")}</Label>
                        <p className="text-xs text-muted-foreground">{t("pages.powerpoint.autoImagesHint")}</p>
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
                        <Label htmlFor="speaker-notes">{t("pages.powerpoint.speakerNotes")}</Label>
                        <p className="text-xs text-muted-foreground">{t("pages.powerpoint.speakerNotesHint")}</p>
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
                        <Label htmlFor="tts-coaching">{t("pages.powerpoint.voiceCoaching")}</Label>
                        <p className="text-xs text-muted-foreground">{t("pages.powerpoint.voiceCoachingHint")}</p>
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
                        <span>{t("common.genRemaining", { count: remainingAttempts })}</span>
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
                      ref={generateButtonRef}
                      disabled={!topic?.trim() || isGenerating || isProcessing}
                      onClick={() => handleGenerate(checkUsage)}
                      data-testid="button-generate-presentation"
                    >
                      {isGenerating ? (
                        <>{t("common.generating")}</>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {t("pages.powerpoint.generateButton")}
                        </>
                      )}
                    </Button>
                    {!isGenerating && (
                      <p className="text-xs text-center text-muted-foreground mt-1 no-print">
                        {t("common.ctrlEnterHintPre")} <kbd className="px-1 py-0.5 rounded border text-xs font-mono bg-muted">Ctrl+↵</kbd> {t("common.ctrlEnterHintPost")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle>{t("pages.powerpoint.previewTitle")}</CardTitle>
                      <CardDescription>
                        {presentation ? t("pages.powerpoint.slidesGenerated", { count: totalSlides }) : t("pages.powerpoint.previewSubtitle")}
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
                            {t("pages.powerpoint.slideshow")}
                          </Button>
                          <Button
                            variant={viewMode === 'scroll' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('scroll')}
                            className="text-xs font-bold"
                            data-testid="button-view-scroll"
                          >
                            {t("pages.powerpoint.scroll")}
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
                        {isSaving ? t("common.saving") : t("common.save")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleHumanize}
                        disabled={!presentation}
                        title={t("common.sendToHumanizer")}
                        aria-label={t("common.sendToHumanizer")}
                      >
                        <Wand2 className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t("common.humanize")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCitationCheck}
                        disabled={!presentation}
                        title={t("common.checkCitations")}
                        aria-label={t("common.checkCitations")}
                      >
                        <BookOpenCheck className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t("common.checkCitations")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClear}
                        disabled={!presentation}
                        title={t("common.clearPresentation")}
                        aria-label={t("common.clearPresentation")}
                      >
                        <Trash2 className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t("common.clear")}</span>
                      </Button>
                      {undoContent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUndo}
                          title={t("common.undoClear")}
                          aria-label={t("common.undoClear")}
                        >
                          <Undo2 className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">{t("common.undo")}</span>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="button-export-menu">
                            <Download className="w-4 h-4 mr-2" />
                            {t("common.export")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleExportPDF} data-testid="export-pdf">
                            <FileText className="w-4 h-4 mr-2" />
                            {t("common.exportAsPDF")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportHTML} data-testid="export-html">
                            <FileCode className="w-4 h-4 mr-2" />
                            {t("common.exportAsHTML")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleExportPPTX} data-testid="export-pptx">
                            <Presentation className="w-4 h-4 mr-2" />
                            {t("pages.powerpoint.exportAsPPTX")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handlePrint} data-testid="export-print">
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
                    <div className="space-y-4 mb-6" role="status" aria-live="polite" aria-label={t("pages.powerpoint.generatingProgress", { progress })}>
                      <Progress value={progress} className="w-full" />
                      <div className="text-sm text-muted-foreground text-center">
                        {t("pages.powerpoint.creatingSlides")}
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
                                tone={presentation.slides[currentSlide].speaker_tone || t("common.toneProfessional")}
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
                                  <h3 className="text-sm font-bold text-foreground">{t("pages.powerpoint.jumpToSlide")}</h3>
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
                                      tone={slide.speaker_tone || t("common.toneProfessional")}
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
                        <p className="font-medium">{t("pages.powerpoint.emptyState")}</p>
                        <p className="text-sm mt-2">{t("pages.powerpoint.emptyStateHint")}</p>
                        <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                          <p className="font-medium text-center mb-3">{t("pages.powerpoint.features")}</p>
                          <ul className="space-y-1">
                            <li>• {t("pages.powerpoint.feature1")}</li>
                            <li>• {t("pages.powerpoint.feature2")}</li>
                            <li>• {t("pages.powerpoint.feature3")}</li>
                            <li>• {t("pages.powerpoint.feature4")}</li>
                            <li>• {t("pages.powerpoint.feature5")}</li>
                            <li>• {t("pages.powerpoint.feature6")}</li>
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
