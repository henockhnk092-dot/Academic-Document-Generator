import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Home, FolderOpen, FileText, Presentation, BookOpen, BookMarked,
  GraduationCap, Sparkles, Info, Mail, Settings, LogIn, LogOut, User,
  Layout, Library, Bot, BarChart3, Image, FileSignature, Crown, Wand2, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthDialog } from "@/components/auth-dialog";
import { useAuth } from "@/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { setOpenMobile, isMobile } = useSidebar();
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const { user, signOut: authSignOut } = useAuth();
  const { t } = useTranslation();

  const handleNavClick = () => { if (isMobile) setOpenMobile(false); };

  const handleSignOut = async () => {
    try { await authSignOut(); } catch (error) { console.error("Sign out error:", error); }
  };

  const navigationItems = [
    { titleKey: "nav.home",          url: "/",             icon: Home },
    { titleKey: "nav.myProjects",    url: "/projects",     icon: FolderOpen },
    { titleKey: "nav.templates",     url: "/templates",    icon: Layout },
    { titleKey: "nav.myTemplates",   url: "/my-templates", icon: Star },
    { titleKey: "nav.aiAssistant",   url: "/ai-assistant", icon: Bot },
    { titleKey: "nav.analytics",     url: "/analytics",    icon: BarChart3 },
  ];

  const generatorItems = [
    { titleKey: "generators.technicalReport",  url: "/generate/report",        icon: FileText,      descKey: "BET-standard format" },
    { titleKey: "generators.customReport",     url: "/generate/custom-report", icon: FileSignature, descKey: "Full customization" },
    { titleKey: "generators.powerpoint",       url: "/generate/powerpoint",    icon: Presentation,  descKey: "Professional slides" },
    { titleKey: "generators.conferencePaper",  url: "/generate/conference",    icon: BookOpen,      descKey: "IEEE format" },
    { titleKey: "generators.thesis",           url: "/generate/thesis",        icon: GraduationCap, descKey: "Complete thesis" },
    { titleKey: "generators.aiImages",         url: "/generate/images",        icon: Image,         descKey: "Text-to-image" },
    { titleKey: "generators.references",       url: "/references",             icon: Library,       descKey: "Reference library" },
    { titleKey: "generators.aiHumanizer",      url: "/humanize",               icon: Wand2,         descKey: "Bypass AI detection" },
    { titleKey: "generators.citationChecker",  url: "/citations",              icon: BookMarked,    descKey: "Detect fake references" },
  ];

  const subscriptionItems = [
    { titleKey: "subscription.pricingPlans", url: "/pricing", icon: Crown },
  ];

  const supportItems = [
    { titleKey: "support.about",    url: "/about",    icon: Info },
    { titleKey: "support.contact",  url: "/contact",  icon: Mail },
    { titleKey: "support.settings", url: "/settings", icon: Settings },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2" onClick={handleNavClick}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">AcademicGen</span>
            <span className="text-xs text-muted-foreground">Academic Documents</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.titleKey.split(".")[1].toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("generators.label")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {generatorItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.titleKey.split(".")[1].toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("subscription.label")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {subscriptionItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.titleKey.split(".")[1].toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4 text-primary" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{t("support.label")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supportItems.map((item) => (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.titleKey.split(".")[1].toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <Link href={item.url} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{t(item.titleKey)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-3">
        {/* Language switcher */}
        <LanguageSwitcher />

        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="h-8 w-8 rounded-full" />
                ) : (
                  <User className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.displayName || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleSignOut}
              data-testid="button-sign-out"
            >
              <LogOut className="h-4 w-4" />
              {t("auth.signOut")}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setShowAuthDialog(true)}
            data-testid="button-sign-in"
          >
            <LogIn className="h-4 w-4" />
            {t("auth.signIn")}
          </Button>
        )}
      </SidebarFooter>

      <AuthDialog open={showAuthDialog} onOpenChange={setShowAuthDialog} />
    </Sidebar>
  );
}
