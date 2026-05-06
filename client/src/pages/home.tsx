import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { FileText, Presentation, FileSpreadsheet, GraduationCap, Sparkles, Zap, Lock, Image, FileSignature, Library, Wand2, BookMarked } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/ui/feature-carousel";

const documentTypes = [
  {
    id: "report",
    title: "Technical Report",
    description: "BET-standard reports with Gantt charts, budget tables, and LaTeX equations",
    icon: FileText,
    features: ["Gantt Charts", "Budget Tables", "LaTeX Support", "BET Standards"],
    gradient: "from-blue-500 to-cyan-500",
    href: "/generate/report",
  },
  {
    id: "custom-report",
    title: "Custom Report",
    description: "Fully customizable reports with flexible sections, custom formatting, and structure",
    icon: FileSignature,
    features: ["Custom Sections", "Flexible Format", "Diagrams", "Tables"],
    gradient: "from-indigo-500 to-blue-500",
    href: "/generate/custom-report",
  },
  {
    id: "powerpoint",
    title: "PowerPoint Presentation",
    description: "Professional slides with AI structuring, speaker notes, and TTS coaching",
    icon: Presentation,
    features: ["AI Slides", "Speaker Notes", "TTS Coaching", "6x6 Rule"],
    gradient: "from-orange-500 to-red-500",
    href: "/generate/powerpoint",
  },
  {
    id: "conference",
    title: "Conference Paper",
    description: "IEEE-formatted papers with proper citations and academic structure",
    icon: FileSpreadsheet,
    features: ["IEEE Format", "Citations", "Two-Column", "References"],
    gradient: "from-purple-500 to-pink-500",
    href: "/generate/conference",
  },
  {
    id: "thesis",
    title: "Thesis/Dissertation",
    description: "Complete academic thesis with chapters, methodology, results, and Harvard citations",
    icon: GraduationCap,
    features: ["Full Chapters", "Methodology", "Results", "Harvard Citations"],
    gradient: "from-green-500 to-emerald-500",
    href: "/generate/thesis",
  },
  {
    id: "images",
    title: "AI Image Generator",
    description: "Create stunning AI-generated images from text descriptions with free pollinations.ai",
    icon: Image,
    features: ["Text-to-Image", "Multiple Sizes", "HD Quality", "Free Generation"],
    gradient: "from-violet-500 to-purple-500",
    href: "/generate/images",
  },
  {
    id: "references",
    title: "Reference Library",
    description: "Manage citations with smart import from URLs, DOIs, and BibTeX files",
    icon: Library,
    features: ["URL Import", "DOI Lookup", "Multiple Styles", "Export Options"],
    gradient: "from-amber-500 to-yellow-500",
    href: "/references",
  },
  {
    id: "humanize",
    title: "AI Humanizer",
    description: "Make AI-written text undetectable — bypass GPTZero, Turnitin, and Originality.ai with Azure HD voice",
    icon: Wand2,
    features: ["AI Detection", "Humanize Text", "Azure TTS", "Export Report"],
    gradient: "from-rose-500 to-pink-500",
    href: "/humanize",
  },
  {
    id: "citations",
    title: "Citation Checker",
    description: "Scan your document for fake, incorrect, or missing citations and get AI-validated corrections",
    icon: BookMarked,
    features: ["Fake Detection", "Auto-correct", "IEEE/APA/Harvard", "Azure TTS"],
    gradient: "from-teal-500 to-cyan-500",
    href: "/citations",
  },
];

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 max-w-7xl" data-testid="page-home">

        {/* Badge */}
        <div className="flex justify-center pt-10 pb-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>{t("home.badge")}</span>
          </div>
        </div>

        <HeroSection
          className="py-8 pb-14"
          title={
            <>
              <span className="bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {t("home.title1")}
              </span>
              <br />
              <span>{t("home.title2")}</span>
            </>
          }
          subtitle={t("home.subtitle")}
          images={[
            { src: "/images/hero-1.jpeg", alt: "Research data and academic charts on computer screens" },
            { src: "/images/hero-2.jpeg", alt: "Female student writing thesis at desk with books" },
            { src: "/images/hero-3.jpeg", alt: "Graduate student writing dissertation in academic office" },
            { src: "/images/hero-4.jpeg", alt: "Researcher presenting at international conference" },
            { src: "/images/hero-5.jpeg", alt: "Student working on laptop in university library" },
            { src: "/images/hero-6.jpeg", alt: "Grand university library interior with students studying" },
            { src: "/images/hero-7.jpeg", alt: "Young woman working on laptop in modern library" },
          ]}
          buttons={
            <>
              <Link href="/projects">
                <Button size="lg" variant="outline" className="gap-2" data-testid="button-my-projects">
                  <Lock className="w-4 h-4" />
                  {t("home.myProjects")}
                </Button>
              </Link>
              <Button
                size="lg"
                className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                data-testid="button-get-started"
                onClick={() => document.getElementById('document-types')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Zap className="w-4 h-4" />
                {t("home.getStarted")}
              </Button>
            </>
          }
        />

        <div id="document-types" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 scroll-mt-8">
          {documentTypes.map((doc) => {
            const Icon = doc.icon;
            return (
              <Link key={doc.id} href={doc.href}>
                <Card 
                  className="h-full hover-elevate transition-all duration-200 cursor-pointer border-card-border group"
                  data-testid={`card-document-${doc.id}`}
                >
                  <CardHeader className="space-y-4">
                    <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${doc.gradient} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-2">{doc.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {doc.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {doc.features.map((feature, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <Button className="w-full mt-4" variant="outline" data-testid={`button-generate-${doc.id}`}>
                      <span className="truncate">{t("common.generate")}</span>
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">9</div>
            <div className="text-sm text-muted-foreground">{t("home.stats.tools")}</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">66+</div>
            <div className="text-sm text-muted-foreground">{t("home.stats.templates")}</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">10+</div>
            <div className="text-sm text-muted-foreground">{t("home.stats.formats")}</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl font-bold text-primary">5</div>
            <div className="text-sm text-muted-foreground">{t("home.stats.citations")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
