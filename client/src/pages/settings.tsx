import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";
import { useUsage } from "@/hooks/use-usage";
import { PricingModal } from "@/components/pricing-modal";
import { apiRequest } from "@/lib/queryClient";
import { PRICING_TIERS } from "@shared/schema";
import {
  Settings as SettingsIcon,
  Key,
  Palette,
  Save,
  Eye,
  EyeOff,
  RotateCcw,
  CreditCard,
  Crown,
  Sparkles,
  ExternalLink,
  Loader2,
  Shield,
  Code,
  User,
  Coffee,
  Server,
  RefreshCw,
  Volume2,
  Globe,
  ChevronDown,
  Zap,
} from "lucide-react";
import { AZURE_VOICES, AZURE_LANGUAGES, getBrowserVoiceLanguage, azureAvailable, getSpeechPrefs, saveSpeechPrefs } from "@/hooks/use-speech";
import { LanguageSwitcher } from "@/components/language-switcher";

interface PaymentProviderInfo {
  preferred: 'bmc' | 'yoco' | 'stripe' | 'none';
  bmc: boolean;
  yoco: boolean;
  stripe: boolean;
}

export default function Settings() {
  const [showApiKey, setShowApiKey] = useState(false);

  // Voice & language prefs
  const sp0 = getSpeechPrefs();
  const [voiceEngine, setVoiceEngine] = useState(sp0.engineMode ?? "azure");
  const [voiceLang, setVoiceLang] = useState(sp0.language ?? "English");
  const [selectedVoice, setSelectedVoice] = useState(sp0.voiceName ?? (AZURE_VOICES[0]?.name ?? ""));
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => setBrowserVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  const isAzureEngine = voiceEngine === "azure" && azureAvailable;
  const azureLangVoices = AZURE_VOICES.filter(v => v.language === voiceLang);
  const browserLangVoices = browserVoices.filter(v => getBrowserVoiceLanguage(v) === voiceLang);
  const activeLangVoices = isAzureEngine ? azureLangVoices : browserLangVoices;
  const browserLanguages = Array.from(new Set(browserVoices.map(getBrowserVoiceLanguage))).sort();
  const activeLangList = isAzureEngine ? AZURE_LANGUAGES : browserLanguages;
  const langFlag = AZURE_VOICES.find(v => v.language === voiceLang)?.flag ?? "";

  const handleVoiceEngine = (eng: string) => {
    setVoiceEngine(eng);
    saveSpeechPrefs({ engineMode: eng });
    // Reset voice to first in current language for the new engine
    if (eng === "azure") {
      const first = AZURE_VOICES.find(v => v.language === voiceLang);
      if (first) { setSelectedVoice(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    } else {
      const first = browserVoices.find(v => getBrowserVoiceLanguage(v) === voiceLang);
      if (first) { setSelectedVoice(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    }
  };

  const handleVoiceLang = (lang: string) => {
    setVoiceLang(lang);
    saveSpeechPrefs({ language: lang });
    if (isAzureEngine) {
      const first = AZURE_VOICES.find(v => v.language === lang);
      if (first) { setSelectedVoice(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    } else {
      const first = browserVoices.find(v => getBrowserVoiceLanguage(v) === lang);
      if (first) { setSelectedVoice(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    }
  };

  const handleVoiceSelect = (name: string) => {
    setSelectedVoice(name);
    saveSpeechPrefs({ voiceName: name });
  };

  const [settings, setSettings] = useState({
    geminiApiKey: "",
    pixabayApiKey: "",
    defaultTone: "Academic",
    defaultReferenceStyle: "Harvard",
    generateImages: true,
    autoSave: true,
    darkMode: false,
  });
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderInfo | null>(null);

  const [adminKeys, setAdminKeys] = useState<Array<{ key: string; label: string; masked: string; hasValue: boolean }>>([]);
  const [adminKeyEdits, setAdminKeyEdits] = useState<Record<string, string>>({});
  const [adminKeyVisible, setAdminKeyVisible] = useState<Record<string, boolean>>({});
  const [adminKeysLoading, setAdminKeysLoading] = useState(false);
  const [adminKeysSaving, setAdminKeysSaving] = useState(false);

  const { toast } = useToast();
  const { user, isAuthenticated, userRole, isAdmin, hasUnlimitedAccess } = useAuth();
  const { getUsageStatus, isLoading: usageLoading } = useUsage();

  const usageStatus = getUsageStatus();

  useEffect(() => {
    const saved = localStorage.getItem("papergen-settings");
    if (saved) {
      try {
        setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error("Failed to load settings:", e);
      }
    }
    fetchPaymentProvider();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAdminKeys();
  }, [isAdmin]);

  const fetchAdminKeys = async () => {
    setAdminKeysLoading(true);
    try {
      const response = await fetch("/api/admin/config", {
        headers: { "X-Admin-Token": "hnk-admin-2026" },
      });
      const data = await response.json();
      const entries = data.entries || [];
      setAdminKeys(entries);
      const edits: Record<string, string> = {};
      entries.forEach((e: any) => { edits[e.key] = ""; });
      setAdminKeyEdits(edits);
    } catch {
      toast({ title: "Error", description: "Failed to load server config", variant: "destructive" });
    } finally {
      setAdminKeysLoading(false);
    }
  };

  const handleSaveAdminKeys = async () => {
    const updates: Record<string, string> = {};
    Object.entries(adminKeyEdits).forEach(([k, v]) => {
      if (v.trim()) updates[k] = v.trim();
    });
    if (Object.keys(updates).length === 0) {
      toast({ title: "No Changes", description: "Enter new values in the fields you want to update." });
      return;
    }
    setAdminKeysSaving(true);
    try {
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Token": "hnk-admin-2026" },
        body: JSON.stringify({ updates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");
      toast({ title: "Keys Updated", description: `${data.updated} key(s) updated. Changes are active until next server restart.` });
      setAdminKeyEdits(prev => Object.fromEntries(Object.keys(prev).map(k => [k, ""])));
      await fetchAdminKeys();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save keys", variant: "destructive" });
    } finally {
      setAdminKeysSaving(false);
    }
  };

  const fetchPaymentProvider = async () => {
    try {
      const response = await fetch("/api/payment/provider");
      const data = await response.json();
      setPaymentProvider(data);
    } catch (error) {
      console.error("Failed to fetch payment provider:", error);
      setPaymentProvider({ preferred: 'none', bmc: false, yoco: false, stripe: false });
    }
  };

  const handleSave = () => {
    localStorage.setItem("papergen-settings", JSON.stringify(settings));
    toast({
      title: "Settings Saved",
      description: "Your preferences have been saved successfully.",
    });
  };

  const handleReset = () => {
    const defaultSettings = {
      geminiApiKey: "",
      pixabayApiKey: "",
      defaultTone: "Academic",
      defaultReferenceStyle: "Harvard",
      generateImages: true,
      autoSave: true,
      darkMode: false,
    };
    setSettings(defaultSettings);
    localStorage.removeItem("papergen-settings");
    toast({
      title: "Settings Reset",
      description: "All settings have been reset to defaults.",
    });
  };

  const handleManageSubscription = async () => {
    if (!user?.uid) return;

    // For BMC, open the membership page directly
    if (paymentProvider?.preferred === 'bmc') {
      window.open("https://buymeacoffee.com/horizonhnk/membership", '_blank');
      toast({
        title: "Opening Buy Me a Coffee",
        description: "Manage your membership on Buy Me a Coffee.",
      });
      return;
    }

    setIsPortalLoading(true);
    try {
      const response = await apiRequest("POST", "/api/stripe/portal", {
        userId: user.uid,
      });
      const data = await (response as any).json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL returned");
      }
    } catch (error: any) {
      console.error("Portal error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to open subscription portal",
        variant: "destructive",
      });
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS, priceId?: string, provider?: string) => {
    if (!user?.uid) {
      toast({
        title: "Error",
        description: "Please sign in and try again",
        variant: "destructive",
      });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      // Handle Buy Me a Coffee checkout
      const effectiveProvider = provider || paymentProvider?.preferred;
      if (effectiveProvider === 'bmc') {
        const response = await fetch(`/api/bmc/checkout-url?tier=${plan}`);
        const data = await response.json();
        if (data.url) {
          window.open(data.url, '_blank');
          setShowPricingModal(false);
          toast({
            title: "Opening Buy Me a Coffee",
            description: "Complete your purchase on Buy Me a Coffee. Make sure to use the same email address you signed up with!",
          });
        } else {
          throw new Error("No checkout URL returned");
        }
        setIsCheckoutLoading(false);
        return;
      }

      // Handle Yoco checkout
      if (effectiveProvider === 'yoco') {
        const data = await apiRequest<{ url: string }>("POST", "/api/yoco/checkout", {
          tier: plan,
          userId: user.uid,
          userEmail: user.email,
        });
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error("No checkout URL returned");
        }
        return;
      }

      // Handle Stripe checkout (default)
      if (!priceId) {
        toast({
          title: "Error",
          description: "Please sign in and try again",
          variant: "destructive",
        });
        setIsCheckoutLoading(false);
        return;
      }

      const response = await apiRequest("POST", "/api/stripe/checkout", {
        priceId,
        userId: user.uid,
        userEmail: user.email,
      });

      const data = await (response as any).json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout failed",
        description: error.message || "Failed to start checkout",
        variant: "destructive",
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const getSubscriptionBadge = () => {
    if (userRole === "admin") {
      return (
        <Badge className="gap-1.5 border-red-500/50 bg-red-500/10 text-red-500" variant="outline">
          <Shield className="h-3.5 w-3.5" />
          Admin
        </Badge>
      );
    }
    if (userRole === "developer") {
      return (
        <Badge className="gap-1.5 border-blue-500/50 bg-blue-500/10 text-blue-500" variant="outline">
          <Code className="h-3.5 w-3.5" />
          Developer
        </Badge>
      );
    }
    if (usageStatus.hasActiveSubscription && usageStatus.subscriptionTier) {
      return (
        <Badge className="gap-1.5" variant="outline">
          <Crown className="h-3.5 w-3.5 text-primary" />
          <span className="capitalize">{usageStatus.subscriptionTier}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1.5">
        <User className="h-3.5 w-3.5" />
        Free
      </Badge>
    );
  };

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto" data-testid="page-settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure your API keys, subscription, and preferences for document generation.
          </p>
        </div>

        {/* Subscription Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription
            </CardTitle>
            <CardDescription>
              Manage your subscription and billing settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAuthenticated ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  Sign in to manage your subscription and unlock unlimited features.
                </p>
              </div>
            ) : usageLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Current Plan</Label>
                    <div className="flex items-center gap-2">
                      {getSubscriptionBadge()}
                    </div>
                  </div>
                  <div className="text-right">
                    {hasUnlimitedAccess ? (
                      <p className="text-sm text-muted-foreground">Unlimited access</p>
                    ) : usageStatus.hasActiveSubscription ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-green-600">Active</p>
                        {usageStatus.subscriptionExpiry && (
                          <p className="text-xs text-muted-foreground">
                            Renews: {new Date(usageStatus.subscriptionExpiry).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {usageStatus.remaining} / {usageStatus.maxAttempts} generations left
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {hasUnlimitedAccess ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Sparkles className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="font-medium">You have unlimited access!</p>
                    <p className="text-sm text-muted-foreground">
                      {userRole === "admin" ? "Admin privileges enabled" : "Developer privileges enabled"}
                    </p>
                  </div>
                ) : usageStatus.hasActiveSubscription ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      disabled={isPortalLoading}
                      className="flex-1"
                    >
                      {isPortalLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : paymentProvider?.preferred === 'bmc' ? (
                        <Coffee className="mr-2 h-4 w-4" />
                      ) : (
                        <ExternalLink className="mr-2 h-4 w-4" />
                      )}
                      Manage Subscription
                      {paymentProvider?.preferred === 'bmc' && <ExternalLink className="ml-2 h-3 w-3" />}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Upgrade to unlock:
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Unlimited document generations</li>
                        <li>• All document types (Reports, Thesis, Conference Papers)</li>
                        <li>• AI-powered image generation</li>
                        <li>• Priority support</li>
                      </ul>
                    </div>
                    <Button onClick={() => setShowPricingModal(true)} className="w-full">
                      <Crown className="mr-2 h-4 w-4" />
                      View Plans & Upgrade
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </CardTitle>
            <CardDescription>
              Enter your API keys to enable AI-powered content and image generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gemini-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Enter your Gemini API key"
                    value={settings.geminiApiKey}
                    onChange={(e) => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    data-testid="input-gemini-key"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowApiKey(!showApiKey)}
                  data-testid="button-toggle-key-visibility"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixabay-key">Pixabay API Key (Optional)</Label>
              <Input
                id="pixabay-key"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your Pixabay API key for images"
                value={settings.pixabayApiKey}
                onChange={(e) => setSettings({ ...settings, pixabayApiKey: e.target.value })}
                data-testid="input-pixabay-key"
              />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://pixabay.com/api/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Pixabay API
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Default Preferences
            </CardTitle>
            <CardDescription>
              Set default options for document generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default-tone">Default Tone</Label>
                <Select
                  value={settings.defaultTone}
                  onValueChange={(value) => setSettings({ ...settings, defaultTone: value })}
                >
                  <SelectTrigger id="default-tone" data-testid="select-default-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academic">Academic</SelectItem>
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Formal">Formal</SelectItem>
                    <SelectItem value="Technical">Technical</SelectItem>
                    <SelectItem value="Conversational">Conversational</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-reference">Default Reference Style</Label>
                <Select
                  value={settings.defaultReferenceStyle}
                  onValueChange={(value) => setSettings({ ...settings, defaultReferenceStyle: value })}
                >
                  <SelectTrigger id="default-reference" data-testid="select-default-reference">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Harvard">Harvard</SelectItem>
                    <SelectItem value="IEEE">IEEE</SelectItem>
                    <SelectItem value="APA">APA</SelectItem>
                    <SelectItem value="MLA">MLA</SelectItem>
                    <SelectItem value="Chicago">Chicago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Generate Images</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate images for documents
                  </p>
                </div>
                <Switch
                  checked={settings.generateImages}
                  onCheckedChange={(checked) => setSettings({ ...settings, generateImages: checked })}
                  data-testid="switch-generate-images"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Save Projects</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically save projects to your account
                  </p>
                </div>
                <Switch
                  checked={settings.autoSave}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoSave: checked })}
                  data-testid="switch-auto-save"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voice & Language Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Voice & Language Preferences
            </CardTitle>
            <CardDescription>
              Choose your UI language, voice engine, and speaker. Settings are saved automatically and apply everywhere.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* UI Language */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> Website Language
              </Label>
              <LanguageSwitcher />
              <p className="text-xs text-muted-foreground">
                Changes the sidebar, navigation, and key UI text. Also auto-selects a matching voice for the reader.
              </p>
            </div>

            <Separator />

            {/* Engine toggle */}
            <div className="space-y-2">
              <Label>Voice Engine</Label>
              <div className="flex gap-2 flex-wrap">
                {azureAvailable && (
                  <button
                    onClick={() => handleVoiceEngine("azure")}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      voiceEngine === "azure" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" /> Azure Neural HD
                  </button>
                )}
                <button
                  onClick={() => handleVoiceEngine("gemini")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "gemini" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Google Gemini TTS
                </button>
                <button
                  onClick={() => handleVoiceEngine("browser")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "browser" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Browser Default
                </button>
              </div>
              {voiceEngine === "azure" && !azureAvailable && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Azure TTS key not configured. Contact admin or set <code>VITE_AZURE_TTS_KEY</code> in environment.
                </p>
              )}
              {voiceEngine === "gemini" && (
                <p className="text-xs text-muted-foreground">
                  Uses Google Gemini TTS API — requires Gemini API key. Falls back to browser if unavailable.
                </p>
              )}
            </div>

            <Separator />

            {/* Language + Voice selection */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-4 w-4" /> Language
                </Label>
                <Select
                  value={voiceLang}
                  onValueChange={handleVoiceLang}
                >
                  <SelectTrigger>
                    <SelectValue>
                      {isAzureEngine ? `${langFlag} ${voiceLang}` : voiceLang}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {activeLangList.map(lang => {
                      const flag = isAzureEngine ? (AZURE_VOICES.find(v => v.language === lang)?.flag ?? "") : "";
                      return (
                        <SelectItem key={lang} value={lang}>
                          {flag}{flag ? " " : ""}{lang}
                        </SelectItem>
                      );
                    })}
                    {!isAzureEngine && browserVoices.length === 0 && (
                      <SelectItem value="English" disabled>Loading browser voices…</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isAzureEngine
                    ? `${AZURE_LANGUAGES.length} languages supported by Azure`
                    : `${activeLangList.length} language(s) detected in your browser`}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Voice / Speaker</Label>
                <Select
                  value={selectedVoice}
                  onValueChange={handleVoiceSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {isAzureEngine ? (
                      activeLangVoices.map(v => (
                        <SelectItem key={v.name} value={v.name}>
                          {v.flag} {v.label}
                        </SelectItem>
                      ))
                    ) : (
                      activeLangVoices.length === 0 ? (
                        <SelectItem value="" disabled>No voices for this language</SelectItem>
                      ) : (
                        activeLangVoices.map(v => (
                          <SelectItem key={v.name} value={v.name}>
                            {v.name}
                          </SelectItem>
                        ))
                      )
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {isAzureEngine ? "Azure Neural HD voices" : "Browser / Google voices available on your device"}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Azure Neural HD</strong> — 25+ languages, 80+ voices. Highest quality. Requires Azure key.</p>
              <p><strong>Google Gemini TTS</strong> — English only (API limit). Requires Gemini API key.</p>
              <p><strong>Browser Default</strong> — Languages depend on your OS. Chrome includes Google voices for many languages. Completely free.</p>
              <p className="text-[11px] pt-1 opacity-70">All engines fall back automatically: Azure → Gemini → Browser if a key is missing or fails.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleReset} data-testid="button-reset">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} data-testid="button-save">
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>

        {isAdmin && (
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Server className="h-5 w-5" />
                Server API Keys
                <Badge variant="outline" className="ml-auto border-red-500/50 bg-red-500/10 text-red-500 text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  Admin Only
                </Badge>
              </CardTitle>
              <CardDescription>
                View and update server-side environment variables. Changes take effect immediately but reset on next server restart.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminKeysLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {adminKeys.map((entry) => (
                      <div key={entry.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-mono text-muted-foreground">{entry.key}</Label>
                          <span className="text-xs text-muted-foreground">{entry.label}</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={adminKeyVisible[entry.key] ? "text" : "password"}
                              placeholder={entry.hasValue ? entry.masked : "Not set — enter new value"}
                              value={adminKeyEdits[entry.key] || ""}
                              onChange={(e) => setAdminKeyEdits(prev => ({ ...prev, [entry.key]: e.target.value }))}
                              className="font-mono text-sm pr-10"
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setAdminKeyVisible(prev => ({ ...prev, [entry.key]: !prev[entry.key] }))}
                          >
                            {adminKeyVisible[entry.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={fetchAdminKeys} disabled={adminKeysLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button size="sm" onClick={handleSaveAdminKeys} disabled={adminKeysSaving}>
                      {adminKeysSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Update Keys
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <PricingModal
        open={showPricingModal}
        onOpenChange={setShowPricingModal}
        onSelectPlan={handleSelectPlan}
        isLoading={isCheckoutLoading}
      />
    </div>
  );
}
