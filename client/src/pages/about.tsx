import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  FileText,
  Presentation,
  BookOpen,
  GraduationCap,
  Zap,
  Shield,
  Globe,
  ExternalLink,
  Upload,
  Cloud,
  Bot,
  FolderOpen,
  Eye,
  Smartphone,
  Image,
  FileSignature,
  Library,
  Wand2,
  BookMarked,
  Volume2
} from "lucide-react";
import { SiGithub, SiYoutube, SiTiktok } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();

  const documentTypes = [
    {
      icon: FileText,
      title: "Technical Reports",
      description: "Generate comprehensive BET-standard technical reports with proper structure, citations, and formatting.",
      exports: "HTML, Word (.docx), PDF"
    },
    {
      icon: FileSignature,
      title: "Custom Reports",
      description: "Create fully customizable reports with flexible sections, custom formatting, and structure.",
      exports: "HTML, Word (.docx), PDF"
    },
    {
      icon: Presentation,
      title: "PowerPoint Presentations",
      description: "Create professional slide decks with speaker notes, visual prompts, and TTS coaching support.",
      exports: "HTML, PowerPoint (.pptx), PDF"
    },
    {
      icon: BookOpen,
      title: "Conference Papers",
      description: "Produce IEEE-formatted conference papers with two-column layout and academic citations.",
      exports: "HTML (IEEE), Word (.docx), PDF"
    },
    {
      icon: GraduationCap,
      title: "Thesis & Dissertations",
      description: "Generate Harvard-style thesis documents with front matter, chapters, and bibliography.",
      exports: "HTML (Harvard), Word (.docx), PDF"
    },
    {
      icon: Image,
      title: "AI Image Generator",
      description: "Create stunning AI-generated images from text descriptions using free pollinations.ai service.",
      exports: "PNG, JPEG, WEBP"
    },
    {
      icon: Library,
      title: "Reference Library",
      description: "Manage citations with smart import from URLs, DOIs, and BibTeX. Export in multiple citation styles.",
      exports: "BibTeX, RIS, CSV, Word, HTML"
    },
    {
      icon: Wand2,
      title: "AI Humanizer",
      description: "Humanize AI-generated text to bypass detection tools (GPTZero, Turnitin, Originality.ai) with per-sentence AI scoring.",
      exports: "TXT, HTML, Detection Report"
    },
    {
      icon: BookMarked,
      title: "Citation Checker",
      description: "Scan documents for fake, incorrect, or misformatted citations. Supports IEEE, APA, Harvard, MLA, Chicago, and Vancouver.",
      exports: "TXT Report, References List"
    }
  ];

  const platformFeatures = [
    {
      icon: Upload,
      title: "File Upload Support",
      description: "Upload PDF, DOCX, TXT files or images to extract content and use as context for generation."
    },
    {
      icon: Cloud,
      title: "Cloud Save",
      description: "Save your projects to Firebase cloud storage and access them from anywhere."
    },
    {
      icon: Bot,
      title: "AI Chatbot Assistant",
      description: "Get help navigating the platform with our built-in AI chatbot powered by Gemini."
    },
    {
      icon: FolderOpen,
      title: "Project Management",
      description: "Organize and manage all your generated documents in one place with the Projects page."
    },
    {
      icon: Eye,
      title: "Real-time Preview",
      description: "See your document being generated in real-time with live preview as content is created."
    },
    {
      icon: Smartphone,
      title: "Fully Responsive",
      description: "Works seamlessly on all devices from mobile phones (320px) to ultra-wide monitors."
    }
  ];

  const capabilities = [
    { icon: Zap, text: "AI-Powered Content Generation (Gemini 2.5 Flash)" },
    { icon: Image, text: "Free AI Image Generation" },
    { icon: Library, text: "Reference Library with URL/DOI Import" },
    { icon: Shield, text: "6 Citation Styles (APA, MLA, Chicago, Harvard, IEEE, Vancouver)" },
    { icon: Globe, text: "Multi-Format Export (HTML, DOCX, PPTX, PDF, BibTeX)" },
    { icon: Upload, text: "File Upload Processing (PDF, DOCX, TXT, Images)" },
    { icon: Cloud, text: "Firebase Cloud Storage" },
    { icon: Bot, text: "AI Chatbot Assistant" },
    { icon: Wand2, text: "AI Text Humanizer with Per-Sentence Detection" },
    { icon: BookMarked, text: "Citation Checker with Fake Reference Detection" },
    { icon: Volume2, text: "Azure Neural HD Text-to-Speech on All Tools" },
  ];

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto" data-testid="page-about">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("pages.about.title")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t("pages.about.tagline")}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          {capabilities.map((cap, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
              <cap.icon className="h-3.5 w-3.5" />
              {cap.text}
            </Badge>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("pages.about.docGenerators")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {documentTypes.map((doc, index) => (
                <div key={index} className="p-4 border rounded-lg hover-elevate" data-testid={`card-doctype-${index}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <doc.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-medium">{doc.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                  <p className="text-xs text-muted-foreground"><span className="font-medium">Exports:</span> {doc.exports}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("pages.about.platformFeatures")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {platformFeatures.map((feature, index) => (
                <div key={index} className="p-4 border rounded-lg hover-elevate" data-testid={`card-feature-${index}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium text-sm">{feature.title}</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("pages.about.techStack")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <h4 className="font-medium mb-2">AI & Generation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Google Gemini 2.5 Flash</li>
                  <li>Pollinations.ai (Free AI Images)</li>
                  <li>Pixabay API (Fallback)</li>
                  <li>KaTeX for LaTeX rendering</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Export Formats</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>HTML (IEEE/Harvard styles)</li>
                  <li>Microsoft Word (DOCX)</li>
                  <li>PowerPoint (PPTX)</li>
                  <li>PDF Document</li>
                  <li>Images (PNG, JPEG, WEBP)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Backend & Storage</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>Firebase Authentication</li>
                  <li>Firebase Firestore</li>
                  <li>Express.js API</li>
                  <li>React + TypeScript</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("pages.about.aboutAuthor")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t("pages.about.authorBio")}
            </p>
            <div className="flex items-center gap-4 flex-wrap pt-2">
              <Button variant="outline" asChild data-testid="link-github-repo">
                <a
                  href="https://github.com/henockhnk092-dot/Academic-Document-Generator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <SiGithub className="h-4 w-4" />
                  View on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="link-twitter">
                <a
                  href="https://twitter.com/HnkHorizon"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <FaXTwitter className="h-4 w-4" />
                  @HnkHorizon
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="link-youtube">
                <a
                  href="https://youtube.com/@HNK2005"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <SiYoutube className="h-4 w-4" />
                  @HNK2005
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="link-tiktok">
                <a
                  href="https://tiktok.com/@codingfever"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <SiTiktok className="h-4 w-4" />
                  @codingfever
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="privacy">
          <CardHeader>
            <CardTitle>{t("pages.about.privacyTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">Privacy Policy</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  AcademicGen respects your privacy. We collect minimal data necessary to provide our services:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>Account Data:</strong> Email address when you sign in with Google (used for authentication only)</li>
                  <li><strong>Usage Data:</strong> Generation count to enforce free tier limits</li>
                  <li><strong>Analytics:</strong> Anonymous usage statistics via Google Analytics to improve the service</li>
                </ul>
                <p>
                  We do <strong>not</strong> store your generated documents on our servers. All content is generated in real-time and delivered directly to you.
                  Your uploaded files are processed temporarily and deleted immediately after use.
                </p>
                <p>
                  We use cookies for authentication and analytics. By using this service, you consent to our use of cookies.
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Terms of Service</h4>
              <div className="text-sm text-muted-foreground space-y-2">
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>AcademicGen is provided "as is" without warranties of any kind</li>
                  <li>You are responsible for the content you generate and how you use it</li>
                  <li>Generated content should be reviewed for accuracy before submission</li>
                  <li>Do not use this service to generate content that violates academic integrity policies</li>
                  <li>We reserve the right to modify or discontinue the service at any time</li>
                  <li>Free tier limits may change without notice</li>
                </ul>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Contact</h4>
              <p className="text-sm text-muted-foreground">
                For privacy concerns or questions, please use the <a href="/contact" className="text-primary hover:underline">Contact page</a> or
                reach out via the social links above.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>{t("pages.about.poweredBy")}</p>
          <p>Version 2.0.0</p>
          <p className="mt-2">
            <a
              href="https://academicgen.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              academicgen.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
