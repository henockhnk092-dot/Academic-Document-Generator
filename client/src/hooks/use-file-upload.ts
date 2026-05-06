import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useFileUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const { toast } = useToast();

  const processFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/files/process", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to process file");
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
        title: "Files Processed",
        description: `Successfully processed ${fileArray.length} file(s)`,
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process file",
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
