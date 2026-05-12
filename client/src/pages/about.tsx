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
  Volume2,
  Cpu
} from "lucide-react";
import { SiGithub, SiYoutube, SiTiktok, SiLinkedin, SiInstagram } from "react-icons/si";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();

  const documentTypes = [
    { icon: FileText,     title: t("pages.about.docType1Title"), description: t("pages.about.docType1Desc"), exports: t("pages.about.docType1Exports") },
    { icon: FileSignature,title: t("pages.about.docType2Title"), description: t("pages.about.docType2Desc"), exports: t("pages.about.docType2Exports") },
    { icon: Presentation, title: t("pages.about.docType3Title"), description: t("pages.about.docType3Desc"), exports: t("pages.about.docType3Exports") },
    { icon: BookOpen,     title: t("pages.about.docType4Title"), description: t("pages.about.docType4Desc"), exports: t("pages.about.docType4Exports") },
    { icon: GraduationCap,title: t("pages.about.docType5Title"), description: t("pages.about.docType5Desc"), exports: t("pages.about.docType5Exports") },
    { icon: Image,        title: t("pages.about.docType6Title"), description: t("pages.about.docType6Desc"), exports: t("pages.about.docType6Exports") },
    { icon: Library,      title: t("pages.about.docType7Title"), description: t("pages.about.docType7Desc"), exports: t("pages.about.docType7Exports") },
    { icon: Wand2,        title: t("pages.about.docType8Title"), description: t("pages.about.docType8Desc"), exports: t("pages.about.docType8Exports") },
    { icon: BookMarked,   title: t("pages.about.docType9Title"), description: t("pages.about.docType9Desc"), exports: t("pages.about.docType9Exports") },
  ];

  const platformFeatures = [
    { icon: Upload,    title: t("pages.about.platformFeature1Title"), description: t("pages.about.platformFeature1Desc") },
    { icon: Cloud,     title: t("pages.about.platformFeature2Title"), description: t("pages.about.platformFeature2Desc") },
    { icon: Bot,       title: t("pages.about.platformFeature3Title"), description: t("pages.about.platformFeature3Desc") },
    { icon: FolderOpen,title: t("pages.about.platformFeature4Title"), description: t("pages.about.platformFeature4Desc") },
    { icon: Eye,       title: t("pages.about.platformFeature5Title"), description: t("pages.about.platformFeature5Desc") },
    { icon: Smartphone,title: t("pages.about.platformFeature6Title"), description: t("pages.about.platformFeature6Desc") },
  ];

  const capabilities = [
    { icon: Zap,       text: t("pages.about.cap1") },
    { icon: Image,     text: t("pages.about.cap2") },
    { icon: Library,   text: t("pages.about.cap3") },
    { icon: Shield,    text: t("pages.about.cap4") },
    { icon: Globe,     text: t("pages.about.cap5") },
    { icon: Upload,    text: t("pages.about.cap6") },
    { icon: Cloud,     text: t("pages.about.cap7") },
    { icon: Bot,       text: t("pages.about.cap8") },
    { icon: Wand2,     text: t("pages.about.cap9") },
    { icon: BookMarked,text: t("pages.about.cap10") },
    { icon: Volume2,   text: t("pages.about.cap11") },
  ];

  const techAI = [
    t("pages.about.techAIItem1"),
    t("pages.about.techAIItem2"),
    t("pages.about.techAIItem3"),
    t("pages.about.techAIItem4"),
  ];

  const techExports = [
    t("pages.about.techExportItem1"),
    t("pages.about.techExportItem2"),
    t("pages.about.techExportItem3"),
    t("pages.about.techExportItem4"),
    t("pages.about.techExportItem5"),
  ];

  const techBackend = [
    t("pages.about.techBackendItem1"),
    t("pages.about.techBackendItem2"),
    t("pages.about.techBackendItem3"),
    t("pages.about.techBackendItem4"),
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
                  <p className="text-xs text-muted-foreground"><span className="font-medium">{t("pages.about.exportsLabel")}</span> {doc.exports}</p>
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
                <h4 className="font-medium mb-2">{t("pages.about.techAITitle")}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {techAI.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">{t("pages.about.techExportsTitle")}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {techExports.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">{t("pages.about.techBackendTitle")}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {techBackend.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("pages.about.aboutAuthor")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Profile photo */}
              <img
                src="/images/author.jpg"
                alt="Henock Hnk"
                className="w-full sm:w-56 rounded-xl object-cover object-top border border-border shrink-0 aspect-square"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />

              {/* Content */}
              <div className="space-y-4 flex-1">
                <div>
                  <p className="font-semibold text-xl">Henock Hnk</p>
                  <p className="text-sm text-muted-foreground">{t("pages.about.authorRole")}</p>
                </div>

                <p className="text-muted-foreground leading-relaxed">
                  {t("pages.about.authorBio")}
                </p>

                <div className="p-4 border rounded-lg bg-primary/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" />
                    <span className="font-medium">{t("pages.about.authorHardwareTitle")}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.about.authorHardwareDesc")}
                  </p>
                  <Button variant="default" asChild data-testid="link-book-services">
                    <a
                      href="https://hnk-your-tech-solutions.hnk-tech.workers.dev/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {t("pages.about.bookServices")}
                    </a>
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-wrap pt-2">
                  <Button variant="outline" asChild data-testid="link-linkedin">
                    <a
                      href="https://www.linkedin.com/in/henock-mukonkole-178b26258"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <SiLinkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  </Button>
                  <Button variant="outline" asChild data-testid="link-github-repo">
                    <a
                      href="https://github.com/henockhnk092-dot/Academic-Document-Generator"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <SiGithub className="h-4 w-4" />
                      {t("pages.about.viewOnGitHub")}
                      <ExternalLink className="h-3 w-3" />
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
                  <Button variant="outline" asChild data-testid="link-instagram">
                    <a
                      href="https://instagram.com/hhnk.3693"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <SiInstagram className="h-4 w-4" />
                      @hhnk.3693
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>{t("pages.about.poweredBy")}</p>
          <p>{t("pages.about.version")}</p>
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
