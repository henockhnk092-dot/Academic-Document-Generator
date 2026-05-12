import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function useFileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const { toast } = useToast();
  const { t } = useTranslation();

  const processFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/files/process", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(t("hooks.fileUpload.failedProcessFile"));
    }

    const data = await response.json();
    return data.text || "";
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    setIsProcessing(true);
    const fileArray = Array.from(files);
    
    try {
      const texts = await Promise.all(fileArray.map(processFile));
      const combinedText = texts.join("\n\n");
      
      setUploadedFiles((prev) => [...prev, ...fileArray]);
      setExtractedText((prev) => prev + "\n\n" + combinedText);
      
      toast({
        title: t("hooks.fileUpload.filesProcessed"),
        description: t("hooks.fileUpload.processedDesc", { count: fileArray.length }),
      });
    } catch (error: any) {
      toast({
        title: t("hooks.fileUpload.uploadFailed"),
        description: error.message || t("hooks.fileUpload.failedProcessFile"),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setUploadedFiles([]);
    setExtractedText("");
  };

  return {
    uploadedFiles,
    isProcessing,
    extractedText,
    handleFileUpload,
    removeFile,
    clearAll,
  };
}
