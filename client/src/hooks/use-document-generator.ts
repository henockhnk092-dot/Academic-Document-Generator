import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { DocumentType, ToneType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { usePersistedState } from "@/hooks/use-persisted-state";
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
  const { toast } = useToast();

  const generateMutation = useMutation({
    mutationFn: async (options: GeneratorOptions): Promise<GeneratorResponse> => {
      setProgress(30);

      // Automatically include the current UI language so generated content matches
      const currentLang = i18n.language || localStorage.getItem("academicgen_lang") || "en";
      const optionsWithLang = { ...options, language: options.language ?? currentLang };

      const endpoint = `/api/generate/${documentType}`;
      const response = await apiRequest("POST", endpoint, optionsWithLang) as GeneratorResponse;
      
      setProgress(60);
      
      if (options.generateImages && response.content) {
        await Promise.all([
          new Promise(resolve => setTimeout(resolve, 500)),
        ]);
        setProgress(90);
      }
      
      return response;
    },
    onSuccess: (data: GeneratorResponse) => {
      setProgress(100);
      setGeneratedContent(data.content);
      toast({
        title: "Success!",
        description: "Document generated successfully",
      });
    },
    onError: (error: any) => {
      setProgress(0);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate document",
        variant: "destructive",
      });
    },
  });

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
    isGenerating: generateMutation.isPending,
    generatedContent,
    progress,
    reset,
    clearContent,
    updateSection,
    error: generateMutation.error,
  };
}
