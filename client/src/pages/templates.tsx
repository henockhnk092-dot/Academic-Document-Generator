import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { FileText, Presentation, FileSpreadsheet, GraduationCap, Search, Star, TrendingUp, Layout, BookOpen, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const iconMap: Record<string, any> = {
  report: FileText,
  powerpoint: Presentation,
  conference: FileSpreadsheet,
  thesis: GraduationCap,
  presentation: Presentation,
  paper: FileSpreadsheet,
  essay: BookOpen,
  images: ImageIcon,
};

const categoryColors: Record<string, string> = {
  report: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  presentation: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  paper: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  thesis: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  essay: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  image: "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
};

interface TemplateData {
  id: number;
  name: string;
  description: string;
  category: string;
  type: string;
  structure: { sections?: string[]; chapters?: string[]; slides?: string[] };
  isDefault: boolean;
  usageCount: number;
  createdAt: Date;
  previewImage?: string | null;
  prompt?: string;
}

const defaultTemplates: TemplateData[] = [
  {
    id: 1,
    name: "IEEE Conference Paper",
    description: "Standard IEEE format for conference submissions with abstract, introduction, methodology, results, and conclusion sections.",
    category: "paper",
    type: "conference",
    structure: { sections: ["Abstract", "Introduction", "Related Work", "Methodology", "Results", "Discussion", "Conclusion", "References"] },
    isDefault: true,
    usageCount: 1250,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write an IEEE conference paper on machine learning applications in healthcare with abstract, introduction, related work, methodology, results, discussion, and conclusion sections.",
  },
  {
    id: 2,
    name: "Harvard Thesis",
    description: "Complete thesis structure following Harvard citation style with chapters for literature review, methodology, and findings.",
    category: "thesis",
    type: "thesis",
    structure: { chapters: ["Introduction", "Literature Review", "Methodology", "Findings", "Discussion", "Conclusion", "Bibliography"] },
    isDefault: true,
    usageCount: 890,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write a comprehensive thesis on climate change impact on coastal ecosystems with introduction, literature review, methodology, findings, discussion, and conclusion chapters.",
  },
  {
    id: 3,
    name: "Technical Report - BET Standard",
    description: "Professional technical report format following BET standards with executive summary and detailed analysis sections.",
    category: "report",
    type: "report",
    structure: { sections: ["Executive Summary", "Introduction", "Technical Analysis", "Implementation", "Results", "Recommendations", "Appendices"] },
    isDefault: true,
    usageCount: 720,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write a technical report on cybersecurity implementation in enterprise systems with executive summary, technical analysis, implementation details, and recommendations.",
  },
  {
    id: 4,
    name: "Business Presentation",
    description: "Professional presentation template with title slide, agenda, key points, data visualization, and call-to-action.",
    category: "presentation",
    type: "powerpoint",
    structure: { slides: ["Title", "Agenda", "Problem Statement", "Solution Overview", "Key Benefits", "Implementation", "Timeline", "Q&A"] },
    isDefault: true,
    usageCount: 1580,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Create a business presentation on digital transformation strategy with problem statement, solution overview, key benefits, and implementation timeline.",
  },
  {
    id: 5,
    name: "Research Proposal",
    description: "Academic research proposal template with problem statement, objectives, methodology, and timeline.",
    category: "paper",
    type: "conference",
    structure: { sections: ["Title", "Abstract", "Problem Statement", "Research Objectives", "Literature Review", "Methodology", "Timeline", "Budget", "References"] },
    isDefault: true,
    usageCount: 650,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write a research proposal on artificial intelligence in education with problem statement, research objectives, literature review, methodology, and timeline.",
  },
  {
    id: 6,
    name: "Lab Report",
    description: "Scientific lab report template with hypothesis, materials, procedure, data, and analysis sections.",
    category: "report",
    type: "report",
    structure: { sections: ["Title", "Abstract", "Introduction", "Hypothesis", "Materials", "Procedure", "Data & Observations", "Analysis", "Conclusion", "References"] },
    isDefault: true,
    usageCount: 480,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write a lab report on chemical reaction kinetics experiment with hypothesis, materials, procedure, data observations, and analysis.",
  },
  {
    id: 7,
    name: "Academic Essay",
    description: "Standard academic essay format with thesis statement, body paragraphs, and conclusion.",
    category: "essay",
    type: "report",
    structure: { sections: ["Introduction", "Thesis Statement", "Body Paragraph 1", "Body Paragraph 2", "Body Paragraph 3", "Counterargument", "Conclusion", "Works Cited"] },
    isDefault: true,
    usageCount: 920,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Write an academic essay on the impact of social media on mental health with thesis statement, supporting arguments, counterargument, and conclusion.",
  },
  {
    id: 8,
    name: "Pitch Deck",
    description: "Startup pitch deck template with problem, solution, market, business model, and ask slides.",
    category: "presentation",
    type: "powerpoint",
    structure: { slides: ["Title", "Problem", "Solution", "Product Demo", "Market Size", "Business Model", "Traction", "Team", "Financials", "The Ask"] },
    isDefault: true,
    usageCount: 1100,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Create a startup pitch deck for a sustainable food delivery platform with problem, solution, market size, business model, and funding ask.",
  },
  {
    id: 9,
    name: "Nature Photography",
    description: "Beautiful nature and landscape photography prompts for stunning outdoor scenes.",
    category: "image",
    type: "images",
    structure: {},
    isDefault: true,
    usageCount: 850,
    createdAt: new Date(),
    previewImage: null,
    prompt: "A breathtaking mountain landscape at golden hour with snow-capped peaks, a crystal clear alpine lake reflecting the sky, and wildflowers in the foreground, professional nature photography",
  },
  {
    id: 10,
    name: "Portrait Art",
    description: "Artistic portrait templates for character design and portrait photography.",
    category: "image",
    type: "images",
    structure: {},
    isDefault: true,
    usageCount: 920,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Professional portrait of a person with soft natural lighting, shallow depth of field, warm tones, elegant composition, studio photography",
  },
  {
    id: 11,
    name: "Fantasy Scene",
    description: "Magical and fantastical scene templates with mystical elements.",
    category: "image",
    type: "images",
    structure: {},
    isDefault: true,
    usageCount: 1200,
    createdAt: new Date(),
    previewImage: null,
    prompt: "An enchanted forest with glowing mushrooms, bioluminescent plants, fairy lights dancing among ancient trees, magical mist, fantasy digital art",
  },
  {
    id: 12,
    name: "Modern Architecture",
    description: "Contemporary architectural designs and urban photography.",
    category: "image",
    type: "images",
    structure: {},
    isDefault: true,
    usageCount: 680,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Modern minimalist architecture with clean lines, glass facades, geometric shapes, dramatic shadows, professional architectural photography",
  },
  {
    id: 13,
    name: "Abstract Art",
    description: "Abstract and creative art templates with vibrant colors and patterns.",
    category: "image",
    type: "images",
    structure: {},
    isDefault: true,
    usageCount: 750,
    createdAt: new Date(),
    previewImage: null,
    prompt: "Abstract art with flowing colors, geometric patterns, vibrant gradients, modern digital art style, visually striking composition",
  },
];

export default function Templates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const { toast } = useToast();

  const { data: templatesResponse, isLoading } = useQuery<{ templates: TemplateData[] }>({
    queryKey: ["/api/templates"],
  });

  const templates: TemplateData[] = templatesResponse?.templates?.length 
    ? templatesResponse.templates 
    : defaultTemplates;

  const useTemplateMutation = useMutation({
    mutationFn: async (templateId: number) => {
      return await apiRequest("POST", `/api/templates/${templateId}/use`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Selected",
        description: "Redirecting to generator...",
      });
    },
  });

  const filteredTemplates = templates.filter((template: TemplateData) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || template.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["all", "report", "presentation", "paper", "thesis", "essay", "image"];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl" data-testid="page-templates">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Templates Library</h1>
          <p className="text-muted-foreground">
            Choose from professionally designed templates for your academic documents
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-templates"
            />
          </div>
        </div>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-2">
          {categories.map((category) => (
            <TabsTrigger 
              key={category} 
              value={category}
              className="capitalize"
              data-testid={`tab-${category}`}
            >
              {category === "all" ? "All Templates" : category}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-10 w-10 rounded-lg mb-4" />
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Layout className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No templates found</h3>
                <p className="text-muted-foreground">
                  Try a different search term or category
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template: TemplateData) => {
                const Icon = iconMap[template.type] || FileText;

                return (
                  <Card
                    key={template.id}
                    className="hover-elevate transition-all duration-200"
                    data-testid={`card-template-${template.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg mt-3">
                        {template.name}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={categoryColors[template.category] || "bg-gray-100 text-gray-800"}>
                          {template.category}
                        </Badge>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {template.usageCount?.toLocaleString() || 0} uses
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Link
                        href={`/generate/${template.type}?template=${encodeURIComponent(template.prompt || '')}&name=${encodeURIComponent(template.name)}`}
                        className="w-full"
                      >
                        <Button
                          className="w-full"
                          onClick={() => useTemplateMutation.mutate(template.id)}
                          data-testid={`button-use-template-${template.id}`}
                        >
                          Use Template
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
