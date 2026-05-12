import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Image as ImageIcon, Download, Sparkles, Loader2, FileImage, Cloud, FileCode, Printer, FileDown, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useLocation } from "wouter";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { UsageGate } from "@/components/usage-gate";
import { queryClient } from "@/lib/queryClient";
import { saveDocument } from "@/lib/firebase";
import { exportHtmlToDocx } from "@/lib/docx-export";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { usePersistedState } from "@/hooks/use-persisted-state";

export default function GenerateImages() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = usePersistedState<string>("generator_prompt_images", "");
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState("vivid");
  const [quality, setQuality] = useState("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = usePersistedState<string | null>("generator_content_images", null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [undoImage, setUndoImage] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const imageRef = useRef<HTMLImageElement>(null);
  const [location] = useLocation();

  // Load template data from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templatePrompt = params.get('template');
    const templateName = params.get('name');

    if (templatePrompt) {
      setPrompt(templatePrompt);
      if (templateName) {
        toast({
          title: t("common.templateLoaded"),
          description: t("common.templateLoadedDesc", { name: templateName }),
        });
      }
    }
  }, [location]);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const tryLoadImage = (imageUrl: string, useCors = false): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (useCors) {
        img.crossOrigin = "anonymous";
      }

      const timeout = setTimeout(() => {
        reject(new Error("Image generation timed out"));
      }, 30000);

      img.onload = () => {
        clearTimeout(timeout);
        if (img.width > 0 && img.height > 0) {
          resolve(imageUrl);
        } else {
          reject(new Error("Image loaded but has no dimensions"));
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Failed to load image"));
      };

      img.src = imageUrl;
    });
  };

  const generateImageAPI = async (retryCount = 0): Promise<string> => {
    const maxRetries = 1;
    const seed = Math.floor(Math.random() * 1000000);
    const cleanPrompt = prompt.trim().replace(/\s+/g, ' ');
    const encodedPrompt = encodeURIComponent(cleanPrompt);

    // Get dimensions from size
    const [width, height] = size.split('x');

    const apiEndpoints = [
      `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&nologo=true&width=${width}&height=${height}`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}&width=${width}&height=${height}`,
      `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${seed}`,
    ];

    for (let endpointIndex = 0; endpointIndex < apiEndpoints.length; endpointIndex++) {
      try {
        return await tryLoadImage(apiEndpoints[endpointIndex], false);
      } catch (error) {
        try {
          return await tryLoadImage(apiEndpoints[endpointIndex], true);
        } catch (corsError) {
          if (endpointIndex < apiEndpoints.length - 1) {
            await sleep(500);
            continue;
          }
          if (retryCount < maxRetries) {
            await sleep(3000);
            return generateImageAPI(retryCount + 1);
          }
          throw new Error("Service temporarily unavailable. Please try again.");
        }
      }
    }

    throw new Error("All image generation endpoints failed");
  };

  const handleGenerate = async (checkUsage: () => Promise<boolean>) => {
    if (!prompt.trim()) {
      toast({
        title: t("pages.images.promptRequired"),
        description: t("pages.images.promptRequiredDesc"),
        variant: "destructive"
      });
      return;
    }

    const allowed = await checkUsage();
    if (!allowed) return;

    setIsGenerating(true);
    setGeneratedImage(null);
    setImageUrl(null);

    try {
      const imageUrl = await generateImageAPI();
      setImageUrl(imageUrl);
      setGeneratedImage(imageUrl);
      toast({
        title: t("pages.images.generated"),
        description: t("pages.images.generatedDesc"),
      });
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast({
        title: t("pages.images.generationFailed"),
        description: error.message || t("pages.images.promptRequiredDesc"),
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVariation = async (checkUsage: () => Promise<boolean>) => {
    if (!generatedImage) return;
    const allowed = await checkUsage();
    if (!allowed) return;
    setIsGenerating(true);
    setGeneratedImage(null);
    setImageUrl(null);
    try {
      const url = await generateImageAPI();
      setImageUrl(url);
      setGeneratedImage(url);
      toast({ title: t("pages.images.variationGenerated"), description: t("pages.images.variationGeneratedDesc") });
    } catch (error: any) {
      toast({ title: t("pages.images.generationFailed"), description: error.message || t("pages.images.downloadFailedDesc"), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (format: 'png' | 'jpeg' | 'webp') => {
    if (!generatedImage || !imageRef.current) return;

    try {
      // Create a canvas to convert the image
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = imageRef.current;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      ctx.drawImage(img, 0, 0);

      // Convert to desired format
      const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
      canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `generated-image-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: t("pages.images.downloadStarted"),
          description: t("pages.images.downloadStartedDesc", { format: format.toUpperCase() }),
        });
      }, mimeType, format === 'jpeg' ? 0.95 : undefined);
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: t("pages.images.downloadFailed"),
        description: t("pages.images.downloadFailedDesc"),
        variant: "destructive"
      });
    }
  };

  const handleRandomPrompt = () => {
    const randomPrompts = [
      t("pages.images.randomPrompt1"),
      t("pages.images.randomPrompt2"),
      t("pages.images.randomPrompt3"),
      t("pages.images.randomPrompt4"),
      t("pages.images.randomPrompt5"),
      t("pages.images.randomPrompt6"),
      t("pages.images.randomPrompt7"),
      t("pages.images.randomPrompt8"),
      t("pages.images.randomPrompt9"),
      t("pages.images.randomPrompt10")
    ];

    const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    setPrompt(randomPrompt);
    toast({
      title: t("pages.images.randomPrompt"),
      description: randomPrompt,
    });
  };

  const handleClear = () => {
    setUndoImage(generatedImage);
    setGeneratedImage(null);
  };

  const handleUndo = () => {
    setGeneratedImage(undoImage);
    setUndoImage(null);
  };

  const handleSave = async () => {
    if (!generatedImage) {
      toast({
        title: t("common.noContentToSave"),
        description: t("common.pleaseGenerateFirst"),
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: t("common.authRequired"),
        description: t("pages.images.authRequiredDesc"),
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Save image as a document to appear in My Projects
      await saveDocument({
        type: "image",
        title: prompt.substring(0, 100) || t("pages.images.untitledImage"),
        topic: prompt,
        content: {
          imageUrl: generatedImage,
          prompt: prompt
        },
        settings: {
          size,
          style,
          quality
        },
        language: "en"
      });

      // Invalidate documents query to refresh My Projects
      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: t("pages.images.imageSaved"),
        description: t("pages.images.imageSavedDesc"),
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: t("common.saveFailed"),
        description: error.message || t("common.failedSaveDocument"),
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export functions
  const handleExportHTML = () => {
    if (!generatedImage) return;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${prompt || t("pages.images.aiGeneratedImage")}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
    img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
    .prompt { margin-top: 20px; font-style: italic; color: #666; }
  </style>
</head>
<body>
  <h1>${t("pages.images.aiGeneratedImage")}</h1>
  <img src="${generatedImage}" alt="${prompt}" />
  <p class="prompt">${prompt}</p>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(prompt || 'ai-image').substring(0, 50).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t("common.exportSuccess"),
      description: t("pages.images.exportSuccessHTMLDesc"),
    });
  };

  const handleExportDOCX = async () => {
    if (!generatedImage) return;

    try {
      const htmlContent = `
        <h1>${t("pages.images.aiGeneratedImage")}</h1>
        <div style="text-align: center;">
          <img src="${generatedImage}" alt="${prompt}" />
          <p style="font-style: italic; margin-top: 10px;">${prompt}</p>
        </div>
      `;

      await exportHtmlToDocx(htmlContent, { title: prompt || t("pages.images.aiGeneratedImage") });

      toast({
        title: t("common.exportSuccess"),
        description: t("pages.images.exportSuccessDOCXDesc"),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("pages.images.exportFailed"),
        description: t("pages.images.exportFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (!generatedImage) return;

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${prompt || t("pages.images.aiGeneratedImage")}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
    img { max-width: 100%; height: auto; }
    .prompt { margin-top: 20px; font-style: italic; color: #666; }
    @media print { body { margin: 0; } @page { margin: 1in; } }
  </style>
</head>
<body>
  <h1>${t("pages.images.aiGeneratedImage")}</h1>
  <img src="${generatedImage}" alt="${prompt}" />
  <p class="prompt">${prompt}</p>
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  return (
    <UsageGate>
      {({ checkUsage, remainingAttempts, openPricing }) => (
        <GeneratorLayout
          title={t("pages.images.title")}
          description={t("pages.images.subtitle")}
          icon={<ImageIcon className="w-6 h-6 text-white" />}
          gradient="from-purple-500 to-pink-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("pages.images.configTitle")}</CardTitle>
                  <CardDescription>{t("pages.images.configDesc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="prompt">{t("pages.images.imageDescLabel")}</Label>
                    <Textarea
                      id="prompt"
                      placeholder={t("pages.images.promptPlaceholder")}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-32 mt-2"
                      data-testid="input-image-prompt"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      {prompt.length} {t("common.characters")}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRandomPrompt}
                    data-testid="button-random-prompt"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {t("pages.images.randomPromptBtn")}
                  </Button>

                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="size">{t("pages.images.imageSizeLabel")}</Label>
                      <Select value={size} onValueChange={setSize}>
                        <SelectTrigger id="size" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1024x1024">{t("pages.images.sizeSquare")}</SelectItem>
                          <SelectItem value="1792x1024">{t("pages.images.sizeLandscape")}</SelectItem>
                          <SelectItem value="1024x1792">{t("pages.images.sizePortrait")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="style">{t("pages.images.styleLabel")}</Label>
                      <Select value={style} onValueChange={setStyle}>
                        <SelectTrigger id="style" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vivid">{t("pages.images.styleVivid")}</SelectItem>
                          <SelectItem value="natural">{t("pages.images.styleNatural")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quality">{t("pages.images.qualityLabel")}</Label>
                      <Select value={quality} onValueChange={setQuality}>
                        <SelectTrigger id="quality" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">{t("pages.images.qualityStandard")}</SelectItem>
                          <SelectItem value="hd">{t("pages.images.qualityHD")}</SelectItem>
                        </SelectContent>
                      </Select>
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
                      disabled={!prompt.trim() || isGenerating}
                      onClick={() => handleGenerate(checkUsage)}
                      data-testid="button-generate-image"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t("common.generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          {t("pages.images.generateButton")}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-8 space-y-6">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle>{t("pages.images.resultTitle")}</CardTitle>
                      <CardDescription>{t("pages.images.resultDesc")}</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {generatedImage && (
                        <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVariation(checkUsage)}
                          disabled={isGenerating}
                          data-testid="button-variation"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          {t("common.variation")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSave}
                          disabled={!generatedImage || isSaving}
                          data-testid="button-save-image"
                        >
                          <Cloud className="w-4 h-4 mr-2" />
                          {isSaving ? t("common.saving") : t("common.save")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-download-menu">
                              <Download className="w-4 h-4 mr-2" />
                              {t("common.download")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload('png')} data-testid="download-png">
                              <FileImage className="w-4 h-4 mr-2" />
                              {t("pages.myProjects.downloadPNG")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('jpeg')} data-testid="download-jpeg">
                              <FileImage className="w-4 h-4 mr-2" />
                              {t("pages.myProjects.downloadJPEG")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('webp')} data-testid="download-webp">
                              <FileImage className="w-4 h-4 mr-2" />
                              {t("pages.myProjects.downloadWEBP")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-export-menu">
                              <FileDown className="w-4 h-4 mr-2" />
                              {t("common.export")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleExportHTML} data-testid="export-html">
                              <FileCode className="w-4 h-4 mr-2" />
                              {t("common.exportAsHTML")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportDOCX} data-testid="export-docx">
                              <FileDown className="w-4 h-4 mr-2" />
                              {t("common.exportAsWord")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handlePrint} data-testid="export-print">
                              <Printer className="w-4 h-4 mr-2" />
                              {t("common.print")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClear}
                        disabled={!generatedImage}
                        title={t("pages.images.clearImage")}
                        aria-label={t("pages.images.clearImage")}
                      >
                        <Trash2 className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t("common.clear")}</span>
                      </Button>
                      {undoImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUndo}
                          title={t("pages.images.undoClear")}
                          aria-label={t("pages.images.undoClear")}
                        >
                          <Undo2 className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">{t("common.undo")}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg bg-background min-h-[600px] overflow-auto p-4" style={{ maxHeight: '800px' }}>
                    {generatedImage ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <img
                          ref={imageRef}
                          src={generatedImage}
                          alt={t("pages.images.altGenerated")}
                          className="max-w-full h-auto rounded-lg shadow-lg"
                          crossOrigin="anonymous"
                        />
                        <div className="text-xs text-muted-foreground text-center max-w-md">
                          <p className="font-medium mb-1">{t("pages.images.promptUsed")}:</p>
                          <p className="italic">"{prompt}"</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-16 px-4">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">{t("pages.images.emptyState")}</p>
                        <p className="text-sm mt-2">{t("pages.images.emptyStateHint")}</p>
                        <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                          <p className="font-medium text-center mb-3">{t("pages.images.features")}</p>
                          <ul className="space-y-1">
                            <li>• {t("pages.images.feature1")}</li>
                            <li>• {t("pages.images.feature2")}</li>
                            <li>• {t("pages.images.feature3")}</li>
                            <li>• {t("pages.images.feature4")}</li>
                            <li>• {t("pages.images.feature5")}</li>
                            <li>• {t("pages.images.feature6")}</li>
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
