import { Switch, Route } from "wouter";
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
import Home from "@/pages/home";
import MyProjects from "@/pages/my-projects";
import Templates from "@/pages/templates";
import MyTemplates from "@/pages/my-templates";
import References from "@/pages/references";
import AiAssistant from "@/pages/ai-assistant";
import Analytics from "@/pages/analytics";
import GenerateReport from "@/pages/generate-report";
import GeneratePowerPoint from "@/pages/generate-powerpoint";
import GenerateConference from "@/pages/generate-conference";
import GenerateThesis from "@/pages/generate-thesis";
import GenerateImages from "@/pages/generate-images";
import GenerateCustomReport from "@/pages/generate-custom-report";
import About from "@/pages/about";
import Contact from "@/pages/contact";
import Settings from "@/pages/settings";
import Pricing from "@/pages/pricing";
import CheckoutSuccess from "@/pages/checkout-success";
import CheckoutCancel from "@/pages/checkout-cancel";
import Humanize from "@/pages/humanize";
import Citations from "@/pages/citations";
import NotFound from "@/pages/not-found";

function Router() {
  return (
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
            </SidebarProvider>
            <ChatbotWidget />
            <OnboardingModal />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
