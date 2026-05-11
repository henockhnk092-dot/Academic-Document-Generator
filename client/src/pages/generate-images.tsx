import { useState, useRef, useEffect } from "react";
import { Image as ImageIcon, Download, Sparkles, Loader2, FileImage, Cloud, FileCode, Printer, FileDown, RefreshCw } from "lucide-react";
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
  const [prompt, setPrompt] = usePersistedState<string>("generator_prompt_images", "");
  const [size, setSize] = useState("1024x1024");
  const [style, setStyle] = useState("vivid");
  const [quality, setQuality] = useState("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = usePersistedState<string | null>("generator_content_images", null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
          title: "Template loaded",
          description: `Using template: ${templateName}`,
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
        title: "Prompt required",
        description: "Please enter a description for your image",
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
        title: "Image generated successfully",
        description: "Your image is ready to download"
      });
    } catch (error: any) {
      console.error("Image generation error:", error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate image. Please try again.",
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
      toast({ title: "Variation generated", description: "A new variation of your image is ready" });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message || "Failed to generate variation.", variant: "destructive" });
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
          title: "Download started",
          description: `Image downloaded as ${format.toUpperCase()}`
        });
      }, mimeType, format === 'jpeg' ? 0.95 : undefined);
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Failed to download image. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleRandomPrompt = () => {
    const randomPrompts = [
      "A serene mountain landscape at sunset with golden clouds",
      "A futuristic cityscape with flying cars and neon lights",
      "An enchanted forest with glowing mushrooms and fairy lights",
      "A cozy coffee shop on a rainy day with warm lighting",
      "A majestic dragon soaring through stormy clouds",
      "An underwater coral reef teeming with colorful fish",
      "A vintage library with towering bookshelves and a fireplace",
      "A cyberpunk street market with holographic displays",
      "A peaceful zen garden with a koi pond and cherry blossoms",
      "A steampunk airship floating above Victorian-era buildings"
    ];

    const randomPrompt = randomPrompts[Math.floor(Math.random() * randomPrompts.length)];
    setPrompt(randomPrompt);
    toast({
      title: "Random prompt generated",
      description: randomPrompt
    });
  };

  const handleSave = async () => {
    if (!generatedImage) {
      toast({
        title: "No image to save",
        description: "Please generate an image first",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to save images",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Save image as a document to appear in My Projects
      await saveDocument({
        type: "image",
        title: prompt.substring(0, 100) || "Untitled Image",
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
        title: "Image saved",
        description: "Your image has been saved successfully"
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save image. Please try again.",
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
  <title>${prompt || 'AI Generated Image'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
    img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
    .prompt { margin-top: 20px; font-style: italic; color: #666; }
  </style>
</head>
<body>
  <h1>AI Generated Image</h1>
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
      title: "Export successful",
      description: "HTML file downloaded successfully",
    });
  };

  const handleExportDOCX = async () => {
    if (!generatedImage) return;

    try {
      const htmlContent = `
        <h1>AI Generated Image</h1>
        <div style="text-align: center;">
          <img src="${generatedImage}" alt="${prompt}" />
          <p style="font-style: italic; margin-top: 10px;">${prompt}</p>
        </div>
      `;

      await exportHtmlToDocx(htmlContent, { title: prompt || 'AI Generated Image' });

      toast({
        title: "Export successful",
        description: "DOCX file downloaded successfully",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export failed",
        description: "Failed to export document",
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
  <title>${prompt || 'AI Generated Image'}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; text-align: center; }
    img { max-width: 100%; height: auto; }
    .prompt { margin-top: 20px; font-style: italic; color: #666; }
    @media print { body { margin: 0; } @page { margin: 1in; } }
  </style>
</head>
<body>
  <h1>AI Generated Image</h1>
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
          title="AI Image Generator"
          description="Create stunning images from text descriptions using advanced AI"
          icon={<ImageIcon className="w-6 h-6 text-white" />}
          gradient="from-purple-500 to-pink-500"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Configuration Panel */}
            <div className="lg:col-span-4 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Image Configuration</CardTitle>
                  <CardDescription>Describe the image you want to create</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label htmlFor="prompt">Image Description</Label>
                    <Textarea
                      id="prompt"
                      placeholder="Describe your image in detail..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-32 mt-2"
                      data-testid="input-image-prompt"
                    />
                    <div className="text-xs text-muted-foreground mt-2">
                      {prompt.length} characters
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleRandomPrompt}
                    data-testid="button-random-prompt"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Random Prompt
                  </Button>

                  <div className="space-y-4 pt-4 border-t">
                    <div>
                      <Label htmlFor="size">Image Size</Label>
                      <Select value={size} onValueChange={setSize}>
                        <SelectTrigger id="size" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1024x1024">Square (1024×1024)</SelectItem>
                          <SelectItem value="1792x1024">Landscape (1792×1024)</SelectItem>
                          <SelectItem value="1024x1792">Portrait (1024×1792)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="style">Style</Label>
                      <Select value={style} onValueChange={setStyle}>
                        <SelectTrigger id="style" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vivid">Vivid (Dramatic & Detailed)</SelectItem>
                          <SelectItem value="natural">Natural (Realistic & Subtle)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="quality">Quality</Label>
                      <Select value={quality} onValueChange={setQuality}>
                        <SelectTrigger id="quality" className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard</SelectItem>
                          <SelectItem value="hd">HD (Higher Detail)</SelectItem>
                        </SelectContent>
                      </Select>
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
                      disabled={!prompt.trim() || isGenerating}
                      onClick={() => handleGenerate(checkUsage)}
                      data-testid="button-generate-image"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Image
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
                      <CardTitle>Generated Image</CardTitle>
                      <CardDescription>Your AI-generated image will appear here</CardDescription>
                    </div>
                    {generatedImage && (
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVariation(checkUsage)}
                          disabled={isGenerating}
                          data-testid="button-variation"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Variation
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSave}
                          disabled={!generatedImage || isSaving}
                          data-testid="button-save-image"
                        >
                          <Cloud className="w-4 h-4 mr-2" />
                          {isSaving ? "Saving..." : "Save"}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-download-menu">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload('png')} data-testid="download-png">
                              <FileImage className="w-4 h-4 mr-2" />
                              Download as PNG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('jpeg')} data-testid="download-jpeg">
                              <FileImage className="w-4 h-4 mr-2" />
                              Download as JPEG
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload('webp')} data-testid="download-webp">
                              <FileImage className="w-4 h-4 mr-2" />
                              Download as WEBP
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" data-testid="button-export-menu">
                              <FileDown className="w-4 h-4 mr-2" />
                              Export
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleExportHTML} data-testid="export-html">
                              <FileCode className="w-4 h-4 mr-2" />
                              Export as HTML
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportDOCX} data-testid="export-docx">
                              <FileDown className="w-4 h-4 mr-2" />
                              Export as Word
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handlePrint} data-testid="export-print">
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
                  <div className="border rounded-lg bg-background min-h-[600px] overflow-auto p-4" style={{ maxHeight: '800px' }}>
                    {generatedImage ? (
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <img
                          ref={imageRef}
                          src={generatedImage}
                          alt="Generated"
                          className="max-w-full h-auto rounded-lg shadow-lg"
                          crossOrigin="anonymous"
                        />
                        <div className="text-xs text-muted-foreground text-center max-w-md">
                          <p className="font-medium mb-1">Prompt used:</p>
                          <p className="italic">"{prompt}"</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-16 px-4 h-full flex flex-col items-center justify-center">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">Your generated image will appear here</p>
                        <p className="text-sm mt-2">Enter a description and click "Generate Image" to start</p>
                        <div className="mt-6 text-xs text-left max-w-md mx-auto space-y-2 bg-muted/30 p-4 rounded-lg">
                          <p className="font-medium text-center mb-3">Image Generator Features:</p>
                          <ul className="space-y-1">
                            <li>• AI-powered image generation from text</li>
                            <li>• Multiple size options (square, landscape, portrait)</li>
                            <li>• Vivid or natural style selection</li>
                            <li>• Standard or HD quality output</li>
                            <li>• Download in PNG, JPEG, or WEBP format</li>
                            <li>• Random prompt suggestions</li>
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
