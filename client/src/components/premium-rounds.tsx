import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Sparkles, Loader2, CheckCircle2, ArrowRight, ShieldCheck, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/hooks/use-toast";

// Premium rounds on the Humanizer page: the same pipeline as Rewrite & Verify (WriteHuman engine, fact guard,
// "fix then rehumanize", fresh retries, independent ZeroGPT score each round, Quetext final report).
// Measured on long academic documents in internal benchmarks (Quetext as the independent judge).
type Round = { round: number; score: number; quetext?: number | null };
type Job = {
  status: "running" | "done" | "failed"; progress: number; log: string[]; rounds: Round[]; before?: number | null; error?: string;
  result?: { text: string; before?: number | null; rounds: Round[]; finalCheck: { aiScore: number | null; plagiarism: number | null } | null };
};

const words = (t: string) => (t.trim().match(/\S+/g) || []).length;

export function PremiumRounds({ text, onUse }: { text: string; onUse: (rewritten: string) => void }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [perK, setPerK] = useState<number | null>(null);
  const [available, setAvailable] = useState(false);
  const [minWords, setMinWords] = useState(300);
  const [balance, setBalance] = useState<number | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/rv/engines").then((r) => r.json()).then((d) => {
      const p = (d.engines || []).find((e: any) => e.id === "premium");
      setPerK(p?.perK ?? null); setAvailable(Boolean(p?.available)); setMinWords(d.minWords || 300);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).then((d) => d && setBalance(d.balance)).catch(() => {});
  }, [isAuthenticated, job?.status]);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const w = words(text);
  const cost = perK ? Math.ceil((Math.max(w, minWords) / 1000) * perK) : null;

  const poll = (id: string) => {
    if (timer.current) clearInterval(timer.current);
    const tick = async () => {
      const r = await fetch(`/api/rv/job/${id}`).catch(() => null);
      if (!r || !r.ok) return;
      const j: Job = await r.json();
      setJob(j);
      if (j.status !== "running" && timer.current) { clearInterval(timer.current); timer.current = null; }
    };
    tick(); timer.current = setInterval(tick, 4000);
  };

  const start = async () => {
    if (w < 50) return toast({ title: "Add more text", description: "Premium rounds need at least 50 words.", variant: "destructive" });
    setStarting(true);
    try {
      const r = await fetch("/api/rv/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, engine: "premium", title: "Humanizer premium rounds" }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not start.");
      setJobId(d.jobId); setJob(null); poll(d.jobId);
    } catch (e: any) {
      toast({ title: "Premium rounds", description: e.message, variant: "destructive" });
    } finally { setStarting(false); }
  };

  if (!available) return null;
  const rounds = job?.result?.rounds || job?.rounds || [];
  const before = job?.result?.before ?? job?.before ?? null;
  const best = rounds.length ? Math.min(...rounds.map((r) => r.score)) : null;
  const final = job?.result?.finalCheck;
  const short = balance !== null && cost !== null && balance < cost;

  return (
    <Card className="border-violet-500/40" data-testid="card-premium-rounds">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base sm:text-lg flex flex-wrap items-center gap-2">Premium rounds <Badge variant="secondary" className="text-[10px]">Best results</Badge></CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Our strongest engine rewrites your text in several rounds. After each round an independent detector scores it, flagged parts are reworked, and your numbers and citations are protected. You get the best round plus a final AI and plagiarism report.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!jobId && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-1">
              <Coins className="w-4 h-4 shrink-0" />
              {cost !== null ? <span>{w} words: <span className="font-medium text-foreground">{cost} credits</span>{balance !== null && <> (you have {balance})</>}</span> : <span>Loading price...</span>}
            </div>
            {!isAuthenticated ? (
              <Link href="/rewrite-verify"><Button size="sm" variant="outline" className="w-full sm:w-auto">Sign in to use premium rounds</Button></Link>
            ) : short ? (
              <Link href="/rewrite-verify"><Button size="sm" className="w-full sm:w-auto">Buy credits or pay once <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
            ) : (
              <Button size="sm" onClick={start} disabled={starting || w < 50} className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700" data-testid="button-premium-rounds">
                {starting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Run premium rounds
              </Button>
            )}
          </div>
        )}

        {job && (
          <div className="space-y-3" data-testid="premium-progress">
            {job.status === "running" && <Progress value={job.progress} />}
            <div className="flex flex-wrap items-center gap-2">
              {before !== null && <Badge variant="outline" className="text-xs">Before: {before}% AI-like</Badge>}
              {rounds.map((r) => (
                <Badge key={r.round} variant="secondary" className={`text-xs ${best !== null && r.score === best && job.status === "done" ? "ring-1 ring-emerald-500" : ""}`}>Round {r.round}: {r.score}%{r.quetext != null ? ` · Quetext ${r.quetext}%` : ""}</Badge>
              ))}
              {job.status === "running" && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />{job.log[job.log.length - 1] || "Starting..."}</span>}
            </div>
            {job.status === "failed" && <p className="text-sm text-destructive">{job.error || "Something went wrong."} Your credits were refunded.</p>}
            {job.status === "done" && job.result && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-md bg-background p-2"><p className="text-[11px] text-muted-foreground">Before</p><p className="text-lg font-bold">{before ?? "-"}{before !== null && "%"}</p></div>
                  <div className="rounded-md bg-background p-2"><p className="text-[11px] text-muted-foreground">Best round</p><p className="text-lg font-bold text-emerald-600">{best ?? "-"}{best !== null && "%"}</p></div>
                  <div className="rounded-md bg-background p-2"><p className="text-[11px] text-muted-foreground">Final AI check</p><p className="text-lg font-bold">{final?.aiScore ?? "-"}{final?.aiScore != null && "%"}</p></div>
                  <div className="rounded-md bg-background p-2"><p className="text-[11px] text-muted-foreground">Plagiarism</p><p className="text-lg font-bold">{final?.plagiarism ?? "-"}{final?.plagiarism != null && "%"}</p></div>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />Round scores from ZeroGPT, final check from Quetext. Scores are estimates from independent detectors, not a guarantee; check the text and follow your university's rules.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button size="sm" onClick={() => onUse(job.result!.text)} data-testid="button-use-premium"><CheckCircle2 className="w-4 h-4 mr-1" />Use this text</Button>
                  <Button size="sm" variant="outline" onClick={() => { setJobId(null); setJob(null); }}>Run again</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
