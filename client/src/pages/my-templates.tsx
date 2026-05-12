import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  FileText, Presentation, FileSpreadsheet, GraduationCap, Plus, Trash2,
  Edit2, Copy, BookOpen, Image as ImageIcon, Search, Wand2, X, Save,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  generatorType: string;
  prompt: string;
  tone?: string;
  citationStyle?: string;
  targetLength?: string;
  createdAt: number;
  usageCount: number;
}

const STORAGE_KEY = "academicgen_custom_templates";

const CATEGORIES = ["report", "presentation", "paper", "thesis", "essay", "image", "custom"];
const TONES = ["academic", "professional", "essay", "creative"];
const CITATION_STYLES = ["auto", "ieee", "harvard", "apa", "mla", "chicago"];
const LENGTHS = ["auto", "2-5", "6-10", "11-20", "20+"];

const categoryColors: Record<string, string> = {
  report:       "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  presentation: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  paper:        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  thesis:       "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  essay:        "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  image:        "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
  custom:       "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
};

function loadTemplates(): CustomTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveTemplates(templates: CustomTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

const emptyForm = (): Omit<CustomTemplate, "id" | "createdAt" | "usageCount"> => ({
  name: "",
  description: "",
  category: "custom",
  generatorType: "report",
  prompt: "",
  tone: "academic",
  citationStyle: "auto",
  targetLength: "auto",
});

export default function MyTemplates() {
  const { t } = useTranslation();

  const GENERATOR_TYPES = [
    { value: "report",        label: t("pages.myTemplates.genTypeReport"),        icon: FileText },
    { value: "custom-report", label: t("pages.myTemplates.genTypeCustomReport"),  icon: FileText },
    { value: "powerpoint",    label: t("pages.myTemplates.genTypePowerPoint"),    icon: Presentation },
    { value: "conference",    label: t("pages.myTemplates.genTypeConference"),    icon: FileSpreadsheet },
    { value: "thesis",        label: t("pages.myTemplates.genTypeThesis"),        icon: GraduationCap },
    { value: "images",        label: t("pages.myTemplates.genTypeImages"),        icon: ImageIcon },
  ];

  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const { toast } = useToast();

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const filtered = templates.filter(
    t => t.name.toLowerCase().includes(search.toLowerCase()) ||
         t.description.toLowerCase().includes(search.toLowerCase()) ||
         t.prompt.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (t: CustomTemplate) => {
    setEditingId(t.id);
    setForm({ name: t.name, description: t.description, category: t.category, generatorType: t.generatorType, prompt: t.prompt, tone: t.tone, citationStyle: t.citationStyle, targetLength: t.targetLength });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast({ title: t("pages.myTemplates.nameRequired"), variant: "destructive" }); return; }
    if (!form.prompt.trim()) { toast({ title: t("pages.myTemplates.promptRequired"), variant: "destructive" }); return; }

    const updated = editingId
      ? templates.map(tmpl => tmpl.id === editingId ? { ...tmpl, ...form } : tmpl)
      : [...templates, { ...form, id: crypto.randomUUID(), createdAt: Date.now(), usageCount: 0 }];

    saveTemplates(updated);
    setTemplates(updated);
    setDialogOpen(false);
    toast({ title: editingId ? t("pages.myTemplates.templateUpdated") : t("pages.myTemplates.templateCreated"), description: form.name });
  };

  const handleDelete = (id: string) => {
    const updated = templates.filter(tmpl => tmpl.id !== id);
    saveTemplates(updated);
    setTemplates(updated);
    toast({ title: t("pages.myTemplates.templateDeleted") });
  };

  const handleDuplicate = (tmpl: CustomTemplate) => {
    const copy: CustomTemplate = { ...tmpl, id: crypto.randomUUID(), name: `${tmpl.name} (copy)`, createdAt: Date.now(), usageCount: 0 };
    const updated = [...templates, copy];
    saveTemplates(updated);
    setTemplates(updated);
    toast({ title: t("pages.myTemplates.templateDuplicated"), description: copy.name });
  };

  const handleUse = (t: CustomTemplate) => {
    const updated = templates.map(x => x.id === t.id ? { ...x, usageCount: x.usageCount + 1 } : x);
    saveTemplates(updated);
    setTemplates(updated);
    const params = new URLSearchParams({ template: t.prompt, name: t.name });
    if (t.tone) params.set("tone", t.tone);
    if (t.citationStyle) params.set("citationStyle", t.citationStyle);
    if (t.targetLength) params.set("targetLength", t.targetLength);
    window.location.href = `/generate/${t.generatorType}?${params.toString()}`;
  };

  const Icon = (type: string) => {
    const found = GENERATOR_TYPES.find(g => g.value === type);
    const Ic = found?.icon ?? FileText;
    return <Ic className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t("pages.myTemplates.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("pages.myTemplates.subtitle")}</p>
          </div>
          <Button onClick={openNew} className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90">
            <Plus className="w-4 h-4" />
            {t("pages.myTemplates.newTemplate")}
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("pages.myTemplates.searchPlaceholder")}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Empty state */}
        {templates.length === 0 && (
          <div className="text-center py-20">
            <Wand2 className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("pages.myTemplates.emptyTitle")}</h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              {t("pages.myTemplates.emptyDesc")}
            </p>
            <Button onClick={openNew} className="gap-2">
              <Plus className="w-4 h-4" />
              {t("pages.myTemplates.createFirst")}
            </Button>
          </div>
        )}

        {/* No search results */}
        {templates.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            {t("pages.myTemplates.noSearchResults")} "<strong>{search}</strong>"
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(tmpl => (
            <Card key={tmpl.id} className="hover-elevate transition-all border-card-border group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      {Icon(tmpl.generatorType)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{tmpl.name}</CardTitle>
                      <Badge className={`text-[10px] mt-0.5 ${categoryColors[tmpl.category] ?? categoryColors.custom}`}>
                        {tmpl.category}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => openEdit(tmpl)} className="p-1.5 rounded hover:bg-muted" title={t("pages.myTemplates.editTitle")}>
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDuplicate(tmpl)} className="p-1.5 rounded hover:bg-muted" title={t("pages.myTemplates.templateDuplicated")}>
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => handleDelete(tmpl.id)} className="p-1.5 rounded hover:bg-destructive/10" title={t("pages.myTemplates.templateDeleted")}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <CardDescription className="text-xs line-clamp-2 mt-2">{tmpl.description || tmpl.prompt}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1 mb-3">
                  {tmpl.tone && <Badge variant="outline" className="text-[10px]">{tmpl.tone}</Badge>}
                  {tmpl.citationStyle && tmpl.citationStyle !== "auto" && <Badge variant="outline" className="text-[10px]">{tmpl.citationStyle.toUpperCase()}</Badge>}
                  {tmpl.targetLength && tmpl.targetLength !== "auto" && <Badge variant="outline" className="text-[10px]">{tmpl.targetLength} {t("pages.myTemplates.pages")}</Badge>}
                  <Badge variant="secondary" className="text-[10px]">{tmpl.usageCount} {t("pages.templates.uses")}</Badge>
                </div>
                <Button size="sm" className="w-full" onClick={() => handleUse(tmpl)}>
                  {t("pages.myTemplates.useTemplate")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("pages.myTemplates.editTitle") : t("pages.myTemplates.newTitle")}</DialogTitle>
            <DialogDescription>
              {editingId ? t("pages.myTemplates.editDesc") : t("pages.myTemplates.newDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>{t("pages.myTemplates.nameLabel")} *</Label>
              <Input placeholder={t("pages.myTemplates.namePlaceholder")} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>{t("pages.myTemplates.descriptionLabel")}</Label>
              <Input placeholder={t("pages.myTemplates.descriptionPlaceholder")} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("pages.myTemplates.generatorTypeLabel")}</Label>
                <Select value={form.generatorType} onValueChange={v => setForm(f => ({ ...f, generatorType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GENERATOR_TYPES.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("pages.myTemplates.categoryLabel")}</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>{t("pages.myTemplates.toneLabel")}</Label>
                <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TONES.map(tone => <SelectItem key={tone} value={tone}>{tone}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("pages.myTemplates.citationStyleLabel")}</Label>
                <Select value={form.citationStyle} onValueChange={v => setForm(f => ({ ...f, citationStyle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CITATION_STYLES.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("pages.myTemplates.lengthLabel")}</Label>
                <Select value={form.targetLength} onValueChange={v => setForm(f => ({ ...f, targetLength: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LENGTHS.map(l => <SelectItem key={l} value={l}>{l === "auto" ? t("common.auto") : `${l} ${t("pages.myTemplates.pages")}`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("pages.myTemplates.promptLabel")} *</Label>
              <Textarea
                placeholder={t("pages.myTemplates.promptPlaceholder")}
                value={form.prompt}
                onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{form.prompt.length} {t("common.characters")}</p>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("pages.myTemplates.cancel")}</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                {editingId ? t("pages.myTemplates.update") : t("pages.myTemplates.saveTemplate")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
