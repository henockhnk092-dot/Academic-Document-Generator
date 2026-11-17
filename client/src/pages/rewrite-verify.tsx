import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Coins, CreditCard, Copy, Download, ShieldCheck, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { TextInputWithUpload } from "@/components/text-input-with-upload";
import { ResultTools } from "@/components/result-tools";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

interface Engine { id: string; label: string; perK: number; desc: string; available: boolean }
interface EnginesInfo { engines: Engine[]; minWords: number; maxWords: number; once: { markup: number; min: number }; launch?: { price: number; maxWords: number; slots: number; left: number } | null }
interface Job {
  id: string; engine: string; words: number; cost: number; status: "running" | "done" | "failed"; progress: number;
  log: string[]; rounds: { round: number; score: number }[]; error?: string;
  result?: { text: string; finalWords: number; rounds: { round: number; score: number }[]; finalCheck: { aiScore: number | null; plagiarism: number | null; sources: { url: string; similar: number }[] } | null };
}

export const CREDIT_PACKS = [
  { tier: "credits_69", price: 69, credits: 69, note: "About 1,150 words" },
  { tier: "credits_299", price: 299, credits: 320, note: "About 5,400 words, 21 bonus" },
  { tier: "credits_799", price: 799, credits: 900, note: "About 15,000 words, best value" },
];

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const JOB_KEY = "academicgen_rv_job";

async function payfastRedirect(body: Record<string, string>): Promise<string | null> {
  const r = await fetch("/api/payfast/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return d.error || "Could not open the payment page.";
  const form = document.createElement("form");
  form.method = "POST";
  form.action = d.action;
  for (const [k, v] of Object.entries(d.fields as Record<string, string>)) {
    const i = document.createElement("input");
    i.type = "hidden"; i.name = k; i.value = v;
    form.appendChild(i);
  }
  document.body.appendChild(form);
  form.submit();
  return null;
}

export default function RewriteVerify() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState<EnginesInfo | null>(null);
  const [engine, setEngine] = useState("premium");
  const [balance, setBalance] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [waitingOrder, setWaitingOrder] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const words = countWords(text);

  const sel = info?.engines.find((e) => e.id === engine);
  const cost = useMemo(() => (sel ? Math.ceil((Math.max(words, info!.minWords) / 1000) * sel.perK) : 0), [sel, words, info]);
  const once = info ? Math.max(info.once.min, Math.ceil(cost * info.once.markup)) : 0;
  const tooShort = words < 50, tooLong = !!info && words > info.maxWords;
  const launchFits = !!info?.launch && info.launch.left > 0 && words <= info.launch.maxWords;

  const loadBalance = () => fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).then((d) => d && setBalance(d.balance)).catch(() => {});

  useEffect(() => {
    fetch("/api/rv/engines").then((r) => r.json()).then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadBalance();
    const params = new URLSearchParams(window.location.search);
    const order = params.get("order");
    if (order) setWaitingOrder(order);
    else {
      const saved = localStorage.getItem(JOB_KEY);
      if (saved) watchJob(saved);
    }
    return () => { if (poll.current) clearInterval(poll.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // After a one-time Payfast payment, wait for the payment notice to start the job.
  useEffect(() => {
    if (!waitingOrder) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const d = await fetch(`/api/rv/order/${waitingOrder}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (d?.jobId) { clearInterval(t); setWaitingOrder(null); watchJob(d.jobId); window.history.replaceState(null, "", "/rewrite-verify"); }
      else if (d?.status === "failed" || tries > 60) {
        clearInterval(t); setWaitingOrder(null); loadBalance();
        toast({ title: "Payment received", description: "We could not start the job automatically. The credits are in your wallet: press Run with credits.", variant: "destructive" });
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingOrder]);

  function watchJob(id: string) {
    localStorage.setItem(JOB_KEY, id);
    if (poll.current) clearInterval(poll.current);
    const tick = async () => {
      const r = await fetch(`/api/rv/job/${id}`);
      if (r.status === 404) { localStorage.removeItem(JOB_KEY); if (poll.current) clearInterval(poll.current); return; }
      const d: Job = await r.json().catch(() => null);
      if (!d) return;
      setJob(d);
      if (d.status !== "running") { if (poll.current) clearInterval(poll.current); loadBalance(); }
    };
    tick();
    poll.current = setInterval(tick, 4000);
  }

  const runWithCredits = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/rv/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, engine }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not start.");
      setBalance((b) => (b ?? 0) - d.cost);
      watchJob(d.jobId);
    } catch (e: any) {
      toast({ title: "Rewrite & Verify", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const payOnce = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/rv/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, engine }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not create the order.");
      const err = await payfastRedirect({ tier: "rv_once", orderId: d.orderId });
      if (err) throw new Error(err);
    } catch (e: any) {
      toast({ title: "Payment", description: e.message, variant: "destructive" });
      setBusy(false);
    }
  };

  const buyPack = async (tier: string) => {
    const err = await payfastRedirect({ tier });
    if (err) toast({ title: "Payment", description: err, variant: "destructive" });
  };

  const copy = () => job?.result && navigator.clipboard.writeText(job.result.text).then(() => toast({ title: "Copied" }));
  const download = () => {
    if (!job?.result) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([job.result.text], { type: "text/plain;charset=utf-8" }));
    a.download = "academicgen-rewrite.txt";
    a.click();
  };
  const reset = () => { setJob(null); localStorage.removeItem(JOB_KEY); };

  const enough = balance !== null && balance >= cost;

  return (
    <GeneratorLayout
      title="Rewrite & Verify"
      description="We rewrite your text in a natural academic style, keep your facts and citations, check it, rework the flagged parts, and give you a final AI and plagiarism report."
      icon={<Sparkles className="w-6 h-6 text-white" />}
      gradient="from-fuchsia-500 to-violet-600"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {(waitingOrder || job) ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {job?.status === "done" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : job?.status === "failed" ? <AlertTriangle className="w-5 h-5 text-red-500" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  {waitingOrder ? "Confirming your payment..." : job?.status === "done" ? "Your rewritten text is ready" : job?.status === "failed" ? "The job failed" : "Working on your text"}
                </CardTitle>
                {job && <CardDescription>{job.words.toLocaleString("en-US")} words, {info?.engines.find((e) => e.id === job.engine)?.label}, {job.cost} credits</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4">
                {job && job.status === "running" && <Progress value={job.progress} />}
                {job && job.rounds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {job.rounds.map((r) => <Badge key={r.round} variant="secondary">Round {r.round}: {r.score}% AI-like</Badge>)}
                  </div>
                )}
                {job && <ul className="text-sm text-muted-foreground space-y-1">{job.log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {job?.result && (
                  <>
                    {job.result.finalCheck && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {job.result.finalCheck.aiScore !== null && job.result.finalCheck.aiScore !== undefined && (<div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Final AI-likeness (independent check)</p><p className="text-2xl font-bold">{Math.round(Number(job.result.finalCheck.aiScore))}%</p></div>)}
                        {job.result.finalCheck.plagiarism !== null && job.result.finalCheck.plagiarism !== undefined && (<div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Plagiarism similarity</p><p className="text-2xl font-bold">{job.result.finalCheck.plagiarism}%</p></div>)}
                      </div>
                    )}
                    {!!job.result.finalCheck?.sources?.length && (
                      <details className="text-sm"><summary className="cursor-pointer">Matched sources ({job.result.finalCheck.sources.length})</summary>
                        <ul className="mt-2 space-y-1">{job.result.finalCheck.sources.map((s, i) => <li key={i} className="truncate"><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a> ({s.similar}%)</li>)}</ul>
                      </details>
                    )}
                    <Textarea readOnly value={job.result.text} className="min-h-[320px]" />
                    <ResultTools text={job.result.text} title="Rewrite & Verify result" />
                    <Button variant="ghost" onClick={reset}>New text</Button>
                    <p className="text-xs text-muted-foreground">Read it through and make it your own. Follow your university's rules on AI-assisted writing.</p>
                  </>
                )}
                {job?.status === "failed" && <><p className="text-sm text-red-600">{job.error}</p><Button variant="outline" onClick={reset}>Try again</Button></>}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your text</CardTitle>
                <CardDescription>Paste or upload 50 to {info?.maxWords.toLocaleString("en-US") ?? "5,000"} words per job. Headings, equations and reference lists are left as they are.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {info?.launch && info.launch.left > 0 && (
                  <div className="rounded-md bg-gradient-to-r from-fuchsia-500/10 to-violet-500/10 border border-fuchsia-500/30 p-3 text-sm">
                    <span className="font-semibold">Launch offer:</span> your first document (up to {info.launch.maxWords.toLocaleString("en-US")} words) for only R{info.launch.price}. {info.launch.left} of {info.launch.slots} places left.
                  </div>
                )}
                <TextInputWithUpload value={text} onChange={setText} placeholder="Paste your text here..." minHeight="min-h-[300px]" testId="input-rv" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{words.toLocaleString("en-US")} words{tooLong ? " (too long, split it)" : ""}</span>
                  <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}><Trash2 className="w-4 h-4 mr-1" />Clear</Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {info?.engines.map((e) => (
                    <button key={e.id} type="button" disabled={!e.available} onClick={() => setEngine(e.id)}
                      className={`text-left rounded-lg border p-3 transition ${engine === e.id ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/50"} ${!e.available ? "opacity-50 cursor-not-allowed" : ""}`}
                      data-testid={`engine-${e.id}`}>
                      <p className="font-medium text-sm">{e.label}</p>
                      <p className="text-xs text-muted-foreground">{e.desc}</p>
                      <p className="text-xs mt-1 font-semibold">{e.available ? `${e.perK} credits / 1,000 words` : "Coming soon"}</p>
                    </button>
                  ))}
                </div>

                {!isAuthenticated ? (
                  <p className="text-sm text-muted-foreground">Please sign in to use Rewrite &amp; Verify.</p>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Button onClick={runWithCredits} disabled={busy || tooShort || tooLong || !enough} data-testid="button-rv-credits">
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}Run with credits ({cost})
                    </Button>
                    <Button variant="outline" onClick={payOnce} disabled={busy || tooShort || tooLong} data-testid="button-rv-once">
                      <CreditCard className="w-4 h-4 mr-2" />{launchFits ? `Pay once: R${info!.launch!.price} (launch offer)` : `Pay once: R${once}`}
                    </Button>
                    {!enough && !tooShort && <span className="text-xs text-muted-foreground">Not enough credits: buy a pack (cheaper) or pay once for this text.</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Coins className="w-5 h-5" />Credits</CardTitle>
              <CardDescription>1 credit = R1. Credits never expire.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-3xl font-bold">{isAuthenticated ? (balance ?? "...") : "-"}<span className="text-sm font-normal text-muted-foreground ml-1">credits</span></p>
              {CREDIT_PACKS.map((p) => (
                <div key={p.tier} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div><p className="text-sm font-medium">{p.credits} credits</p><p className="text-xs text-muted-foreground">{p.note}</p></div>
                  <Button size="sm" onClick={() => buyPack(p.tier)} disabled={!isAuthenticated} data-testid={`buy-${p.tier}`}>R{p.price}</Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Secure payment by Payfast: card, Instant EFT or SnapScan. If a job fails, its credits are refunded automatically.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5" />What you get</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1 text-muted-foreground">
              <p>1. Natural academic rewrite with the engine you choose.</p>
              <p>2. Fact guard: numbers, citations and figure/table references are kept exactly.</p>
              <p>3. AI-likeness check, then only the flagged parts are reworked (up to 4 rounds).</p>
              <p>4. Final independent AI check and plagiarism scan with sources.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </GeneratorLayout>
  );
}
