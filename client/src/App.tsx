import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatbotWidget } from "@/components/chatbot-widget";
import { OnboardingModal } from "@/components/onboarding-modal";
import { WhatsNewBanner } from "@/components/whats-new-banner";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider } from "@/components/auth-provider";
import { UsageBanner } from "@/components/usage-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaUpdateBanner } from "@/components/pwa-update-banner";
import { CookieConsent } from "@/components/cookie-consent";
import { Skeleton } from "@/components/ui/skeleton";

const Home = lazy(() => import("@/pages/home"));
const MyProjects = lazy(() => import("@/pages/my-projects"));
const Templates = lazy(() => import("@/pages/templates"));
const MyTemplates = lazy(() => import("@/pages/my-templates"));
const References = lazy(() => import("@/pages/references"));
const AiAssistant = lazy(() => import("@/pages/ai-assistant"));
const Analytics = lazy(() => import("@/pages/analytics"));
const GenerateReport = lazy(() => import("@/pages/generate-report"));
const GeneratePowerPoint = lazy(() => import("@/pages/generate-powerpoint"));
const GenerateConference = lazy(() => import("@/pages/generate-conference"));
const GenerateThesis = lazy(() => import("@/pages/generate-thesis"));
const GenerateImages = lazy(() => import("@/pages/generate-images"));
const GenerateCustomReport = lazy(() => import("@/pages/generate-custom-report"));
const GenerateTemplateReport = lazy(() => import("@/pages/generate-template-report"));
const About = lazy(() => import("@/pages/about"));
const Contact = lazy(() => import("@/pages/contact"));
const Legal = lazy(() => import("@/pages/legal"));
const Settings = lazy(() => import("@/pages/settings"));
const Pricing = lazy(() => import("@/pages/pricing"));
const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancel = lazy(() => import("@/pages/checkout-cancel"));
const Humanize = lazy(() => import("@/pages/humanize"));
const Citations = lazy(() => import("@/pages/citations"));
const GrammarCheck = lazy(() => import("@/pages/grammar-check"));
const NotFound = lazy(() => import("@/pages/not-found"));

const PAGE_META_KEYS: Record<string, string> = {
  "/": "home",
  "/projects": "projects",
  "/templates": "templates",
  "/my-templates": "myTemplates",
  "/references": "references",
  "/ai-assistant": "aiAssistant",
  "/analytics": "analytics",
  "/generate/report": "generateReport",
  "/generate/powerpoint": "generatePowerPoint",
  "/generate/conference": "generateConference",
  "/generate/thesis": "generateThesis",
  "/generate/images": "generateImages",
  "/generate/custom-report": "generateCustomReport",
  "/generate/template-report": "generateTemplateReport",
  "/humanize": "humanize",
  "/citations": "citations",
  "/grammar-check": "grammarCheck",
  "/pricing": "pricing",
  "/about": "about",
  "/contact": "contact",
  "/legal": "legal",
  "/settings": "settings",
  "/checkout/success": "checkoutSuccess",
  "/checkout/cancel": "checkoutCancel",
};

const PAGE_CONTENT_META: Record<string, { titleKey: string; descriptionKey?: string }> = {
  "/projects": { titleKey: "pages.myProjects.title", descriptionKey: "pages.myProjects.subtitle" },
  "/templates": { titleKey: "pages.templates.title", descriptionKey: "pages.templates.subtitle" },
  "/my-templates": { titleKey: "pages.myTemplates.title", descriptionKey: "pages.myTemplates.subtitle" },
  "/references": { titleKey: "pages.references.title", descriptionKey: "pages.references.subtitle" },
  "/ai-assistant": { titleKey: "pages.aiAssistant.title", descriptionKey: "pages.aiAssistant.subtitle" },
  "/analytics": { titleKey: "pages.analytics.title", descriptionKey: "pages.analytics.subtitle" },
  "/generate/report": { titleKey: "pages.report.title", descriptionKey: "pages.report.subtitle" },
  "/generate/powerpoint": { titleKey: "pages.powerpoint.title", descriptionKey: "pages.powerpoint.subtitle" },
  "/generate/conference": { titleKey: "pages.conference.title", descriptionKey: "pages.conference.subtitle" },
  "/generate/thesis": { titleKey: "pages.thesis.title", descriptionKey: "pages.thesis.subtitle" },
  "/generate/images": { titleKey: "pages.images.title", descriptionKey: "pages.images.subtitle" },
  "/generate/custom-report": { titleKey: "pages.customReport.title", descriptionKey: "pages.customReport.subtitle" },
  "/generate/template-report": { titleKey: "pages.templateReport.title", descriptionKey: "pages.templateReport.subtitle" },
  "/humanize": { titleKey: "common.humanize", descriptionKey: "meta.humanize.description" },
  "/citations": { titleKey: "pages.citations.title", descriptionKey: "pages.citations.subtitle" },
  "/grammar-check": { titleKey: "pages.grammarCheck.title", descriptionKey: "pages.grammarCheck.subtitle" },
  "/pricing": { titleKey: "pages.pricing.title", descriptionKey: "pages.pricing.subtitle" },
  "/about": { titleKey: "pages.about.title", descriptionKey: "pages.about.tagline" },
  "/contact": { titleKey: "pages.contact.title", descriptionKey: "pages.contact.subtitle" },
  "/legal": { titleKey: "pages.legal.title", descriptionKey: "pages.legal.subtitle" },
  "/settings": { titleKey: "pages.settings.title", descriptionKey: "pages.settings.subtitle" },
  "/checkout/success": { titleKey: "pages.checkoutSuccess.successTitle", descriptionKey: "pages.checkoutSuccess.successDesc" },
  "/checkout/cancel": { titleKey: "pages.checkoutCancel.title", descriptionKey: "pages.checkoutCancel.description" },
};

const BASE_URL = "https://academicgen.com";

function TitleUpdater() {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  useEffect(() => {
    const metaKey = PAGE_META_KEYS[location] ?? "home";
    const contentMeta = PAGE_CONTENT_META[location];
    const localizedTitle = contentMeta
      ? t(contentMeta.titleKey)
      : `${t("home.heroTitle1")} ${t("home.heroTitle2")}`;
    const title = localizedTitle.includes("AcademicGen") ? localizedTitle : `${localizedTitle} - AcademicGen`;
    const description = contentMeta?.descriptionKey
      ? t(contentMeta.descriptionKey)
      : t(`meta.${metaKey}.description`, { defaultValue: t("meta.home.description") });
    const url = BASE_URL + location;

    document.title = title;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("og:url", url, "property");
    setMeta("twitter:title", title, "name");
    setMeta("twitter:description", description, "name");
    setMeta("twitter:url", url, "name");

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = url;
  }, [location, i18n.language, t]);
  return null;
}
function LangUpdater() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language || "en";
  }, [i18n.language]);
  return null;
}

function PageFallback() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/projects" component={MyProjects} />
        <Route path="/templates" component={Templates} />
        <Route path="/my-templates" component={MyTemplates} />
        <Route path="/references" component={References} />
        <Route path="/ai-assistant" component={AiAssistant} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/generate/report" component={GenerateReport} />
        <Route path="/generate/powerpoint" component={GeneratePowerPoint} />
        <Route path="/generate/conference" component={GenerateConference} />
        <Route path="/generate/thesis" component={GenerateThesis} />
        <Route path="/generate/custom-report" component={GenerateCustomReport} />
        <Route path="/generate/template-report" component={GenerateTemplateReport} />
        <Route path="/generate/images" component={GenerateImages} />
        <Route path="/humanize" component={Humanize} />
        <Route path="/citations" component={Citations} />
        <Route path="/grammar-check" component={GrammarCheck} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/legal" component={Legal} />
        <Route path="/settings" component={Settings} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/checkout/success" component={CheckoutSuccess} />
        <Route path="/checkout/cancel" component={CheckoutCancel} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <ErrorBoundary>
                <TitleUpdater />
                <LangUpdater />
                <div className="flex min-h-screen w-full">
                  {/* translate="no" prevents Google Translate from re-translating the i18n-managed sidebar */}
                  <div translate="no" style={{ display: "contents" }}>
                    <AppSidebar />
                  </div>
                  <SidebarInset className="flex flex-col flex-1">
                    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <div className="flex-1" />
                      <UsageBanner />
                      <ThemeToggle />
                    </header>
                    <main className="flex-1 overflow-auto">
                      <WhatsNewBanner />
                      <Router />
                    </main>
                  </SidebarInset>
                </div>
              </ErrorBoundary>
            </SidebarProvider>
            <ChatbotWidget />
            <OnboardingModal />
            <PwaUpdateBanner />
            <CookieConsent />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
