import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { BookOpen, Plus, Search, Trash2, Edit2, Link as LinkIcon, Copy, FileText, Globe, Tag, Download, FileCode, Upload, Loader2, Sparkles, Printer, FileOutput, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { getFirebaseDb, saveDocument } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, Timestamp } from "firebase/firestore";
import type { Reference } from "@shared/schema";
import { CITATION_STYLES } from "@shared/schema";

const referenceTypes = [
  { value: "article", label: "Journal Article" },
  { value: "book", label: "Book" },
  { value: "conference", label: "Conference Paper" },
  { value: "website", label: "Website" },
  { value: "thesis", label: "Thesis/Dissertation" },
  { value: "report", label: "Technical Report" },
  { value: "other", label: "Other" },
];

export default function References() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string>("apa");
  const [references, setReferences] = useState<any[]>([]);
  const [newReference, setNewReference] = useState({
    title: "",
    authors: "",
    year: "",
    source: "",
    url: "",
    doi: "",
    type: "article",
    notes: "",
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState("");
  const [importTab, setImportTab] = useState<"manual" | "url" | "doi" | "bibtex">("manual");
  const [urlInput, setUrlInput] = useState("");
  const [doiInput, setDoiInput] = useState("");
  const [isUrlFetching, setIsUrlFetching] = useState(false);
  const [isDoiFetching, setIsDoiFetching] = useState(false);
  const [isSavingToProjects, setIsSavingToProjects] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const { data: referencesData, isLoading } = useQuery({
    queryKey: ["references", user?.uid],
    queryFn: async () => {
      const db = getFirebaseDb();
      if (!db || !user?.uid) return [];

      const refsRef = collection(db, "references");
      // Query without orderBy to avoid index requirement, sort client-side
      const q = query(refsRef, where("userId", "==", user.uid));
      const querySnapshot = await getDocs(q);

      const refs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Sort by createdAt descending (newest first)
      return refs.sort((a: any, b: any) => {
        const aTime = parseInt(a.createdAt || "0", 10);
        const bTime = parseInt(b.createdAt || "0", 10);
        return bTime - aTime;
      });
    },
    enabled: isAuthenticated && !!user?.uid,
  });

  useEffect(() => {
    if (referencesData) {
      setReferences(referencesData);
    }
  }, [referencesData]);

  const createReferenceMutation = useMutation({
    mutationFn: async (data: typeof newReference) => {
      const db = getFirebaseDb();
      if (!db || !user?.uid) throw new Error("Not authenticated");

      const refData = {
        ...data,
        userId: user.uid,
        createdAt: Timestamp.now().toMillis().toString(),
        updatedAt: Timestamp.now().toMillis().toString(),
      };

      const docRef = await addDoc(collection(db, "references"), refData);
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references", user?.uid] });
      setIsAddDialogOpen(false);
      setNewReference({
        title: "",
        authors: "",
        year: "",
        source: "",
        url: "",
        doi: "",
        type: "article",
        notes: "",
        tags: [],
      });
      toast({
        title: "Reference Added",
        description: "Your reference has been saved to the library",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add reference",
        variant: "destructive",
      });
    },
  });

  const deleteReferenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const db = getFirebaseDb();
      if (!db) throw new Error("Firebase not initialized");

      const refDoc = doc(db, "references", id);
      await deleteDoc(refDoc);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["references", user?.uid] });
      toast({
        title: "Reference Deleted",
        description: "Reference has been removed from your library",
      });
    },
  });

  // Format citation client-side
  const formatCitation = (ref: Reference, style: string): string => {
    const authors = ref.authors || "Unknown Author";
    const year = ref.year || "n.d.";
    const title = ref.title || "Untitled";
    const source = ref.source || "";
    const url = ref.url || "";

    switch (style.toLowerCase()) {
      case "apa":
        return `${authors} (${year}). ${title}.${source ? ` ${source}.` : ""}${url ? ` Retrieved from ${url}` : ""}`;
      case "mla":
        return `${authors}. "${title}."${source ? ` ${source},` : ""} ${year}.${url ? ` ${url}.` : ""}`;
      case "chicago":
        return `${authors}. "${title}."${source ? ` ${source}` : ""} (${year}).${url ? ` ${url}.` : ""}`;
      case "harvard":
        return `${authors} (${year}) '${title}',${source ? ` ${source}.` : ""}${url ? ` Available at: ${url}` : ""}`;
      case "ieee":
        return `${authors}, "${title},"${source ? ` ${source},` : ""} ${year}.${url ? ` [Online]. Available: ${url}` : ""}`;
      default:
        return `${authors} (${year}). ${title}.${source ? ` ${source}.` : ""}`;
    }
  };

  const formatCitationMutation = useMutation({
    mutationFn: async ({ referenceId, style }: { referenceId: string; style: string }) => {
      const ref = references.find((r: Reference) => String(r.id) === referenceId);
      if (!ref) throw new Error("Reference not found");
      const formatted = formatCitation(ref, style);
      return { citation: { formatted } };
    },
    onSuccess: (data) => {
      if (data.citation?.formatted) {
        navigator.clipboard.writeText(data.citation.formatted);
        toast({
          title: "Citation Copied",
          description: `${selectedStyle.toUpperCase()} citation copied to clipboard`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to format citation",
        variant: "destructive",
      });
    },
  });

  const filteredReferences = references.filter((ref: Reference) =>
    ref.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.authors?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const addTag = () => {
    if (tagInput.trim() && !newReference.tags.includes(tagInput.trim())) {
      setNewReference({ ...newReference, tags: [...newReference.tags, tagInput.trim()] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setNewReference({ ...newReference, tags: newReference.tags.filter(t => t !== tag) });
  };

  // Smart Import Functions
  const fetchFromUrl = async () => {
    if (!urlInput.trim()) {
      toast({
        title: "URL Required",
        description: "Please enter a URL to fetch metadata from",
        variant: "destructive",
      });
      return;
    }

    setIsUrlFetching(true);
    try {
      const response = await fetch("/api/references/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await response.json();

      if (data.success && data.metadata) {
        setNewReference({
          ...newReference,
          title: data.metadata.title || newReference.title,
          authors: data.metadata.authors || newReference.authors,
          year: data.metadata.year || newReference.year,
          source: data.metadata.source || newReference.source,
          url: data.metadata.url || urlInput.trim(),
          doi: data.metadata.doi || newReference.doi,
          type: data.metadata.type || "website",
          notes: data.metadata.notes || newReference.notes,
        });
        setImportTab("manual");
        toast({
          title: "Metadata Fetched",
          description: "Reference details filled from URL. Review and save.",
        });
      } else {
        toast({
          title: "Fetch Failed",
          description: data.error || "Could not extract metadata from this URL",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("URL fetch error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to fetch URL metadata. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUrlFetching(false);
    }
  };

  const fetchFromDoi = async () => {
    if (!doiInput.trim()) {
      toast({
        title: "DOI Required",
        description: "Please enter a DOI to fetch metadata from",
        variant: "destructive",
      });
      return;
    }

    setIsDoiFetching(true);
    try {
      const response = await fetch("/api/references/fetch-doi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: doiInput.trim() }),
      });

      const data = await response.json();

      if (data.success && data.metadata) {
        setNewReference({
          ...newReference,
          title: data.metadata.title || newReference.title,
          authors: data.metadata.authors || newReference.authors,
          year: data.metadata.year || newReference.year,
          source: data.metadata.source || newReference.source,
          url: data.metadata.url || newReference.url,
          doi: data.metadata.doi || doiInput.trim(),
          type: data.metadata.type || "article",
          notes: data.metadata.notes || newReference.notes,
        });
        setImportTab("manual");
        toast({
          title: "Metadata Fetched",
          description: "Reference details filled from DOI. Review and save.",
        });
      } else {
        toast({
          title: "Fetch Failed",
          description: data.error || "Could not find metadata for this DOI",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch DOI metadata. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDoiFetching(false);
    }
  };

  const parseBibTeX = (bibtex: string): Array<typeof newReference> => {
    const entries: Array<typeof newReference> = [];
    // Match BibTeX entries like @article{key, ... }
    const entryRegex = /@(\w+)\s*\{([^,]*),([^@]*)\}/g;
    let match;

    while ((match = entryRegex.exec(bibtex)) !== null) {
      const type = match[1].toLowerCase();
      const content = match[3];

      const entry: typeof newReference = {
        title: "",
        authors: "",
        year: "",
        source: "",
        url: "",
        doi: "",
        type: type === "article" ? "article" :
              type === "book" ? "book" :
              type === "inproceedings" || type === "conference" ? "conference" :
              type === "phdthesis" || type === "mastersthesis" ? "thesis" :
              type === "techreport" ? "report" :
              type === "misc" || type === "online" ? "website" : "other",
        notes: "",
        tags: [],
      };

      // Parse fields
      const fieldRegex = /(\w+)\s*=\s*[{"]([^}"]*)[}"]/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(content)) !== null) {
        const field = fieldMatch[1].toLowerCase();
        const value = fieldMatch[2].trim();

        switch (field) {
          case "title": entry.title = value; break;
          case "author": entry.authors = value.replace(/ and /g, ", "); break;
          case "year": entry.year = value; break;
          case "journal": case "booktitle": entry.source = value; break;
          case "url": entry.url = value; break;
          case "doi": entry.doi = value; break;
          case "abstract": case "note": entry.notes = value; break;
        }
      }

      if (entry.title) {
        entries.push(entry);
      }
    }

    return entries;
  };

  const handleBibTeXUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const entries = parseBibTeX(text);

      if (entries.length === 0) {
        toast({
          title: "No entries found",
          description: "Could not parse any valid BibTeX entries from the file",
          variant: "destructive",
        });
        return;
      }

      if (entries.length === 1) {
        // Single entry - fill the form
        setNewReference(entries[0]);
        setImportTab("manual");
        toast({
          title: "BibTeX Imported",
          description: "Reference details filled. Review and save.",
        });
      } else {
        // Multiple entries - import all
        let successCount = 0;
        for (const entry of entries) {
          try {
            await createReferenceMutation.mutateAsync(entry);
            successCount++;
          } catch {
            // Continue with next entry
          }
        }
        toast({
          title: "BibTeX Imported",
          description: `Successfully imported ${successCount} of ${entries.length} references`,
        });
        setIsAddDialogOpen(false);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to read BibTeX file",
        variant: "destructive",
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Export functions
  const exportToBibTeX = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to export",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    let bibtex = "";
    filteredReferences.forEach((ref: Reference) => {
      const key = `${ref.authors?.split(',')[0]?.trim() || 'unknown'}${ref.year || 'n.d.'}`;
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

    toast({
      title: "Export successful",
      description: `Exported ${filteredReferences.length} reference(s) to BibTeX`,
    });
  };

  const exportToRIS = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to export",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    let ris = "";
    filteredReferences.forEach((ref: Reference) => {
      const typeMap: Record<string, string> = {
        article: "JOUR",
        book: "BOOK",
        conference: "CONF",
        website: "ELEC",
        thesis: "THES",
        report: "RPRT",
      };
      ris += `TY  - ${typeMap[ref.type || ""] || "GEN"}\n`;
      if (ref.title) ris += `TI  - ${ref.title}\n`;
      if (ref.authors) {
        ref.authors.split(',').forEach(author => {
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

    toast({
      title: "Export successful",
      description: `Exported ${filteredReferences.length} reference(s) to RIS`,
    });
  };

  const exportToCSV = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to export",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    const headers = ["Title", "Authors", "Year", "Type", "Source", "URL", "DOI", "Notes", "Tags"];
    const rows = filteredReferences.map((ref: Reference) => [
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
      ...rows.map(row => row.map(cell => `"${cell}"`).join(",")),
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

    toast({
      title: "Export successful",
      description: `Exported ${filteredReferences.length} reference(s) to CSV`,
    });
  };

  const exportToWord = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to export",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    // Generate DOCX content using XML format
    const docxHeader = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
<w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Reference Library</w:t></w:r></w:p>
<w:p><w:r><w:t>Exported on ${new Date().toLocaleDateString()}</w:t></w:r></w:p>
<w:p><w:r><w:t></w:t></w:r></w:p>`;

    let docxBody = "";
    filteredReferences.forEach((ref: Reference, index: number) => {
      const citation = formatCitation(ref, selectedStyle);
      docxBody += `<w:p><w:r><w:t>${index + 1}. ${citation.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</w:t></w:r></w:p>`;
      if (ref.notes) {
        docxBody += `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t>Notes: ${ref.notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</w:t></w:r></w:p>`;
      }
      docxBody += `<w:p><w:r><w:t></w:t></w:r></w:p>`;
    });

    const docxFooter = `</w:body></w:wordDocument>`;
    const docxContent = docxHeader + docxBody + docxFooter;

    const blob = new Blob([docxContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references_${new Date().toISOString().split('T')[0]}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${filteredReferences.length} reference(s) to Word`,
    });
  };

  const exportToHTML = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to export",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reference Library Export</title>
  <style>
    body { font-family: 'Georgia', serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
    .reference { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-left: 4px solid #007acc; }
    .reference-number { font-weight: bold; color: #007acc; }
    .reference-type { display: inline-block; padding: 2px 8px; background: #e0e0e0; border-radius: 4px; font-size: 0.8em; margin-left: 10px; }
    .citation { margin: 10px 0; }
    .notes { font-style: italic; color: #555; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ccc; }
    .tags { margin-top: 10px; }
    .tag { display: inline-block; padding: 2px 8px; background: #007acc; color: white; border-radius: 12px; font-size: 0.75em; margin-right: 5px; }
  </style>
</head>
<body>
  <h1>Reference Library</h1>
  <p class="meta">Exported on ${new Date().toLocaleDateString()} | Citation Style: ${selectedStyle.toUpperCase()} | ${filteredReferences.length} reference(s)</p>
  ${filteredReferences.map((ref: Reference, index: number) => `
  <div class="reference">
    <span class="reference-number">${index + 1}.</span>
    <span class="reference-type">${ref.type || 'other'}</span>
    <div class="citation">${formatCitation(ref, selectedStyle).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    ${ref.url ? `<div><a href="${ref.url}" target="_blank">${ref.url}</a></div>` : ''}
    ${ref.notes ? `<div class="notes">Notes: ${ref.notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ''}
    ${ref.tags && ref.tags.length > 0 ? `<div class="tags">${ref.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : ''}
  </div>`).join('')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `references_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${filteredReferences.length} reference(s) to HTML`,
    });
  };

  const printReferences = () => {
    if (filteredReferences.length === 0) {
      toast({
        title: "No references to print",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    const printContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reference Library - Print</title>
  <style>
    @media print {
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; margin: 1in; }
      h1 { font-size: 18pt; margin-bottom: 5pt; }
      .meta { font-size: 10pt; color: #666; margin-bottom: 20pt; }
      .reference { margin-bottom: 12pt; text-indent: -0.5in; padding-left: 0.5in; }
      .notes { font-style: italic; font-size: 10pt; margin-left: 0.5in; }
      a { color: black; text-decoration: none; }
    }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 40px; }
    h1 { font-size: 18pt; margin-bottom: 5pt; border-bottom: 1px solid #333; }
    .meta { font-size: 10pt; color: #666; margin-bottom: 20pt; }
    .reference { margin-bottom: 12pt; text-indent: -0.5in; padding-left: 0.5in; }
    .notes { font-style: italic; font-size: 10pt; margin-left: 0.5in; }
  </style>
</head>
<body>
  <h1>References</h1>
  <p class="meta">${selectedStyle.toUpperCase()} Format | ${filteredReferences.length} reference(s)</p>
  ${filteredReferences.map((ref: Reference) => `
  <div class="reference">${formatCitation(ref, selectedStyle).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  ${ref.notes ? `<div class="notes">Notes: ${ref.notes.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>` : ''}`).join('')}
</body>
</html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } else {
      toast({
        title: "Print blocked",
        description: "Please allow popups to print references",
        variant: "destructive",
      });
    }
  };

  const saveToProjects = async () => {

    if (!isAuthenticated || !user?.uid) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save references to your projects",
        variant: "destructive",
      });
      return;
    }

    if (filteredReferences.length === 0) {
      toast({
        title: "No references to save",
        description: "Add some references first",
        variant: "destructive",
      });
      return;
    }

    setIsSavingToProjects(true);
    try {
      // Generate HTML content for the reference library
      const htmlContent = `
<div class="reference-library">
  <h1>Reference Library</h1>
  <p class="meta">Citation Style: ${selectedStyle.toUpperCase()} | ${filteredReferences.length} reference(s)</p>
  <hr/>
  ${filteredReferences.map((ref: Reference, index: number) => `
  <div class="reference" style="margin-bottom: 16px;">
    <p><strong>${index + 1}.</strong> ${formatCitation(ref, selectedStyle)}</p>
    ${ref.url ? `<p style="font-size: 0.9em;"><a href="${ref.url}">${ref.url}</a></p>` : ''}
    ${ref.notes ? `<p style="font-style: italic; color: #666;">Notes: ${ref.notes}</p>` : ''}
    ${ref.tags && ref.tags.length > 0 ? `<p style="font-size: 0.85em;">Tags: ${ref.tags.join(', ')}</p>` : ''}
  </div>`).join('')}
</div>`;

      const docId = await saveDocument({
        type: "references",
        title: `Reference Library (${filteredReferences.length} refs)`,
        topic: `Reference collection with ${filteredReferences.length} sources in ${selectedStyle.toUpperCase()} format`,
        content: {
          html: htmlContent,
          references: filteredReferences,
          citationStyle: selectedStyle,
          exportDate: new Date().toISOString(),
        },
        settings: {
          citationStyle: selectedStyle,
          referenceCount: filteredReferences.length,
        },
      });

      queryClient.invalidateQueries({ queryKey: ["documents", user.uid] });

      toast({
        title: "Saved to Projects",
        description: `Reference library with ${filteredReferences.length} references saved successfully. View it in My Projects.`,
      });
    } catch (error: any) {
      console.error("=== SAVE TO PROJECTS ERROR ===");
      console.error("Error:", error);
      console.error("Error message:", error?.message);
      console.error("Error code:", error?.code);
      toast({
        title: "Save Failed",
        description: error?.message || "Failed to save reference library to projects",
        variant: "destructive",
      });
    } finally {
      setIsSavingToProjects(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="page-references">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Reference Library</h1>
            <p className="text-muted-foreground">
              Store and manage your research sources for easy citation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-export-references">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToBibTeX}>
                  <FileCode className="w-4 h-4 mr-2" />
                  Export as BibTeX
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToRIS}>
                  <FileCode className="w-4 h-4 mr-2" />
                  Export as RIS
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToWord}>
                  <FileOutput className="w-4 h-4 mr-2" />
                  Export as Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToHTML}>
                  <Globe className="w-4 h-4 mr-2" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={printReferences}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print References
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={saveToProjects}
              disabled={isSavingToProjects || filteredReferences.length === 0}
              data-testid="button-save-to-projects"
            >
              {isSavingToProjects ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save to Projects
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-reference">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Reference
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Reference</DialogTitle>
                <DialogDescription>
                  Import from URL, DOI, BibTeX or enter details manually
                </DialogDescription>
              </DialogHeader>

              <Tabs value={importTab} onValueChange={(v) => setImportTab(v as typeof importTab)} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="url" className="text-xs sm:text-sm">
                    <Globe className="w-4 h-4 mr-1 hidden sm:inline" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="doi" className="text-xs sm:text-sm">
                    <LinkIcon className="w-4 h-4 mr-1 hidden sm:inline" />
                    DOI
                  </TabsTrigger>
                  <TabsTrigger value="bibtex" className="text-xs sm:text-sm">
                    <FileCode className="w-4 h-4 mr-1 hidden sm:inline" />
                    BibTeX
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="text-xs sm:text-sm">
                    <Edit2 className="w-4 h-4 mr-1 hidden sm:inline" />
                    Manual
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="url" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Paste a URL to auto-fetch metadata</Label>
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="https://example.com/article..."
                        onKeyDown={(e) => e.key === "Enter" && fetchFromUrl()}
                      />
                      <Button onClick={fetchFromUrl} disabled={isUrlFetching}>
                        {isUrlFetching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Fetch</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Works with news articles, blog posts, research papers, and most websites
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="doi" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Enter a DOI to fetch from CrossRef</Label>
                    <div className="flex gap-2">
                      <Input
                        value={doiInput}
                        onChange={(e) => setDoiInput(e.target.value)}
                        placeholder="10.1000/xyz123 or https://doi.org/..."
                        onKeyDown={(e) => e.key === "Enter" && fetchFromDoi()}
                      />
                      <Button onClick={fetchFromDoi} disabled={isDoiFetching}>
                        {isDoiFetching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Fetch</span>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Best for academic papers. Fetches title, authors, year, journal, and more
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="bibtex" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Upload a BibTeX file (.bib)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".bib,.bibtex,text/plain"
                      onChange={handleBibTeXUpload}
                      className="hidden"
                    />
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">Click to upload BibTeX file</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Single entry fills the form, multiple entries import directly
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="manual" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={newReference.title}
                        onChange={(e) => setNewReference({ ...newReference, title: e.target.value })}
                        placeholder="Enter the title of the work"
                        data-testid="input-reference-title"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="authors">Authors</Label>
                        <Input
                          id="authors"
                          value={newReference.authors}
                          onChange={(e) => setNewReference({ ...newReference, authors: e.target.value })}
                          placeholder="e.g., Smith, J., Doe, A."
                          data-testid="input-reference-authors"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="year">Year</Label>
                        <Input
                          id="year"
                          value={newReference.year}
                          onChange={(e) => setNewReference({ ...newReference, year: e.target.value })}
                          placeholder="e.g., 2024"
                          data-testid="input-reference-year"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="type">Type</Label>
                        <Select value={newReference.type} onValueChange={(v) => setNewReference({ ...newReference, type: v })}>
                          <SelectTrigger data-testid="select-reference-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {referenceTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="source">Source/Journal</Label>
                        <Input
                          id="source"
                          value={newReference.source}
                          onChange={(e) => setNewReference({ ...newReference, source: e.target.value })}
                          placeholder="e.g., Nature, IEEE"
                          data-testid="input-reference-source"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="url">URL</Label>
                        <Input
                          id="url"
                          value={newReference.url}
                          onChange={(e) => setNewReference({ ...newReference, url: e.target.value })}
                          placeholder="https://..."
                          data-testid="input-reference-url"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="doi">DOI</Label>
                        <Input
                          id="doi"
                          value={newReference.doi}
                          onChange={(e) => setNewReference({ ...newReference, doi: e.target.value })}
                          placeholder="10.1000/xyz123"
                          data-testid="input-reference-doi"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newReference.notes}
                        onChange={(e) => setNewReference({ ...newReference, notes: e.target.value })}
                        placeholder="Add any notes about this reference..."
                        rows={3}
                        data-testid="input-reference-notes"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Tags</Label>
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                          placeholder="Add a tag..."
                          data-testid="input-reference-tag"
                        />
                        <Button type="button" variant="outline" onClick={addTag}>
                          Add
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newReference.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                            {tag} ×
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                {importTab === "manual" && (
                  <Button
                    onClick={() => createReferenceMutation.mutate(newReference)}
                    disabled={!newReference.title || createReferenceMutation.isPending}
                    data-testid="button-save-reference"
                  >
                    Save Reference
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search references..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-references"
            />
          </div>
          <Select value={selectedStyle} onValueChange={setSelectedStyle}>
            <SelectTrigger className="w-40" data-testid="select-citation-style">
              <SelectValue placeholder="Citation style" />
            </SelectTrigger>
            <SelectContent>
              {CITATION_STYLES.map((style) => (
                <SelectItem key={style} value={style}>
                  {style.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredReferences.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? "No references found" : "No references yet"}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Add your first reference to start building your library"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-reference">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Reference
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredReferences.map((ref: Reference) => (
            <Card key={ref.id} className="hover-elevate" data-testid={`card-reference-${ref.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg line-clamp-2">{ref.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {ref.authors && <span>{ref.authors}</span>}
                      {ref.year && <span> ({ref.year})</span>}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {referenceTypes.find(t => t.value === ref.type)?.label || ref.type}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {ref.source && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4" />
                    <span className="truncate">{ref.source}</span>
                  </div>
                )}
                {ref.url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                      {ref.url}
                    </a>
                  </div>
                )}
                {ref.doi && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LinkIcon className="w-4 h-4" />
                    <span className="truncate">DOI: {ref.doi}</span>
                  </div>
                )}
                {ref.tags && ref.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {ref.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {ref.notes && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{ref.notes}</p>
                )}
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => formatCitationMutation.mutate({ referenceId: String(ref.id), style: selectedStyle })}
                  disabled={formatCitationMutation.isPending}
                  data-testid={`button-cite-${ref.id}`}
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy {selectedStyle.toUpperCase()}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteReferenceMutation.mutate(String(ref.id))}
                  disabled={deleteReferenceMutation.isPending}
                  data-testid={`button-delete-reference-${ref.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
