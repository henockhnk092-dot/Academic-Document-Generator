import { useState, useRef } from "react";
import React from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentType, ToneType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning";
import { ToastAction } from "@/components/ui/toast";
import i18n from "@/i18n";

export interface Author {
  name: string;
  affiliation: string;
  email: string;
}

export interface CustomFormat {
  fontSize: string;
  lineSpacing: string;
  padding: string;
  textAlign: string;
  textColor: string;
  fontFamily: string;
}

export interface GeneratorOptions {
  topic: string;
  targetLength?: string;
  tone?: ToneType;
  citationStyle?: string;
  slideCount?: string;
  targetPages?: string;
  generateImages?: boolean;
  template?: string;
  authors?: Author[];
  customFormat?: CustomFormat;
  includeToc?: boolean;
  language?: string;
}

interface GeneratorResponse {
  content?: any;
  success?: boolean;
  message?: string;
}

export function useDocumentGenerator(documentType: DocumentType) {
  const [generatedContent, setGeneratedContent] = usePersistedState<any>(
    `generator_content_${documentType}`,
    null
  );
  const [progress, setProgress] = useState(0);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
  const { toast } = useToast();
  const lastOptionsRef = useRef<GeneratorOptions | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useUnsavedWarning(!!generatedContent && progress > 0 && progress < 100);

  const startCountdown = (seconds: number, toastUpdate: (props: any) => void) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    let remaining = seconds;
    setRateLimitCountdown(remaining);
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setRateLimitCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        setRateLimitCountdown(0);
        toastUpdate({
          title: "Ready",
          description: "You can generate again now.",
          variant: "default",
          duration: 4000,
        });
      } else {
        toastUpdate({
          title: "Rate limit reached",
          description: `Please wait ${remaining} second${remaining !== 1 ? "s" : ""}…`,
          variant: "destructive",
          duration: (remaining + 5) * 1000,
        });
      }
    }, 1000);
  };

  const generateMutation = useMutation({
    mutationFn: async (options: GeneratorOptions): Promise<GeneratorResponse> => {
      lastOptionsRef.current = options;
      setProgress(30);

      const currentLang = i18n.language || localStorage.getItem("academicgen_lang") || "en";
      const optionsWithLang = { ...options, language: options.language ?? currentLang };

      const endpoint = `/api/generate/${documentType}`;
      const response = await apiRequest("POST", endpoint, optionsWithLang) as GeneratorResponse;

      setProgress(60);

      if (options.generateImages && response.content) {
        await Promise.all([new Promise(resolve => setTimeout(resolve, 500))]);
        setProgress(90);
      }

      return response;
    },
    onSuccess: (data: GeneratorResponse) => {
      setProgress(100);
      setGeneratedContent(data.content);
      toast({ title: "Success!", description: "Document generated successfully", duration: 4000 });
    },
    onError: (error: any) => {
      setProgress(0);
      const is429 = error.message?.startsWith("429:");
      const canRetry = !!lastOptionsRef.current && !is429;

      if (is429) {
        const { update } = toast({
          title: "Rate limit reached",
          description: "Please wait 60 seconds…",
          variant: "destructive",
          duration: 70000,
        });
        startCountdown(60, update);
        return;
      }

      toast({
        title: "Generation Failed",
        description: error.message?.replace(/^\d+:\s*/, "") || "Failed to generate document",
        variant: "destructive",
        duration: 10000,
        action: canRetry
          ? React.createElement(
              ToastAction,
              { altText: "Retry", onClick: () => generateMutation.mutate(lastOptionsRef.current!) },
              "Retry"
            )
          : undefined,
      });
    },
  });

  const retry = () => {
    if (lastOptionsRef.current) generateMutation.mutate(lastOptionsRef.current);
  };

  const reset = () => {
    setGeneratedContent(null);
    setProgress(0);
  };

  const clearContent = () => {
    setGeneratedContent(null);
    setProgress(0);
  };

  const updateSection = (index: number, newContent: string) => {
    if (!generatedContent?.sections) return;
    const updatedSections = generatedContent.sections.map((s: any, i: number) =>
      i === index ? { ...s, content: newContent } : s
    );
    setGeneratedContent({ ...generatedContent, sections: updatedSections });
  };

  return {
    generate: generateMutation.mutate,
    retry,
    isGenerating: generateMutation.isPending,
    isRateLimited: rateLimitCountdown > 0,
    rateLimitCountdown,
    generatedContent,
    progress,
    reset,
    clearContent,
    updateSection,
    error: generateMutation.error,
  };
}
