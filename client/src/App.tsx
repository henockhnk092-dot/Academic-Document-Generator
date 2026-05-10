import { lazy, Suspense, useEffect } from "react";
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
const Settings = lazy(() => import("@/pages/settings"));
const Pricing = lazy(() => import("@/pages/pricing"));
const CheckoutSuccess = lazy(() => import("@/pages/checkout-success"));
const CheckoutCancel = lazy(() => import("@/pages/checkout-cancel"));
const Humanize = lazy(() => import("@/pages/humanize"));
const Citations = lazy(() => import("@/pages/citations"));
const NotFound = lazy(() => import("@/pages/not-found"));

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "AcademicGen – AI Academic Document Generator",
    description: "Free AI platform for generating professional academic documents. Create reports, presentations, papers & thesis instantly with Google Gemini.",
  },
  "/generate/report": {
    title: "Generate Technical Report – AcademicGen",
    description: "Generate a full technical report with sections, citations, and images in seconds using AI. Export to PDF or DOCX.",
  },
  "/generate/powerpoint": {
    title: "Generate PowerPoint Presentation – AcademicGen",
    description: "Create professional slide decks with speaker notes and AI images. Export to PPTX instantly.",
  },
  "/generate/conference": {
    title: "Generate IEEE Conference Paper – AcademicGen",
    description: "AI-generated IEEE-format conference papers with two-column layout, citations, and structured abstracts.",
  },
  "/generate/thesis": {
    title: "Generate Thesis & Dissertation – AcademicGen",
    description: "Create a complete thesis or dissertation with chapters, bibliography, and table of contents using AI.",
  },
  "/generate/images": {
    title: "Generate AI Images – AcademicGen",
    description: "Generate academic diagrams, charts, and illustrations with AI for your research documents.",
  },
  "/generate/custom-report": {
    title: "Custom Report Generator – AcademicGen",
    description: "Generate fully customised academic reports with your own formatting, fonts, and structure.",
  },
  "/humanize": {
    title: "AI Humanizer – AcademicGen",
    description: "Rewrite AI-generated text to sound natural and bypass AI detection tools while keeping academic quality.",
  },
  "/citations": {
    title: "Citation Checker – AcademicGen",
    description: "Detect fake or hallucinated citations in AI-generated text. Verify references with real academic databases.",
  },
  "/pricing": {
    title: "Pricing – AcademicGen",
    description: "Affordable plans for unlimited AI document generation. Day pass, weekly, monthly, and yearly options.",
  },
  "/about": {
    title: "About – AcademicGen",
    description: "Learn about AcademicGen, the free AI-powered platform for academic document generation.",
  },
};

const PAGE_TITLES: Record<string, string> = {
  "/": "AcademicGen – AI Academic Document Generator",
  "/projects": "My Projects – AcademicGen",
  "/templates": "Templates – AcademicGen",
  "/my-templates": "My Templates – AcademicGen",
  "/references": "References – AcademicGen",
  "/ai-assistant": "AI Assistant – AcademicGen",
  "/analytics": "Analytics – AcademicGen",
  "/generate/report": "Generate Report – AcademicGen",
  "/generate/powerpoint": "Generate PowerPoint – AcademicGen",
  "/generate/conference": "Generate Conference Paper – AcademicGen",
  "/generate/thesis": "Generate Thesis – AcademicGen",
  "/generate/images": "Generate Images – AcademicGen",
  "/generate/custom-report": "Generate Custom Report – AcademicGen",
  "/generate/template-report": "Template Report Generator – AcademicGen",
  "/humanize": "AI Humanizer – AcademicGen",
  "/citations": "Citation Checker – AcademicGen",
  "/about": "About – AcademicGen",
  "/contact": "Contact – AcademicGen",
  "/settings": "Settings – AcademicGen",
  "/pricing": "Pricing – AcademicGen",
};

function TitleUpdater() {
  const [location] = useLocation();
  useEffect(() => {
    const meta = PAGE_META[location];
    const title = meta?.title ?? PAGE_TITLES[location] ?? "AcademicGen – AI Academic Document Generator";
    const description = meta?.description ?? "Free AI platform for generating professional academic documents.";

    document.title = title;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.content = content;
    };

    setMeta("description", description);
    setMeta("og:title", title, "property");
    setMeta("og:description", description, "property");
    setMeta("twitter:title", title, "name");
    setMeta("twitter:description", description, "name");
  }, [location]);
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
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
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
