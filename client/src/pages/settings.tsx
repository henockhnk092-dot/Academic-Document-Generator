import { useState, useEffect } from "react";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/language-switcher";

const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  desc: "Female · Narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella",   desc: "Female · Calm" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",    desc: "Female · Strong" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    desc: "Female · Young" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    desc: "Male · Narration" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  desc: "Male · Professional" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  desc: "Male · Crisp" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    desc: "Male · Deep" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",     desc: "Male · Raspy" },
];

const STREAMELEMENTS_VOICES = [
  "Brian", "Amy", "Emma", "Joey", "Salli", "Matthew", "Joanna",
  "Kendra", "Kimberly", "Ivy", "Justin", "Russell", "Nicole", "Geraint",
];

interface AdminConfigEntry {
  key: string;
  label: string;
  masked: string;
  hasValue: boolean;
  group?: string;
}

export default function Settings() {
  const [showApiKey, setShowApiKey] = useState(false);

  // Voice & language prefs
  const sp0 = getSpeechPrefs();
  const [voiceEngine, setVoiceEngine] = useState(sp0.engineMode ?? "elevenlabs");
  // Azure/browser use human-readable language names ("English"); VoiceRSS uses BCP-47 ("en-us")
  const [voiceLang, setVoiceLang] = useState(sp0.language ?? "English");
  const [voicerssLang, setVoicerssLang] = useState(sp0.voicerssLang ?? "en-us");
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
    if (eng === "azure") {
      const first = AZURE_VOICES.find(v => v.language === voiceLang);
      if (first) { setSelectedVoice(first.name); saveSpeechPrefs({ voiceName: first.name }); }
    } else if (eng === "elevenlabs") {
      setSelectedVoice(ELEVENLABS_VOICES[0].id);
      saveSpeechPrefs({ voiceName: ELEVENLABS_VOICES[0].id });
    } else if (eng === "streamelements") {
      setSelectedVoice(STREAMELEMENTS_VOICES[0]);
      saveSpeechPrefs({ voiceName: STREAMELEMENTS_VOICES[0] });
    } else if (eng === "voicerss") {
      setSelectedVoice("Linda");
      saveSpeechPrefs({ voiceName: "Linda" });
      // Ensure voicerssLang is a BCP-47 code, not an Azure-format name
      if (!voicerssLang || voicerssLang.length > 6) {
        setVoicerssLang("en-us");
        saveSpeechPrefs({ voicerssLang: "en-us" });
      }
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
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const [adminKeys, setAdminKeys] = useState<AdminConfigEntry[]>([]);
  const [adminKeyEdits, setAdminKeyEdits] = useState<Record<string, string>>({});
  const [adminKeyVisible, setAdminKeyVisible] = useState<Record<string, boolean>>({});
  const [adminKeysLoading, setAdminKeysLoading] = useState(false);
  const [adminKeysSaving, setAdminKeysSaving] = useState(false);
  const [paraphraseModel, setParaphraseModel] = useState("auto");
  const [requirePaidForScan, setRequirePaidForScan] = useState(true);
  const [planLimitsLoading, setPlanLimitsLoading] = useState(false);

  const { t } = useTranslation();
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
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAdminKeys();
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "users", user.uid))
      .then(snap => { if (snap.exists()) setParaphraseModel(snap.data()?.paraphraseModel ?? "auto"); })
      .catch(() => {});
  }, [user?.uid]);

  const handleParaphraseModelChange = async (value: string) => {
    setParaphraseModel(value);
    if (!user?.uid) return;
    const db = getFirebaseDb();
    if (!db) return;
    try {
      await setDoc(doc(db, "users", user.uid), { paraphraseModel: value }, { merge: true });
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const db = getFirebaseDb();
    if (!db) return;
    getDoc(doc(db, "settings", "planLimits"))
      .then(snap => { if (snap.exists()) setRequirePaidForScan(snap.data()?.requirePaidForScan !== false); })
      .catch(() => {});
  }, [isAdmin]);

  const handleRequirePaidToggle = async (checked: boolean) => {
    setRequirePaidForScan(checked);
    setPlanLimitsLoading(true);
    const db = getFirebaseDb();
    if (!db) { setPlanLimitsLoading(false); return; }
    try {
      await setDoc(doc(db, "settings", "planLimits"), { requirePaidForScan: checked }, { merge: true });
      toast({ title: checked ? "Restriction enabled" : "Restriction disabled", description: checked ? "Only Pro/Business users can scan." : "All logged-in users can scan." });
    } catch {
      toast({ title: "Failed to update setting", variant: "destructive" });
    } finally { setPlanLimitsLoading(false); }
  };

  const getAdminHeaders = async (): Promise<Record<string, string>> => {
    const auth = getFirebaseAuth();
    const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
    if (!idToken) throw new Error("Not authenticated");
    return { "Authorization": `Bearer ${idToken}` };
  };

  const fetchAdminKeys = async () => {
    setAdminKeysLoading(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/config", { headers });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Forbidden");
      const entries = (data.entries || []) as AdminConfigEntry[];
      setAdminKeys(entries);
      const edits: Record<string, string> = {};
      entries.forEach((entry) => { edits[entry.key] = ""; });
      setAdminKeyEdits(edits);
    } catch {
      toast({ title: t("common.errorTitle"), description: t("pages.settings.failedLoadConfig"), variant: "destructive" });
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
      toast({ title: t("pages.settings.noChanges"), description: t("pages.settings.noChangesDesc") });
      return;
    }
    setAdminKeysSaving(true);
    try {
      const headers = await getAdminHeaders();
      const response = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ updates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save");
      toast({ title: t("pages.settings.keysUpdated"), description: t("pages.settings.keysUpdatedDesc", { count: data.updated }) });
      setAdminKeyEdits(prev => Object.fromEntries(Object.keys(prev).map(k => [k, ""])));
      await fetchAdminKeys();
    } catch (error) {
      toast({
        title: t("common.errorTitle"),
        description: error instanceof Error ? error.message : t("pages.settings.failedSaveKeys"),
        variant: "destructive",
      });
    } finally {
      setAdminKeysSaving(false);
    }
  };

  const handleSave = () => {
    localStorage.setItem("papergen-settings", JSON.stringify(settings));
    toast({
      title: t("pages.settings.settingsSaved"),
      description: t("pages.settings.settingsSavedDesc"),
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
      title: t("pages.settings.settingsReset"),
      description: t("pages.settings.settingsResetDesc"),
    });
  };

  const handleManageSubscription = async () => {
    try {
      const response = await fetch("/api/bmc/checkout-url");
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) {
        throw new Error(data.error || t("pages.settings.errorOpenPortal"));
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
      toast({
        title: t("pages.settings.openingBMC"),
        description: t("pages.settings.openingBMCDesc"),
      });
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        title: t("common.errorTitle"),
        description: error instanceof Error ? error.message : t("pages.settings.errorOpenPortal"),
        variant: "destructive",
      });
    }
  };

  const handleSelectPlan = async (plan: keyof typeof PRICING_TIERS) => {
    if (!user?.uid) {
      toast({
        title: t("common.errorTitle"),
        description: t("pages.settings.signInToTryAgain"),
        variant: "destructive",
      });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const response = await fetch(`/api/bmc/checkout-url?tier=${encodeURIComponent(plan)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || t("pages.settings.checkoutFailedDesc"));
      }
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setShowPricingModal(false);
        toast({
          title: t("pages.pricing.openingBMC"),
          description: t("pages.pricing.openingBMCDesc"),
        });
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t("pages.settings.checkoutFailed"),
        description: error instanceof Error ? error.message : t("pages.settings.checkoutFailedDesc"),
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
          {t("pages.settings.roleAdmin")}
        </Badge>
      );
    }
    if (userRole === "developer") {
      return (
        <Badge className="gap-1.5 border-blue-500/50 bg-blue-500/10 text-blue-500" variant="outline">
          <Code className="h-3.5 w-3.5" />
          {t("pages.settings.roleDeveloper")}
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
        {t("pages.settings.roleFree")}
      </Badge>
    );
  };

  return (
    <div className="container max-w-6xl py-8 px-4 mx-auto" data-testid="page-settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            {t("pages.settings.title")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {t("pages.settings.subtitle")}
          </p>
        </div>

        {/* Subscription Management Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t("pages.settings.subscriptionTitle")}
            </CardTitle>
            <CardDescription>
              {t("pages.settings.subscriptionDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isAuthenticated ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  {t("pages.settings.signInToManage")}
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
                    <Label>{t("pages.settings.currentPlan")}</Label>
                    <div className="flex items-center gap-2">
                      {getSubscriptionBadge()}
                    </div>
                  </div>
                  <div className="text-right">
                    {hasUnlimitedAccess ? (
                      <p className="text-sm text-muted-foreground">{t("pages.settings.unlimitedAccess")}</p>
                    ) : usageStatus.hasActiveSubscription ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-green-600">{t("pages.settings.active")}</p>
                        {usageStatus.subscriptionExpiry && (
                          <p className="text-xs text-muted-foreground">
                            {t("pages.settings.renews")} {new Date(usageStatus.subscriptionExpiry).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          {usageStatus.remaining} / {usageStatus.maxAttempts} {t("pages.settings.generationsLeft")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {hasUnlimitedAccess ? (
                  <div className="bg-muted/50 rounded-lg p-4 text-center">
                    <Sparkles className="h-8 w-8 mx-auto text-primary mb-2" />
                    <p className="font-medium">{t("pages.settings.youHaveUnlimited")}</p>
                    <p className="text-sm text-muted-foreground">
                      {userRole === "admin" ? t("pages.settings.adminPrivileges") : t("pages.settings.developerPrivileges")}
                    </p>
                  </div>
                ) : usageStatus.hasActiveSubscription ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      onClick={handleManageSubscription}
                      className="flex-1"
                    >
                      <Coffee className="mr-2 h-4 w-4" />
                      {t("pages.settings.manageSubscription")}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        {t("pages.settings.upgradeUnlock")}
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• {t("pages.settings.upgradeFeature1")}</li>
                        <li>• {t("pages.settings.upgradeFeature2")}</li>
                        <li>• {t("pages.settings.upgradeFeature3")}</li>
                        <li>• {t("pages.settings.upgradeFeature4")}</li>
                      </ul>
                    </div>
                    <Button onClick={() => setShowPricingModal(true)} className="w-full">
                      <Crown className="mr-2 h-4 w-4" />
                      {t("pages.settings.viewPlansUpgrade")}
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
              {t("pages.settings.apiConfigTitle")}
            </CardTitle>
            <CardDescription>
              {t("pages.settings.apiConfigDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gemini-key">{t("pages.settings.geminiKeyLabel")}</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="gemini-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder={t("pages.settings.geminiKeyPlaceholder")}
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
                {t("pages.settings.geminiKeyHint")}{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("pages.settings.googleAIStudio")}
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pixabay-key">{t("pages.settings.pixabayKeyLabel")}</Label>
              <Input
                id="pixabay-key"
                type={showApiKey ? "text" : "password"}
                placeholder={t("pages.settings.pixabayKeyPlaceholder")}
                value={settings.pixabayApiKey}
                onChange={(e) => setSettings({ ...settings, pixabayApiKey: e.target.value })}
                data-testid="input-pixabay-key"
              />
              <p className="text-xs text-muted-foreground">
                {t("pages.settings.pixabayKeyHint")}{" "}
                <a
                  href="https://pixabay.com/api/docs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {t("pages.settings.pixabayAPI")}
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t("pages.settings.preferencesTitle")}
            </CardTitle>
            <CardDescription>
              {t("pages.settings.preferencesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="default-tone">{t("pages.settings.defaultTone")}</Label>
                <Select
                  value={settings.defaultTone}
                  onValueChange={(value) => setSettings({ ...settings, defaultTone: value })}
                >
                  <SelectTrigger id="default-tone" data-testid="select-default-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academic">{t("common.toneAcademic")}</SelectItem>
                    <SelectItem value="Professional">{t("common.toneProfessional")}</SelectItem>
                    <SelectItem value="Formal">{t("common.toneFormal")}</SelectItem>
                    <SelectItem value="Technical">{t("common.toneTechnical")}</SelectItem>
                    <SelectItem value="Conversational">{t("common.toneConversational")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-reference">{t("pages.settings.defaultReference")}</Label>
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
                  <Label>{t("pages.settings.generateImages")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.settings.generateImagesDesc")}
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
                  <Label>{t("pages.settings.autoSave")}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t("pages.settings.autoSaveDesc")}
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
              {t("pages.settings.voiceTitle")}
            </CardTitle>
            <CardDescription>
              {t("pages.settings.voiceDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* UI Language */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> {t("pages.settings.websiteLanguage")}
              </Label>
              <LanguageSwitcher />
              <p className="text-xs text-muted-foreground">
                {t("pages.settings.websiteLanguageHint")}
              </p>
            </div>

            <Separator />

            {/* Engine toggle */}
            <div className="space-y-2">
              <Label>{t("pages.settings.voiceEngine")}</Label>
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
                  onClick={() => handleVoiceEngine("elevenlabs")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "elevenlabs" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Volume2 className="h-3.5 w-3.5" /> ElevenLabs
                </button>
                <button
                  onClick={() => handleVoiceEngine("voicerss")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "voicerss" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  VoiceRSS
                </button>
                <button
                  onClick={() => handleVoiceEngine("streamelements")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "streamelements" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  StreamElements
                </button>
                <button
                  onClick={() => handleVoiceEngine("gemini")}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    voiceEngine === "gemini" ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Gemini TTS
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
              <p className="text-xs text-muted-foreground">
                {voiceEngine === "azure" && "High-quality Neural voices. 500K chars/month free, fallback to next provider on failure."}
                {voiceEngine === "elevenlabs" && "Most realistic AI voices. Select a voice below. Falls back to StreamElements on failure."}
                {voiceEngine === "voicerss" && "Reliable TTS in 50+ languages. Select language below. Falls back to StreamElements on failure."}
                {voiceEngine === "streamelements" && "Amazon Polly voices. Currently unreliable (provider outage) — falls back automatically if unavailable."}
                {voiceEngine === "gemini" && "Google Gemini TTS. Falls back to browser on failure."}
                {voiceEngine === "browser" && "Uses your device's built-in voices. No server needed."}
              </p>
            </div>

            <Separator />

            {/* Voice selection — changes based on active engine */}
            {(voiceEngine === "azure" || voiceEngine === "browser") && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Globe className="h-4 w-4" /> {t("pages.settings.language")}
                  </Label>
                  <Select value={voiceLang} onValueChange={handleVoiceLang}>
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
                        <SelectItem value="English" disabled>{t("pages.settings.loadingBrowserVoices")}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isAzureEngine
                      ? `${AZURE_LANGUAGES.length} languages available`
                      : `${activeLangList.length} languages on your device`}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t("pages.settings.voiceSpeaker")}</Label>
                  <Select value={selectedVoice} onValueChange={handleVoiceSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("pages.settings.selectVoice")} />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {isAzureEngine ? (
                        azureLangVoices.map(v => (
                          <SelectItem key={v.name} value={v.name}>
                            {v.flag} {v.label}
                          </SelectItem>
                        ))
                      ) : (
                        browserLangVoices.length === 0 ? (
                          <SelectItem value="" disabled>{t("pages.settings.noVoicesForLang")}</SelectItem>
                        ) : (
                          browserLangVoices.map(v => (
                            <SelectItem key={v.name} value={v.name}>
                              {v.name}
                            </SelectItem>
                          ))
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isAzureEngine ? "Neural voices via Azure (server-proxied)" : "Voices installed on your device"}
                  </p>
                </div>
              </div>
            )}

            {voiceEngine === "elevenlabs" && (
              <div className="space-y-2">
                <Label>ElevenLabs Voice</Label>
                <Select value={selectedVoice || ELEVENLABS_VOICES[0].id} onValueChange={handleVoiceSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEVENLABS_VOICES.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} — {v.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Powered by ElevenLabs. Turbo v2.5 model.</p>
              </div>
            )}

            {voiceEngine === "streamelements" && (
              <div className="space-y-2">
                <Label>StreamElements Voice</Label>
                <Select value={selectedVoice || "Brian"} onValueChange={handleVoiceSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent>
                    {STREAMELEMENTS_VOICES.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Amazon Polly voices. Currently experiencing a provider-side outage — other engines are recommended for now.</p>
              </div>
            )}

            {voiceEngine === "voicerss" && (
              <div className="space-y-2">
                <Label>VoiceRSS Language</Label>
                <Select
                  value={voicerssLang}
                  onValueChange={(lang) => {
                    setVoicerssLang(lang);
                    saveSpeechPrefs({ voicerssLang: lang });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {[
                      { code: "en-us", label: "English (US)" },
                      { code: "en-gb", label: "English (UK)" },
                      { code: "fr-fr", label: "French" },
                      { code: "de-de", label: "German" },
                      { code: "es-es", label: "Spanish" },
                      { code: "pt-br", label: "Portuguese (Brazil)" },
                      { code: "it-it", label: "Italian" },
                      { code: "ja-jp", label: "Japanese" },
                      { code: "zh-cn", label: "Chinese (Mandarin)" },
                      { code: "ar-sa", label: "Arabic" },
                    ].map(l => (
                      <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">VoiceRSS — 350 requests/day on free tier.</p>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Fallback order:</strong> ElevenLabs → Azure → StreamElements → VoiceRSS → Browser</p>
              <p>If a provider fails or runs out of quota, the next one is tried automatically.</p>
            </div>
          </CardContent>
        </Card>

        {/* AI Paraphrasing Model Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Paraphrasing Model
            </CardTitle>
            <CardDescription>
              Choose which AI model handles text humanization on the Humanizer page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              {
                value: "auto",
                label: "⚡ Auto — Best Available",
                desc: "System picks best model automatically: Humanize AI Pro → Gemini (×4) → DeepSeek",
              },
              {
                value: "humanize_ai",
                label: "🎯 Humanize AI Pro — Highest Quality",
                desc: "Best humanization, uses your dedicated credits",
              },
              {
                value: "deepseek",
                label: "🇨🇳 DeepSeek — Fast & Efficient",
                desc: "Chinese AI, very fast, nearly free to run",
              },
              {
                value: "gemini",
                label: "🔵 Gemini — Google AI (×4 accounts)",
                desc: "4 Google accounts in rotation, always available, completely free",
              },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => handleParaphraseModelChange(opt.value)}
                className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  paraphraseModel === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                  paraphraseModel === opt.value ? "border-primary" : "border-muted-foreground"
                }`}>
                  {paraphraseModel === opt.value && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </button>
            ))}
            {!isAuthenticated && (
              <p className="text-xs text-muted-foreground text-center pt-2">Sign in to save your preference</p>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleReset} data-testid="button-reset">
            <RotateCcw className="mr-2 h-4 w-4" />
            {t("pages.settings.resetDefaults")}
          </Button>
          <Button onClick={handleSave} data-testid="button-save">
            <Save className="mr-2 h-4 w-4" />
            {t("pages.settings.saveSettings")}
          </Button>
        </div>

        {isAdmin && (
          <Card className="border-red-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Server className="h-5 w-5" />
                {t("pages.settings.adminTitle")}
                <Badge variant="outline" className="ml-auto border-red-500/50 bg-red-500/10 text-red-500 text-xs">
                  <Shield className="h-3 w-3 mr-1" />
                  {t("pages.settings.adminOnly")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t("pages.settings.adminDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {adminKeysLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-5">
                    {/* Group keys by their service category */}
                    {Array.from(new Set(adminKeys.map(e => e.group ?? "Other"))).map(group => (
                      <div key={group} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        {adminKeys.filter(e => (e.group ?? "Other") === group).map((entry) => (
                          <div key={entry.key} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-mono text-muted-foreground">{entry.key}</Label>
                              <span className="text-xs text-muted-foreground">{entry.label}</span>
                            </div>
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <Input
                                  type={adminKeyVisible[entry.key] ? "text" : "password"}
                                  placeholder={entry.hasValue ? entry.masked : t("pages.settings.notSetEnterValue")}
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
                    ))}
                  </div>

                  <Separator />

                  {/* Plan limits toggle */}
                  <div className="flex items-center justify-between py-1">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Require paid plan for scanning</Label>
                      <p className="text-xs text-muted-foreground">
                        When ON, only Pro/Business users can use AI detection and paraphrasing
                      </p>
                    </div>
                    <Switch
                      checked={requirePaidForScan}
                      onCheckedChange={handleRequirePaidToggle}
                      disabled={planLimitsLoading}
                    />
                  </div>

                  <Separator />

                  <div className="flex gap-3 justify-end">
                    <Button variant="outline" size="sm" onClick={fetchAdminKeys} disabled={adminKeysLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t("pages.settings.refresh")}
                    </Button>
                    <Button size="sm" onClick={handleSaveAdminKeys} disabled={adminKeysSaving}>
                      {adminKeysSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t("pages.settings.updateKeys")}
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
