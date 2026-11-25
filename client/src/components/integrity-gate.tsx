import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/components/auth-provider";

// Academic integrity confirmation, required once (per version) before using the writing tools.
// Signed-in acceptances are stored on the account (users/<uid>.integrityAccepted) so they can be shown later.
export const INTEGRITY_VERSION = 1;
const KEY = `academicgen_integrity_v${INTEGRITY_VERSION}`;
// Everything is behind the confirmation except the information pages.
const PUBLIC_PATHS = ["/", "/tutorials", "/download", "/about", "/contact", "/legal", "/pricing", "/settings", "/checkout"];

export function IntegrityGate() {
  const [location] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onTool = !PUBLIC_PATHS.some((p) => location === p || (p !== "/" && location.startsWith(p + "/")));
  const uid = isAuthenticated ? (user as any)?.uid ?? (user as any)?.id ?? null : null;
  // Per account: one person's confirmation never counts for another account on the same computer.
  const key = `${KEY}_${isAuthenticated ? uid || "account" : "guest"}`;

  useEffect(() => {
    setTicked(false); setError("");
    if (!onTool) { setOpen(false); return; }
    let local = false;
    try { local = localStorage.getItem(key) === "1"; } catch { /* storage blocked */ }
    if (local && (!isAuthenticated || uid)) { setOpen(false); return; }
    if (!isAuthenticated) { setOpen(true); return; }
    let live = true;
    fetch("/api/integrity").then((r) => (r.ok ? r.json() : null)).then((d) => {
      if (!live) return;
      if (d?.accepted) { try { localStorage.setItem(key, "1"); } catch { /* ignore */ } setOpen(false); }
      else setOpen(true);
    }).catch(() => live && setOpen(true));
    return () => { live = false; };
  }, [onTool, isAuthenticated, key]);

  const accept = async () => {
    setBusy(true); setError("");
    try {
      if (isAuthenticated) {
        const r = await fetch("/api/integrity/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: INTEGRITY_VERSION }) });
        if (!r.ok) throw new Error();
      }
      try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
      setOpen(false);
    } catch {
      setError("Your confirmation could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* cannot be dismissed without confirming */ }}>
      <DialogContent className="max-w-lg [&>button]:hidden" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} data-testid="integrity-gate">
        <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" />Academic integrity</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-foreground/90">
            <p>AcademicGen writes AI drafts and rewrites text. Before you use it, please confirm how you will use what it produces.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>I will not submit content generated or rewritten by AcademicGen as my own academic work, unless my institution allows AI assistance and I disclose it as my institution requires.</li>
              <li>I will check everything it produces and follow my institution's rules on AI.</li>
              <li>I understand that accounts that break these rules can be suspended.</li>
            </ul>
            <p className="text-xs text-muted-foreground">Full terms: <a className="underline" href="/legal#terms">Terms of use</a>.</p>
          </div>
        </DialogDescription>
        <label className="flex items-start gap-2 text-sm cursor-pointer pt-1">
          <Checkbox checked={ticked} onCheckedChange={(v) => setTicked(v === true)} data-testid="integrity-tick" className="mt-0.5" />
          <span>I confirm the three points above.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={accept} disabled={!ticked || busy} data-testid="integrity-accept">Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
