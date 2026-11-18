import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Download as DownloadIcon, Monitor, Smartphone, Apple, Laptop, Globe, CheckCircle2, Share, PlusSquare, MoreVertical, QrCode, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// The APK is small enough for Cloudflare Pages. Desktop installers (110+ MB) live on GitHub Releases,
// because Cloudflare Pages caps files at 25 MB. Set DESKTOP_READY once the release is published.
export const ANDROID_URL = "/downloads/AcademicGen.apk";
const RELEASES = "https://github.com/henockhnk092-dot/academicgen-apps/releases/latest/download";
export const WINDOWS_URL = `${RELEASES}/AcademicGen-Setup.exe`;
export const LINUX_URL = `${RELEASES}/AcademicGen-linux-x64.tar.gz`;
export const DESKTOP_READY = false;

type Platform = "windows" | "android" | "ios" | "mac" | "linux" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  if (/linux|cros/i.test(ua)) return "linux";
  return "other";
}

// Chrome, Edge and Android fire beforeinstallprompt when the site can be installed as an app.
function useInstallPrompt() {
  const [evt, setEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  const install = async () => { if (!evt) return false; evt.prompt(); const r = await evt.userChoice; setEvt(null); if (r?.outcome === "accepted") setInstalled(true); return true; };
  return { canInstall: !!evt, installed, install };
}

type Step = { icon: JSX.Element; text: string };
type PlatformInfo = { id: Platform; name: string; icon: JSX.Element; tag: string; desc: string; steps: Step[] };

const PLATFORMS: PlatformInfo[] = [
  { id: "windows", name: "Windows", icon: <Monitor className="w-6 h-6" />, tag: "Desktop app (.exe)",
    desc: "A desktop app with its own window, Start menu entry and desktop shortcut. Windows 10 and 11, 64-bit.",
    steps: [
      { icon: <DownloadIcon className="w-4 h-4" />, text: "Download AcademicGen-Setup.exe." },
      { icon: <ShieldCheck className="w-4 h-4" />, text: "If Windows SmartScreen appears, click More info, then Run anyway." },
      { icon: <CheckCircle2 className="w-4 h-4" />, text: "Follow the installer, then open AcademicGen from the Start menu." },
    ] },
  { id: "android", name: "Android", icon: <Smartphone className="w-6 h-6" />, tag: "App (.apk), Android 5.1 or later",
    desc: "The AcademicGen app for Android phones and tablets, about 4 MB. Prefer no file? Install it from Chrome instead.",
    steps: [
      { icon: <DownloadIcon className="w-4 h-4" />, text: "Download AcademicGen.apk on your phone, or scan the QR code from a computer." },
      { icon: <ShieldCheck className="w-4 h-4" />, text: "Open the file. If Android asks, allow installs from your browser for this app." },
      { icon: <MoreVertical className="w-4 h-4" />, text: "No file? In Chrome tap the menu (three dots), then Install app." },
    ] },
  { id: "ios", name: "iPhone and iPad", icon: <Apple className="w-6 h-6" />, tag: "Add to Home Screen",
    desc: "Works in Safari on iOS and iPadOS 16.4 or later, full screen with its own icon.",
    steps: [
      { icon: <Globe className="w-4 h-4" />, text: "Open www.academicgen.com in Safari." },
      { icon: <Share className="w-4 h-4" />, text: "Tap the Share button at the bottom of the screen." },
      { icon: <PlusSquare className="w-4 h-4" />, text: "Choose Add to Home Screen, then Add." },
    ] },
  { id: "mac", name: "macOS", icon: <Laptop className="w-6 h-6" />, tag: "Install from your browser",
    desc: "Add AcademicGen to your Dock from Safari, Chrome or Edge. It opens in its own window.",
    steps: [
      { icon: <Globe className="w-4 h-4" />, text: "Safari: File, then Add to Dock." },
      { icon: <DownloadIcon className="w-4 h-4" />, text: "Chrome or Edge: click the install icon in the address bar." },
      { icon: <CheckCircle2 className="w-4 h-4" />, text: "Open AcademicGen from the Dock or Launchpad." },
    ] },
  { id: "linux", name: "Linux and Chromebook", icon: <Monitor className="w-6 h-6" />, tag: "Desktop app (.tar.gz) or browser install",
    desc: "A 64-bit desktop app for Linux, or install from Chrome, Edge or Chromium on Linux and Chromebook.",
    steps: [
      { icon: <DownloadIcon className="w-4 h-4" />, text: "Download AcademicGen-linux-x64.tar.gz and extract it." },
      { icon: <CheckCircle2 className="w-4 h-4" />, text: "Run ./academicgen inside the extracted folder." },
      { icon: <Globe className="w-4 h-4" />, text: "Chromebook: open www.academicgen.com in Chrome and click Install app." },
    ] },
];

const BENEFITS = [
  { icon: <Zap className="w-5 h-5" />, title: "Opens in one tap", text: "Start a report, AI Check or rewrite straight from your home screen or desktop." },
  { icon: <RefreshCw className="w-5 h-5" />, title: "Always up to date", text: "The app loads the latest AcademicGen, so new features arrive without reinstalling." },
  { icon: <ShieldCheck className="w-5 h-5" />, title: "Same account", text: "Sign in with the same account. Your projects, plan and credits are all there." },
];

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>("other");
  const { canInstall, installed, install } = useInstallPrompt();
  useEffect(() => setPlatform(detectPlatform()), []);

  const primary = PLATFORMS.find((p) => p.id === platform);
  const installButton = (full = false) => installed ? (
    <Button size="sm" variant="outline" disabled className={full ? "w-full" : ""}><CheckCircle2 className="w-4 h-4 mr-1" />Installed</Button>
  ) : canInstall ? (
    <Button size="sm" className={full ? "w-full" : ""} onClick={install} data-testid="button-install-pwa"><DownloadIcon className="w-4 h-4 mr-1" />Install app</Button>
  ) : null;

  const fileButton = (href: string, label: string, id: string, full: boolean) => (
    <a href={href} className={full ? "block w-full" : "block"} data-testid={`link-download-${id}`}>
      <Button size="sm" className={full ? "w-full" : "w-full sm:w-auto"}><DownloadIcon className="w-4 h-4 mr-1" />{label}</Button>
    </a>
  );
  const soon = (label: string, full: boolean) => (
    <div className={`flex flex-col gap-2 ${full ? "w-full" : ""}`}>
      <Button size="sm" variant="outline" disabled className={full ? "w-full" : "w-full sm:w-auto"}>{label} coming soon</Button>
      {installButton(full)}
    </div>
  );
  const actionFor = (p: PlatformInfo, full = false) =>
    p.id === "windows" ? (DESKTOP_READY ? fileButton(WINDOWS_URL, "Download for Windows", "windows", full) : soon("Windows installer", full))
    : p.id === "linux" ? (DESKTOP_READY ? fileButton(LINUX_URL, "Download for Linux", "linux", full) : soon("Linux app", full))
    : p.id === "android" ? (
      <div className="flex flex-col sm:flex-row gap-2 w-full">
        {fileButton(ANDROID_URL, "Download APK", "android", full)}
        {p.id === platform && installButton(full)}
      </div>
    )
    : (p.id === platform ? installButton(full) : null);

  return (
    <GeneratorLayout
      title="Download the app"
      description="Get AcademicGen on your phone, tablet or computer. Free to install, same account everywhere."
      icon={<DownloadIcon className="w-6 h-6 text-white" />}
      gradient="from-sky-500 to-indigo-600"
    >
      <div className="space-y-6 sm:space-y-8">
        {/* Recommended for this device */}
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-4 sm:p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="space-y-3 min-w-0">
              <Badge variant="secondary">Recommended for your device</Badge>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                {primary ? `AcademicGen for ${primary.name}` : "AcademicGen on every device"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {primary ? primary.desc : "Choose your device below. The app is free and uses your AcademicGen account."}
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {primary && actionFor(primary)}
                {!primary && installButton()}
                <Link href="/pricing"><Button size="sm" variant="outline" className="w-full sm:w-auto">See plans</Button></Link>
              </div>
              {primary && (primary.id === "ios" || primary.id === "mac") && !canInstall && !installed && (
                <p className="text-xs text-muted-foreground">Follow the steps for {primary.name} below to install it.</p>
              )}
            </div>
            <div className="hidden md:flex flex-col items-center gap-2 rounded-xl border bg-white p-3">
              <img src="/qr-download.svg" alt="QR code to open the AcademicGen download page on your phone" className="w-36 h-36" width={144} height={144} />
              <span className="text-xs text-slate-600 flex items-center gap-1"><QrCode className="w-3.5 h-3.5" />Scan to get it on your phone</span>
            </div>
          </div>
        </Card>

        {/* All platforms */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">All devices</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {[...PLATFORMS].sort((a, b) => Number(b.id === platform) - Number(a.id === platform)).map((p) => (
              <Card key={p.id} className={`flex flex-col ${p.id === platform ? "ring-2 ring-primary" : ""}`} data-testid={`card-platform-${p.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{p.icon}</div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">{p.name}</CardTitle>
                      <CardDescription className="text-xs">{p.tag}</CardDescription>
                    </div>
                    {p.id === platform && <Badge className="ml-auto shrink-0">This device</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-4">
                  <p className="text-sm text-muted-foreground">{p.desc}</p>
                  <ol className="space-y-2">
                    {p.steps.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold">{i + 1}</span>
                        <span className="min-w-0">{s.text}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto">{actionFor(p, true)}</div>
                </CardContent>
              </Card>
            ))}
            {/* Web card completes the grid */}
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Globe className="w-6 h-6" /></div>
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">Web</CardTitle>
                    <CardDescription className="text-xs">No install needed</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <p className="text-sm text-muted-foreground">Use AcademicGen in any modern browser on any device. Everything the app does, the website does too.</p>
                <div className="mt-auto"><Link href="/"><Button size="sm" variant="outline" className="w-full">Open AcademicGen</Button></Link></div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Why install */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          {BENEFITS.map((b) => (
            <Card key={b.title}>
              <CardContent className="p-4 sm:p-5 flex items-start gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{b.icon}</div>
                <div className="min-w-0">
                  <p className="font-medium">{b.title}</p>
                  <p className="text-sm text-muted-foreground">{b.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* QR on small screens is pointless (you are already on the phone), so show a short note instead */}
        <Card className="md:hidden">
          <CardContent className="p-4 text-sm text-muted-foreground">
            On a computer? Open <span className="font-medium text-foreground">academicgen.com/download</span> there to get the Windows app or install it from your browser.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Questions</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div><p className="font-medium">Is the app free?</p><p className="text-muted-foreground">Yes. Installing is free. You get the same free allowance and paid plans as on the website.</p></div>
            <div><p className="font-medium">Do I need internet?</p><p className="text-muted-foreground">Yes. Writing, checking and rewriting run on our servers, so you need a connection.</p></div>
            <div><p className="font-medium">How do I uninstall it?</p><p className="text-muted-foreground">Windows: Settings, Apps, AcademicGen, Uninstall. Phones: press and hold the icon and remove it. Your account and projects stay safe.</p></div>
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
