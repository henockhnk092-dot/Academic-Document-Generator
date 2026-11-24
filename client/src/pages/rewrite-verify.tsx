import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Loader2, Coins, CreditCard, Copy, Download, ShieldCheck, CheckCircle2, AlertTriangle, Trash2, PanelRightClose, PanelRightOpen, FileText, Maximize2 } from "lucide-react";
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
import { DocxViewer } from "@/components/docx-viewer";
import { ParagraphReview, type ReviewItem } from "@/components/paragraph-review";
import { isDocx, loadDocx, rebuildDocx, type DocxModel } from "@/lib/docx-layout";

interface Engine { id: string; label: string; perK: number; desc: string; available: boolean }
interface EnginesInfo { engines: Engine[]; minWords: number; maxWords: number; once: { markup: number; min: number }; launch?: { price: number; maxWords: number; slots: number; left: number } | null }
interface Job {
  id: string; engine: string; words: number; cost: number; status: "running" | "done" | "failed"; progress: number;
  log: string[]; rounds: { round: number; score: number; quetext?: number | null }[]; error?: string; before?: number | null;
  result?: { text: string; finalWords: number; before?: number | null; finalScore?: number | null; review?: ReviewItem[]; meaningChecked?: boolean; rounds: { round: number; score: number }[]; finalCheck: { aiScore: number | null; plagiarism: number | null; sources: { url: string; similar: number }[] } | null };
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
  const { isAuthenticated, isAdmin } = useAuth();
  const { toast } = useToast();
  const [info, setInfo] = useState<EnginesInfo | null>(null);
  const [engine, setEngine] = useState("premium");
  const [balance, setBalance] = useState<number | null>(null);
  const [showSide, setShowSide] = useState<boolean>(() => {
    try { return localStorage.getItem("rv-show-side") !== "0"; } catch { return true; }
  });
  const toggleSide = () => setShowSide((v) => {
    try { localStorage.setItem("rv-show-side", v ? "0" : "1"); } catch { /* ignore */ }
    return !v;
  });
  const [text, setText] = useState("");
  // "Keep layout": a dropped Word file comes back as the same document with only the paragraphs rewritten.
  const [docModel, setDocModel] = useState<DocxModel | null>(null);
  const jobDoc = useRef<DocxModel | null>(null);
  const [resultDoc, setResultDoc] = useState<Blob | null>(null);
  const [layoutNote, setLayoutNote] = useState("");
  const [viewer, setViewer] = useState<{ blob: Blob; title: string; name: string } | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  // The reader's choices: one entry per paragraph of the final text.
  const [paras, setParas] = useState<string[]>([]);
  const [recheck, setRecheck] = useState<{ score: number | null; stale: boolean; busy: boolean }>({ score: null, stale: false, busy: false });
  useEffect(() => {
    setParas((job?.result?.text || "").split(/\n\s*\n/).filter((x) => x.trim()));
    setRecheck({ score: null, stale: false, busy: false });
  }, [job?.result?.text]);
  const finalText = paras.length ? paras.join("\n\n") : job?.result?.text || "";
  const choosePara = (i: number, t: string) => { setParas((p) => p.map((x, k) => (k === i ? t : x))); setRecheck((r) => ({ ...r, stale: true })); };
  const recheckScore = async () => {
    setRecheck((r) => ({ ...r, busy: true }));
    try {
      const r = await fetch("/api/ai-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: finalText }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "The check failed.");
      setRecheck({ score: Number(d.score), stale: false, busy: false });
    } catch (e: any) {
      setRecheck((r) => ({ ...r, busy: false }));
      toast({ title: "AI check", description: e.message, variant: "destructive" });
    }
  };
  const layoutOk = !!docModel && text === docModel.text;
  const interceptFile = async (f: File) => {
    if (!isDocx(f)) { setDocModel(null); return null; }
    try { const m = await loadDocx(f); setDocModel(m); return m.text; } catch { setDocModel(null); return null; }
  };
  const outName = () => (jobDoc.current?.name || "document.docx").replace(/\.docx$/i, "") + " (rewritten).docx";
  const [busy, setBusy] = useState(false);
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
      jobDoc.current = layoutOk ? docModel : null; setResultDoc(null); setLayoutNote("");
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

  const copy = () => job?.result && navigator.clipboard.writeText(finalText).then(() => toast({ title: "Copied" }));
  const download = () => {
    if (!job?.result) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([finalText], { type: "text/plain;charset=utf-8" }));
    a.download = "academicgen-rewrite.txt";
    a.click();
  };
  const reset = () => { setJob(null); setResultDoc(null); setLayoutNote(""); jobDoc.current = null; localStorage.removeItem(JOB_KEY); };

  useEffect(() => {
    const m = jobDoc.current, t = job?.result && finalText;
    if (!m || !t) return;
    rebuildDocx(m, t).then((b) => (b ? setResultDoc(b) : setLayoutNote("The paragraphs changed during the rewrite, so this result is text only."))).catch(() => setLayoutNote("Could not rebuild the Word file; the text below is complete."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalText, job?.result]);

  const enough = isAdmin || (balance !== null && balance >= cost);

  return (
    <GeneratorLayout
      title="Rewrite & Verify"
      description="We rewrite your text in a natural academic style, check numbers, citations and meaning against your original, and let you review every change. You also get an AI and plagiarism report."
      icon={<Sparkles className="w-6 h-6 text-white" />}
      gradient="from-fuchsia-500 to-violet-600"
    >
      <div className="flex items-center justify-end gap-3 mb-3">
        {!showSide && isAuthenticated && (
          <span className="text-sm text-muted-foreground flex items-center gap-1"><Coins className="w-4 h-4" />{balance ?? "..."} credits</span>
        )}
        <Button variant="ghost" size="sm" onClick={toggleSide} aria-expanded={showSide} data-testid="button-rv-toggle-side">
          {showSide ? <PanelRightClose className="w-4 h-4 mr-2" /> : <PanelRightOpen className="w-4 h-4 mr-2" />}
          {showSide ? "Hide credits & info" : "Show credits & info"}
        </Button>
      </div>
      <div className={showSide ? "grid gap-6 lg:grid-cols-3" : "grid gap-6"}>
        <div className={showSide ? "lg:col-span-2 space-y-6" : "space-y-6"}>
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
                {job && (job.rounds.length > 0 || job.before != null) && (
                  <div className="flex flex-wrap gap-2" data-testid="rv-rounds">
                    {job.before != null && <Badge variant="outline">Before: {Math.round(job.before)}% AI-like</Badge>}
                    {job.rounds.map((r) => <Badge key={r.round} variant="secondary">Round {r.round}: {r.score}% AI-like{r.quetext != null ? ` · Quetext ${r.quetext}%` : ""}</Badge>)}
                  </div>
                )}
                {job && <ul className="text-sm text-muted-foreground space-y-1">{job.log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                {job?.result && (
                  <>
                    {(() => {
                      const rounds = job.result.rounds || [];
                      const first = job.result.before ?? job.before ?? (rounds.length ? rounds[0].score : null);
                      const best = recheck.score !== null ? recheck.score : job.result.finalScore !== undefined ? job.result.finalScore : rounds.length ? Math.min(...rounds.map((r) => r.score)) : null; // score of the delivered text
                      const fc = job.result.finalCheck;
                      const has = (v: any) => v !== null && v !== undefined;
                      return (
                        <div className="space-y-3">
                          {best !== null && (
                            <div className={`rounded-lg border-2 p-4 ${best <= 15 && fc?.aiScore != null && Number(fc.aiScore) <= 20 && recheck.score === null ? "border-emerald-500/50 bg-emerald-500/5" : "border-amber-500/50 bg-amber-500/5"}`}>
                              <p className="text-xs text-muted-foreground">AI-likeness of the final text (ZeroGPT)</p>
                              <p className="text-3xl font-bold">{Math.round(best)}%{first !== null && first > best ? <span className="text-base font-medium text-muted-foreground ml-2">from {Math.round(first)}%</span> : null}</p>
                            </div>
                          )}
                          {best !== null && fc?.aiScore != null && Math.abs(best - Number(fc.aiScore)) > 30 && <p className="text-sm text-amber-700 dark:text-amber-400">The two detectors disagree strongly. Do not rely on the lower score.</p>}
                          {fc && (has(fc.aiScore) || has(fc.plagiarism)) && (
                            <div className="grid sm:grid-cols-2 gap-3">
                              {has(fc.aiScore) && (<div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">AI-likeness, second detector (Quetext){recheck.score !== null || recheck.stale ? ", before your edits" : ""}</p><p className="text-xl font-semibold">{Math.round(Number(fc.aiScore))}%</p></div>)}
                              {has(fc.plagiarism) && (<div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Plagiarism similarity</p><p className="text-xl font-semibold">{fc.plagiarism}%</p></div>)}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">AI detectors disagree and none is perfect; strict checkers often score technical writing high. Read the text, make it your own, and follow your university's rules.</p>
                        </div>
                      );
                    })()}
                    {!!job.result.finalCheck?.sources?.length && (
                      <details className="text-sm"><summary className="cursor-pointer">Matched sources ({job.result.finalCheck.sources.length})</summary>
                        <ul className="mt-2 space-y-1">{job.result.finalCheck.sources.map((s, i) => <li key={i} className="truncate"><a className="underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a> ({s.similar}%)</li>)}</ul>
                      </details>
                    )}
                    {!!job.result.review?.length && (
                      <>
                        <ParagraphReview items={job.result.review} paras={paras} onChange={choosePara} />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="outline" onClick={recheckScore} disabled={recheck.busy} data-testid="rv-recheck">
                            {recheck.busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}Re-check the AI score
                          </Button>
                          {recheck.stale && <span className="text-xs text-amber-600">You changed the text, so the score above is out of date.</span>}
                        </div>
                      </>
                    )}
                    {resultDoc && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2" data-testid="rv-layout-result">
                        <p className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" />Your Word document, layout kept</p>
                        <p className="text-xs text-muted-foreground">Same figures, tables, images and headings as your file. It follows the choices you make above.</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => setViewer({ blob: resultDoc, title: "Rewritten document", name: outName() })} data-testid="rv-view-doc"><Maximize2 className="w-4 h-4 mr-1" />View full screen</Button>
                          <Button size="sm" variant="outline" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(resultDoc); a.download = outName(); a.click(); }} data-testid="rv-download-docx"><Download className="w-4 h-4 mr-1" />Download Word</Button>
                          {jobDoc.current && <Button size="sm" variant="ghost" onClick={() => setViewer({ blob: jobDoc.current!.original, title: "Original document", name: jobDoc.current!.name })} data-testid="rv-view-original">View original</Button>}
                        </div>
                      </div>
                    )}
                    {layoutNote && <p className="text-xs text-amber-600">{layoutNote}</p>}
                    <Textarea readOnly value={finalText} className="min-h-[320px]" />
                    <ResultTools text={finalText} title="Rewrite & Verify result" />
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
                <TextInputWithUpload value={text} onChange={setText} placeholder="Paste your text here..." minHeight="min-h-[300px]" testId="input-rv" interceptFile={interceptFile} />
                {docModel && (layoutOk ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs" data-testid="rv-layout-kept">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="flex-1">Word layout kept: figures, tables and images stay where they are. Only the paragraphs are rewritten.</span>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setViewer({ blob: docModel.original, title: "Original document", name: docModel.name })} data-testid="rv-preview-original"><Maximize2 className="w-3.5 h-3.5 mr-1" />Preview</Button>
                  </div>
                ) : <p className="text-xs text-muted-foreground">You edited the text, so the result will be text only (the Word layout is used only for an unchanged file).</p>)}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{words.toLocaleString("en-US")} words{tooLong ? " (too long, split it)" : ""}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setText(""); setDocModel(null); }} disabled={!text}><Trash2 className="w-4 h-4 mr-1" />Clear</Button>
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
                      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}{isAdmin ? "Run (admin, free)" : `Run with credits (${cost})`}
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

        {showSide && <div className="space-y-6">
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
              <p>2. Fact guard: numbers, citations and figure/table references are compared with your text.</p>
              <p>3. AI-likeness check each round, a meaning check, and your own side-by-side review.</p>
              <p>4. Final independent AI check and plagiarism scan with sources.</p>
            </CardContent>
          </Card>
        </div>}
      </div>
      {viewer && <DocxViewer blob={viewer.blob} title={viewer.title} fileName={viewer.name} onClose={() => setViewer(null)} />}
    </GeneratorLayout>
  );
}
