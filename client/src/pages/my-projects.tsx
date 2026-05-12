import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Presentation, FileSpreadsheet, GraduationCap, Trash2, FolderOpen, Search, Download, Eye, Plus, Globe, FileCode, FileDown, Printer, Image as ImageIcon, BookOpen, Table, Volume2, Copy, CheckSquare, Square, SortAsc } from "lucide-react";
import { useGeminiTTS } from "@/hooks/use-gemini-tts";
import { DocumentTTSControls } from "@/components/document-tts-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseDb } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, orderBy } from "firebase/firestore";
import { exportHtmlToDocx } from "@/lib/docx-export";
import { parseMarkdownToHtml, sanitizeHtml } from "@/lib/markdown-parser";

type SavedDocument = {
  id: string;
  type: string;
  title: string;
  topic?: string;
  content?: any;
  language?: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
};

const iconMap: Record<string, any> = {
  report: FileText,
  powerpoint: Presentation,
  conference: FileSpreadsheet,
  thesis: GraduationCap,
  references: BookOpen,
};

const gradientMap: Record<string, string> = {
  report: "from-blue-500 to-cyan-500",
  powerpoint: "from-orange-500 to-red-500",
  conference: "from-purple-500 to-pink-500",
  thesis: "from-green-500 to-emerald-500",
  references: "from-amber-500 to-yellow-500",
};

const typeLabels: Record<string, string> = {}; // populated inside component via t()

// Helper function to format dates from various formats
const formatDate = (dateValue: string | number | Date | undefined): string => {
  if (!dateValue) return "";

  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? "" : dateValue.toLocaleDateString();
  }

  // If it's a string that looks like a timestamp number, convert it
  const timestamp = typeof dateValue === "string" ? parseInt(dateValue, 10) : dateValue;

  // Check if the parsed value is a valid number
  if (isNaN(timestamp)) return "";

  const date = new Date(timestamp);

  // Check if date is valid
  if (isNaN(date.getTime())) return "";

  return date.toLocaleDateString();
};

const dateTimestamp = (dateValue: string | number | Date | undefined): number => {
  if (!dateValue) return 0;
  if (dateValue instanceof Date) return dateValue.getTime();
  const timestamp = typeof dateValue === "string" ? parseInt(dateValue, 10) : dateValue;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

// Helper function to check if content is valid (not a corrupted Event object)
const isValidContent = (content: any): boolean => {
  if (!content) return false;

  // Check for serialized Event object (happens when event is accidentally saved as content)
  if (typeof content === 'object' &&
      Object.keys(content).length === 1 &&
      'isTrusted' in content) {
    return false;
  }

  // Check for empty or invalid string content
  if (typeof content === 'string' && content.trim() === '') {
    return false;
  }

  return true;
};

export default function MyProjects() {
  const { t } = useTranslation();
  const typeLabelsT: Record<string, string> = {
    report: t("pages.myProjects.technicalReport"),
    powerpoint: t("pages.myProjects.powerpoint"),
    "custom-report": t("pages.myProjects.customReport"),
    conference: t("pages.myProjects.conferencePaper"),
    thesis: t("pages.myProjects.thesis"),
    references: t("pages.myProjects.referenceLibrary"),
    image: t("pages.myProjects.aiImages"),
    images: t("pages.myProjects.aiImages"),
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "az" | "za">("newest");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);
  const { toast} = useToast();
  const { user, isAuthenticated } = useAuth();

  // TTS hook for reading document aloud (using high-quality Gemini TTS)
  const tts = useGeminiTTS();

  // Stop TTS when dialog closes
  useEffect(() => {
    if (!viewDocumentId) {
      tts.stop();
    }
  }, [viewDocumentId]);

  // Helper function to extract text content from document for TTS
  const getDocumentTextContent = (doc: any): string => {
    if (!doc?.content) return "";

    // String content (markdown)
    if (typeof doc.content === 'string') {
      return doc.content;
    }

    // Image content - read the prompt
    if (doc.content.imageUrl) {
      return doc.content.prompt || doc.title || "";
    }

    // PowerPoint slides
    if (doc.content.slides) {
      return doc.content.slides.map((slide: any, index: number) => {
        let slideText = `Slide ${index + 1}: ${slide.title || ''}. `;
        if (Array.isArray(slide.content)) {
          slideText += slide.content.join('. ');
        }
        if (slide.speakerNotes) {
          slideText += ` ${t("pages.myProjects.speakerNotes")} ${slide.speakerNotes}`;
        }
        return slideText;
      }).join(' ');
    }

    // Reference Library - extract from HTML
    if (doc.content.html && doc.content.references) {
      return doc.content.html;
    }

    // Conference Papers (IEEE HTML format)
    if (doc.content.type === 'html' && doc.content.html) {
      return doc.content.html;
    }

    // Sections (reports, thesis, conference papers)
    if (doc.content.sections) {
      let text = "";
      if (doc.content.abstract) {
        text += `Abstract: ${doc.content.abstract}. `;
      }
      text += doc.content.sections.map((section: any) => {
        return `${section.heading || section.title}. ${section.content || ''}`;
      }).join(' ');
      if (doc.content.references && Array.isArray(doc.content.references)) {
        text += ` ${t("pages.myProjects.references")}: ` + doc.content.references.join('. ');
      }
      return text;
    }

    return "";
  };

  // Fetch documents from Firebase Firestore
  const { data: documentsData, isLoading: isLoadingDocs, error: docsError } = useQuery({
    queryKey: ["documents", user?.uid],
    queryFn: async () => {
      const db = getFirebaseDb();

      if (!db || !user?.uid) {
        return [];
      }

      const docsRef = collection(db, "documents");
      const q = query(docsRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));

      const querySnapshot = await getDocs(q);

      const docs = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
        };
      }) as SavedDocument[];

      return docs;
    },
    enabled: isAuthenticated && !!user?.uid,
  });

  useEffect(() => {
    if (documentsData) {
      setDocuments(documentsData);
    }
  }, [documentsData]);

  useEffect(() => {
    if (docsError) {
      console.error("=== DOCUMENT FETCH ERROR ===");
      console.error(docsError);
    }
  }, [docsError]);

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const db = getFirebaseDb();
      if (!db) throw new Error("Firebase not initialized");

      const docRef = doc(db, "documents", documentId);
      await deleteDoc(docRef);
      return documentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", user?.uid] });
      toast({
        title: t("pages.myProjects.deletedTitle"),
        description: t("pages.myProjects.deletedDesc"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("pages.myProjects.deleteFailedTitle"),
        description: error.message || t("pages.myProjects.exportFailedDesc"),
        variant: "destructive",
      });
    },
  });

  const filteredDocuments = (() => {
    let docs = documents ?? [];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter((d: any) =>
        d.title?.toLowerCase().includes(q) || d.topic?.toLowerCase().includes(q)
      );
    }
    if (filterType !== "all") {
      docs = docs.filter((d: any) => d.type === filterType);
    }
    if (sortBy === "oldest") docs = [...docs].sort((a, b) => dateTimestamp(a.createdAt) - dateTimestamp(b.createdAt));
    else if (sortBy === "az") docs = [...docs].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    else if (sortBy === "za") docs = [...docs].sort((a, b) => (b.title ?? "").localeCompare(a.title ?? ""));
    // newest is the default (Firebase orderBy desc already handles it)
    return docs;
  })();

  const viewedDocument = documents.find(d => d.id === viewDocumentId);

  // Export functions
  const handleExportHTML = (doc: SavedDocument) => {

    let htmlContent = "";

    if (doc.content) {
      if (typeof doc.content === 'string') {
        htmlContent = `<h1>${doc.title}</h1>`;
        htmlContent += sanitizeHtml(parseMarkdownToHtml(doc.content));
      } else if (doc.content.imageUrl) {
        // Handle AI-generated images
        htmlContent = `<h1>${doc.title}</h1>`;
        htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
        htmlContent += `<img src="${doc.content.imageUrl}" alt="${doc.content.prompt || doc.title}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
        if (doc.content.prompt) {
          htmlContent += `<p style="margin-top: 10px; font-style: italic;">${doc.content.prompt}</p>`;
        }
        htmlContent += `</div>`;
      } else if (doc.content.slides) {
        // Handle PowerPoint slides
        htmlContent = `<h1>${doc.title}</h1>`;
        doc.content.slides.forEach((slide: any, index: number) => {
          htmlContent += `<div style="page-break-after: always; margin-bottom: 40px; padding: 20px; border: 1px solid #ddd;">`;
          htmlContent += `<h2>Slide ${index + 1}: ${slide.title || ''}</h2>`;
          if (slide.imgData) {
            htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
            htmlContent += `<img src="${slide.imgData}" alt="${slide.title || t("pages.myProjects.slideImageAlt")}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
            htmlContent += `</div>`;
          }
          if (Array.isArray(slide.content)) {
            slide.content.forEach((item: string) => {
              htmlContent += `<p>${item}</p>`;
            });
          }
          if (slide.speakerNotes) {
            htmlContent += `<div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-left: 3px solid #666;">`;
            htmlContent += `<strong>${t("pages.myProjects.speakerNotes")}</strong><br>${slide.speakerNotes}`;
            htmlContent += `</div>`;
          }
          htmlContent += `</div>`;
        });
      } else if (doc.content.html && doc.content.references) {
        // Handle Reference Library - HTML already contains title
        htmlContent = doc.content.html;
      } else if (doc.content.sections) {
        // Handle sections (reports, thesis, conference papers)
        htmlContent = `<h1>${doc.title}</h1>`;
        doc.content.sections.forEach((section: any) => {
          htmlContent += `<h2>${section.heading || section.title}</h2>`;
          if (section.imageUrl) {
            htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
            htmlContent += `<img src="${section.imageUrl}" alt="${section.image_caption || section.heading || section.title}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
            if (section.image_caption) {
              htmlContent += `<p style="text-align: center; font-style: italic; margin-top: 8px;">${section.image_caption}</p>`;
            }
            htmlContent += `</div>`;
          }
          htmlContent += sanitizeHtml(parseMarkdownToHtml(section.content || ""));
        });
      }
    }

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9\\s]/g, '').replace(/\\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: t("pages.myProjects.exportSuccess"),
      description: t("pages.myProjects.htmlDownloaded"),
    });
  };

  const handleExportDOCX = async (doc: SavedDocument) => {
    try {
      let htmlContent = "";

      if (doc.content) {
        if (typeof doc.content === 'string') {
          htmlContent = `<h1>${doc.title}</h1>`;
          htmlContent += sanitizeHtml(parseMarkdownToHtml(doc.content));
        } else if (doc.content.imageUrl) {
          // Handle AI-generated images
          htmlContent = `<h1>${doc.title}</h1>`;
          htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
          htmlContent += `<img src="${doc.content.imageUrl}" alt="${doc.content.prompt || doc.title}" style="max-width: 100%; height: auto;" />`;
          if (doc.content.prompt) {
            htmlContent += `<p style="margin-top: 10px; font-style: italic;">${doc.content.prompt}</p>`;
          }
          htmlContent += `</div>`;
        } else if (doc.content.slides) {
          // Handle PowerPoint slides
          htmlContent = `<h1>${doc.title}</h1>`;
          doc.content.slides.forEach((slide: any, index: number) => {
            htmlContent += `<h2>Slide ${index + 1}: ${slide.title || ''}</h2>`;
            if (slide.imgData) {
              htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
              htmlContent += `<img src="${slide.imgData}" alt="${slide.title || t("pages.myProjects.slideImageAlt")}" style="max-width: 100%; height: auto;" />`;
              htmlContent += `</div>`;
            }
            if (Array.isArray(slide.content)) {
              slide.content.forEach((item: string) => {
                htmlContent += `<p>${item}</p>`;
              });
            }
            if (slide.speakerNotes) {
              htmlContent += `<p><strong>${t("pages.myProjects.speakerNotes")}</strong> ${slide.speakerNotes}</p>`;
            }
            htmlContent += `<hr/>`;
          });
        } else if (doc.content.html && doc.content.references) {
          // Handle Reference Library - HTML already contains title
          htmlContent = doc.content.html;
        } else if (doc.content.sections) {
          // Handle sections (reports, thesis, conference papers)
          htmlContent = `<h1>${doc.title}</h1>`;
          doc.content.sections.forEach((section: any) => {
            htmlContent += `<h2>${section.heading || section.title}</h2>`;
            if (section.imageUrl) {
              htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
              htmlContent += `<img src="${section.imageUrl}" alt="${section.image_caption || section.heading || section.title}" style="max-width: 100%; height: auto;" />`;
              if (section.image_caption) {
                htmlContent += `<p style="text-align: center; font-style: italic; margin-top: 8px;">${section.image_caption}</p>`;
              }
              htmlContent += `</div>`;
            }
            htmlContent += sanitizeHtml(parseMarkdownToHtml(section.content || ""));
          });
        }
      }

      await exportHtmlToDocx(htmlContent, { title: doc.title });

      toast({
        title: t("pages.myProjects.exportSuccess"),
        description: t("pages.myProjects.docxDownloaded"),
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: t("pages.myProjects.exportFailed"),
        description: t("pages.myProjects.exportFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handlePrint = (doc: SavedDocument) => {
    let htmlContent = "";

    if (doc.content) {
      if (typeof doc.content === 'string') {
        htmlContent = `<h1>${doc.title}</h1>`;
        htmlContent += sanitizeHtml(parseMarkdownToHtml(doc.content));
      } else if (doc.content.imageUrl) {
        // Handle AI-generated images
        htmlContent = `<h1>${doc.title}</h1>`;
        htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
        htmlContent += `<img src="${doc.content.imageUrl}" alt="${doc.content.prompt || doc.title}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
        if (doc.content.prompt) {
          htmlContent += `<p style="margin-top: 10px; font-style: italic;">${doc.content.prompt}</p>`;
        }
        htmlContent += `</div>`;
      } else if (doc.content.slides) {
        // Handle PowerPoint slides
        htmlContent = `<h1>${doc.title}</h1>`;
        doc.content.slides.forEach((slide: any, index: number) => {
          htmlContent += `<div style="page-break-after: always; margin-bottom: 40px; padding: 20px; border: 1px solid #ddd;">`;
          htmlContent += `<h2>Slide ${index + 1}: ${slide.title || ''}</h2>`;
          if (slide.imgData) {
            htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
            htmlContent += `<img src="${slide.imgData}" alt="${slide.title || t("pages.myProjects.slideImageAlt")}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
            htmlContent += `</div>`;
          }
          if (Array.isArray(slide.content)) {
            slide.content.forEach((item: string) => {
              htmlContent += `<p>${item}</p>`;
            });
          }
          if (slide.speakerNotes) {
            htmlContent += `<div style="margin-top: 20px; padding: 10px; background: #f5f5f5; border-left: 3px solid #666;">`;
            htmlContent += `<strong>${t("pages.myProjects.speakerNotes")}</strong><br>${slide.speakerNotes}`;
            htmlContent += `</div>`;
          }
          htmlContent += `</div>`;
        });
      } else if (doc.content.html && doc.content.references) {
        // Handle Reference Library - HTML already contains title
        htmlContent = doc.content.html;
      } else if (doc.content.sections) {
        // Handle sections (reports, thesis, conference papers)
        htmlContent = `<h1>${doc.title}</h1>`;
        doc.content.sections.forEach((section: any) => {
          htmlContent += `<h2>${section.heading || section.title}</h2>`;
          if (section.imageUrl) {
            htmlContent += `<div style="margin: 20px 0; text-align: center;">`;
            htmlContent += `<img src="${section.imageUrl}" alt="${section.image_caption || section.heading || section.title}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" />`;
            if (section.image_caption) {
              htmlContent += `<p style="text-align: center; font-style: italic; margin-top: 8px;">${section.image_caption}</p>`;
            }
            htmlContent += `</div>`;
          }
          htmlContent += sanitizeHtml(parseMarkdownToHtml(section.content || ""));
        });
      }
    }

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; line-height: 1.6; }
    h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { color: #1e3a8a; margin-top: 30px; }
    @media print { body { margin: 0; } @page { margin: 1in; } }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
      toast({ title: t("pages.myProjects.printReady"), description: t("pages.myProjects.printOpened") });
    } else {
      toast({ title: t("pages.myProjects.printFailed"), description: t("pages.myProjects.allowPopups"), variant: "destructive" });
    }
  };

  // Image download function for AI-generated images
  const handleDownloadImage = async (doc: SavedDocument, format: 'png' | 'jpeg' | 'webp') => {
    const imageUrl = (doc.content as any)?.imageUrl;
    if (!imageUrl) {
      toast({ title: t("pages.myProjects.noImage"), description: t("pages.myProjects.noImageDesc"), variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      // Create a canvas to convert the image
      const img = new Image();
      img.crossOrigin = "anonymous";

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(img, 0, 0);

      const mimeType = format === 'png' ? 'image/png' : format === 'jpeg' ? 'image/jpeg' : 'image/webp';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${doc.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast({ title: t("pages.myProjects.downloadSuccess"), description: t("pages.myProjects.imageDownloadedAs", { format: format.toUpperCase() }) });
    } catch (error) {
      console.error("Download error:", error);
      // Fallback: try direct download
      try {
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `${doc.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')}.${format}`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: t("pages.myProjects.downloadSuccess"), description: t("pages.myProjects.downloadSuccessDesc") });
      } catch (fallbackError) {
        toast({ title: t("pages.myProjects.downloadFailed"), description: t("pages.myProjects.downloadFailedDesc"), variant: "destructive" });
      }
    }
  };

  // Reference Library export functions
  const handleExportBibTeX = (doc: SavedDocument) => {
    const refs = (doc.content as any)?.references;
    if (!refs || refs.length === 0) {
      toast({ title: t("pages.myProjects.noReferences"), description: t("pages.myProjects.noReferencesDesc"), variant: "destructive" });
      return;
    }

    let bibtex = "";
    refs.forEach((ref: any) => {
      const key = `${ref.authors?.split(',')[0]?.trim() || 'unknown'}${ref.year || 'n.d.'}`.replace(/\s+/g, '');
      bibtex += `@${ref.type || 'misc'}{${key},\n`;
      if (ref.title) bibtex += `  title = {${ref.title}},\n`;
      if (ref.authors) bibtex += `  author = {${ref.authors}},\n`;
      if (ref.year) bibtex += `  year = {${ref.year}},\n`;
      if (ref.source) bibtex += `  journal = {${ref.source}},\n`;
      if (ref.doi) bibtex += `  doi = {${ref.doi}},\n`;
      if (ref.url) bibtex += `  url = {${ref.url}},\n`;
      bibtex += `}\n\n`;
    });

    const blob = new Blob([bibtex], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references_${new Date().toISOString().split('T')[0]}.bib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: t("pages.myProjects.exportSuccess"), description: t("pages.myProjects.exportedBibTeX", { count: refs.length }) });
  };

  const handleExportRIS = (doc: SavedDocument) => {
    const refs = (doc.content as any)?.references;
    if (!refs || refs.length === 0) {
      toast({ title: t("pages.myProjects.noReferences"), description: t("pages.myProjects.noReferencesDesc"), variant: "destructive" });
      return;
    }

    let ris = "";
    const typeMap: Record<string, string> = {
      article: "JOUR", book: "BOOK", conference: "CONF",
      website: "ELEC", thesis: "THES", report: "RPRT",
    };

    refs.forEach((ref: any) => {
      ris += `TY  - ${typeMap[ref.type || ""] || "GEN"}\n`;
      if (ref.title) ris += `TI  - ${ref.title}\n`;
      if (ref.authors) {
        ref.authors.split(',').forEach((author: string) => {
          ris += `AU  - ${author.trim()}\n`;
        });
      }
      if (ref.year) ris += `PY  - ${ref.year}\n`;
      if (ref.source) ris += `JO  - ${ref.source}\n`;
      if (ref.doi) ris += `DO  - ${ref.doi}\n`;
      if (ref.url) ris += `UR  - ${ref.url}\n`;
      if (ref.notes) ris += `AB  - ${ref.notes}\n`;
      ris += `ER  - \n\n`;
    });

    const blob = new Blob([ris], { type: "application/x-research-info-systems" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references_${new Date().toISOString().split('T')[0]}.ris`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: t("pages.myProjects.exportSuccess"), description: t("pages.myProjects.exportedRIS", { count: refs.length }) });
  };

  const handleExportCSV = (doc: SavedDocument) => {
    const refs = (doc.content as any)?.references;
    if (!refs || refs.length === 0) {
      toast({ title: t("pages.myProjects.noReferences"), description: t("pages.myProjects.noReferencesDesc"), variant: "destructive" });
      return;
    }

    const headers = [
      t("pages.references.titleLabel"),
      t("pages.references.authorsLabel"),
      t("pages.references.yearLabel"),
      t("pages.references.typeLabel"),
      t("pages.references.sourceLabel"),
      t("pages.references.urlFieldLabel"),
      t("pages.references.doiFieldLabel"),
      t("pages.references.notesLabel"),
      t("pages.references.tagsLabel"),
    ];
    const rows = refs.map((ref: any) => [
      ref.title || "",
      ref.authors || "",
      ref.year || "",
      ref.type || "",
      ref.source || "",
      ref.url || "",
      ref.doi || "",
      ref.notes || "",
      ref.tags?.join("; ") || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({ title: t("pages.myProjects.exportSuccess"), description: t("pages.myProjects.exportedCSV", { count: refs.length }) });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="page-my-projects">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t("pages.myProjects.title")}</h1>
            <p className="text-muted-foreground">
              {t("pages.myProjects.subtitle")}
            </p>
          </div>
          <Link href="/">
            <Button data-testid="button-create-new">
              <Plus className="w-4 h-4 mr-2" />
              {t("pages.myProjects.createNew")}
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("pages.myProjects.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-56"
              data-testid="input-search-projects"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="min-w-[10rem] w-auto"><SelectValue placeholder={t("pages.myProjects.allTypes")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("pages.myProjects.allTypes")}</SelectItem>
              <SelectItem value="report">{t("pages.myProjects.technicalReport")}</SelectItem>
              <SelectItem value="custom-report">{t("pages.myProjects.customReport")}</SelectItem>
              <SelectItem value="powerpoint">{t("pages.myProjects.powerpoint")}</SelectItem>
              <SelectItem value="conference">{t("pages.myProjects.conferencePaper")}</SelectItem>
              <SelectItem value="thesis">{t("pages.myProjects.thesis")}</SelectItem>
              <SelectItem value="images">{t("pages.myProjects.aiImages")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="min-w-[9rem] w-auto"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t("pages.myProjects.newestFirst")}</SelectItem>
              <SelectItem value="oldest">{t("pages.myProjects.oldestFirst")}</SelectItem>
              <SelectItem value="az">A → Z</SelectItem>
              <SelectItem value="za">Z → A</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={selectMode ? "default" : "outline"}
            size="sm"
            onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()); }}
          >
            {selectMode ? <CheckSquare className="w-4 h-4 mr-1.5" /> : <Square className="w-4 h-4 mr-1.5" />}
            {selectMode ? t("common.cancel") : t("pages.myProjects.select")}
          </Button>
          {selectMode && selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                for (const id of Array.from(selectedIds)) {
                  try {
                    const db = await getFirebaseDb();
                    if (db) await deleteDoc(doc(db, "documents", id));
                    setDocuments(prev => prev.filter(d => d.id !== id));
                  } catch { /* continue */ }
                }
                setSelectedIds(new Set());
                setSelectMode(false);
                toast({ title: t("pages.myProjects.bulkDeletedCount", { count: selectedIds.size }) });
              }}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {t("pages.myProjects.deleteWithCount", { count: selectedIds.size })}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <Badge variant="secondary" className="text-sm">
          {filteredDocuments.length !== documents.length ? `${filteredDocuments.length} / ` : ""}{t("pages.myProjects.documentCount", { count: documents.length })}
        </Badge>
      </div>

      {isLoadingDocs ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {searchQuery ? t("pages.myProjects.noDocumentsFound") : t("pages.myProjects.noDocumentsYet")}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchQuery
                    ? t("pages.myProjects.tryDifferentSearch")
                    : t("pages.myProjects.startGenerating")}
                </p>
                {!searchQuery && (
                  <Link href="/">
                    <Button data-testid="button-create-first-document">
                      {t("pages.myProjects.createFirst")}
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((doc: SavedDocument) => {
                const Icon = iconMap[doc.type] || FileText;
                const gradient = gradientMap[doc.type] || "from-gray-500 to-gray-600";

                const isSelected = selectedIds.has(doc.id ?? "");
                return (
                  <div key={doc.id} className="relative">
                    {selectMode && (
                      <button
                        onClick={() => setSelectedIds(prev => {
                          const next = new Set(prev);
                          isSelected ? next.delete(doc.id ?? "") : next.add(doc.id ?? "");
                          return next;
                        })}
                        className={`absolute top-3 left-3 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary text-white" : "bg-background border-muted-foreground/40"}`}
                      >
                        {isSelected && <CheckSquare className="w-4 h-4" />}
                      </button>
                    )}
                  <Card
                    className={`hover-elevate transition-all duration-200 ${selectMode && isSelected ? "ring-2 ring-primary" : ""}`}
                    data-testid={`card-document-${doc.id}`}
                    onClick={selectMode ? () => setSelectedIds(prev => { const next = new Set(prev); isSelected ? next.delete(doc.id ?? "") : next.add(doc.id ?? ""); return next; }) : undefined}
                  >
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center mb-4`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate mb-1">
                            {doc.title}
                          </CardTitle>
                          <CardDescription className="text-sm line-clamp-2">
                            {!isValidContent(doc.content) ? (
                              <span className="text-destructive">{t("pages.myProjects.contentCorrupted")}</span>
                            ) : (
                              doc.topic || t("pages.myProjects.noDescription")
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabelsT[doc.type] || doc.type}
                        </Badge>
                        {doc.language && doc.language !== "en" && (
                          <Badge variant="outline" className="text-xs">
                            <Globe className="w-3 h-3 mr-1" />
                            {doc.language.toUpperCase()}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardFooter className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setViewDocumentId(doc.id)}
                        data-testid={`button-view-${doc.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {t("pages.myProjects.view")}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            {t("common.export")}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {doc.type === 'image' && (
                            <>
                              <DropdownMenuItem onClick={() => handleDownloadImage(doc, 'png')}>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.downloadPNG")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadImage(doc, 'jpeg')}>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.downloadJPEG")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadImage(doc, 'webp')}>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.downloadWEBP")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {doc.type === 'references' && (
                            <>
                              <DropdownMenuItem onClick={() => handleExportBibTeX(doc)}>
                                <FileCode className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.exportBibTeX")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportRIS(doc)}>
                                <FileCode className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.exportRIS")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportCSV(doc)}>
                                <Table className="w-4 h-4 mr-2" />
                                {t("pages.myProjects.exportCSV")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onClick={() => handleExportHTML(doc)}>
                            <FileCode className="w-4 h-4 mr-2" />
                            {t("pages.myProjects.exportHTML")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExportDOCX(doc)}>
                            <FileDown className="w-4 h-4 mr-2" />
                            {t("pages.myProjects.exportWord")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handlePrint(doc)}>
                            <Printer className="w-4 h-4 mr-2" />
                            {t("common.print")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteDocumentMutation.mutate(doc.id)}
                        disabled={deleteDocumentMutation.isPending}
                        data-testid={`button-delete-${doc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                  </div>
                );
              })}
            </div>
          )}

      {/* View Document Dialog */}
      <Dialog open={!!viewDocumentId} onOpenChange={() => setViewDocumentId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-2xl">{viewedDocument?.title}</DialogTitle>
                <DialogDescription>
                  {viewedDocument?.topic && <span className="text-sm">{viewedDocument.topic}</span>}
                  {viewedDocument?.createdAt && formatDate(viewedDocument.createdAt) && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {t("pages.myProjects.created")} {formatDate(viewedDocument.createdAt)}
                    </span>
                  )}
                </DialogDescription>
              </div>
              {/* TTS Controls */}
              {viewedDocument && (
                <DocumentTTSControls
                  status={tts.status}
                  progress={tts.progress}
                  onPlay={() => {
                    const content = getDocumentTextContent(viewedDocument);
                    // Always wrap content in an object with html property for TTS to process
                    tts.play({ html: content });
                  }}
                  onPause={tts.pause}
                  onResume={tts.resume}
                  onStop={tts.stop}
                  onRestart={tts.restart}
                  disabled={!viewedDocument?.content}
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
            </div>
          </DialogHeader>
          <div className="prose prose-sm max-w-none dark:prose-invert mt-4">
            {viewedDocument?.content && !isValidContent(viewedDocument.content) ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-lg font-medium mb-2">{t("pages.myProjects.docCorruptedTitle")}</p>
                <p className="text-sm">{t("pages.myProjects.docCorruptedDesc")}</p>
              </div>
            ) : viewedDocument?.content && (
              <>
                {typeof viewedDocument.content === 'string' ? (
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(viewedDocument.content)) }} />
                ) : viewedDocument.content.imageUrl ? (
                  <>
                    {/* Handle AI-generated images */}
                    <div className="flex flex-col items-center gap-4">
                      <img
                        src={viewedDocument.content.imageUrl}
                        alt={viewedDocument.content.prompt || viewedDocument.title}
                        className="w-full h-auto rounded border"
                      />
                      {viewedDocument.content.prompt && (
                        <p className="text-center text-muted-foreground italic">
                          {viewedDocument.content.prompt}
                        </p>
                      )}
                    </div>
                  </>
                ) : viewedDocument.content.slides ? (
                  <>
                    {/* Handle PowerPoint slides */}
                    {viewedDocument.content.slides.map((slide: any, index: number) => (
                      <div key={index} className="mb-8 p-6 border rounded-lg bg-card">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="secondary">{t("pages.myProjects.slideN", { n: index + 1 })}</Badge>
                          <h2 className="text-xl font-bold flex-1">{slide.title || ''}</h2>
                        </div>
                        {slide.imgData && (
                          <div className="mb-4">
                            <img
                              src={slide.imgData}
                              alt={slide.title || t("pages.myProjects.slideImageAlt")}
                              className="w-full h-auto rounded border"
                            />
                          </div>
                        )}
                        {Array.isArray(slide.content) && slide.content.length > 0 && (
                          <div className="mb-4 space-y-2">
                            {slide.content.map((item: string, i: number) => (
                              <p key={i} className="ml-4">• {item}</p>
                            ))}
                          </div>
                        )}
                        {slide.speakerNotes && (
                          <div className="mt-4 p-4 bg-muted/50 rounded border-l-4 border-primary">
                            <p className="text-sm font-semibold mb-2">{t("pages.myProjects.speakerNotes")}</p>
                            <p className="text-sm">{slide.speakerNotes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                ) : viewedDocument.content.html && viewedDocument.content.references ? (
                  <>
                    {/* Handle Reference Library */}
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        {t("pages.myProjects.citationStyle")} <Badge variant="outline">{viewedDocument.content.citationStyle?.toUpperCase() || 'APA'}</Badge>
                        <span className="ml-4">{t("pages.myProjects.referenceCount", { count: viewedDocument.content.references.length })}</span>
                      </p>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewedDocument.content.html) }} />
                  </>
                ) : viewedDocument.content.type === 'html' && viewedDocument.content.html ? (
                  <>
                    {/* Handle Conference Papers (IEEE HTML format) */}
                    <div
                      className="ieee-paper-preview"
                      style={{
                        fontFamily: "'Times New Roman', serif",
                        fontSize: '10pt',
                        lineHeight: '1.5'
                      }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewedDocument.content.html) }}
                    />
                  </>
                ) : (
                  <>
                    {/* Handle sections (reports, thesis, conference papers) */}
                    {viewedDocument.content.abstract && (
                      <div className="bg-muted/50 p-4 rounded-lg mb-6">
                        <h3 className="text-lg font-semibold mb-2">{t("pages.myProjects.abstract")}</h3>
                        <p>{viewedDocument.content.abstract}</p>
                      </div>
                    )}
                    {viewedDocument.content.sections?.map((section: any, index: number) => (
                      <div key={index} className="mb-6">
                        <h2 className="text-xl font-bold mb-3">{section.heading || section.title}</h2>
                        {section.imageUrl && (
                          <div className="mb-4">
                            <img
                              src={section.imageUrl}
                              alt={section.image_caption || section.heading || section.title}
                              className="w-full h-auto rounded border"
                            />
                            {section.image_caption && (
                              <p className="text-center text-sm italic text-muted-foreground mt-2">
                                {section.image_caption}
                              </p>
                            )}
                          </div>
                        )}
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(parseMarkdownToHtml(section.content || "")) }} />
                      </div>
                    ))}
                    {viewedDocument.content.references && viewedDocument.content.references.length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-3">{t("pages.myProjects.references")}</h3>
                        <ol className="list-decimal pl-6 space-y-1">
                          {viewedDocument.content.references.map((ref: string, index: number) => (
                            <li key={index} className="text-sm">{ref}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
