import { useState } from "react";
import { Link } from "wouter";
import { ScanSearch, Loader2, ShieldCheck, AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { TextInputWithUpload } from "@/components/text-input-with-upload";
import { ResultTools } from "@/components/result-tools";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/components/auth-provider";

interface CheckResult { score: number; engine: string; sentences: { text: string; flagged: boolean }[] }

const countWords = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

function band(score: number) {
  if (score > 60) return { label: "Likely AI-written", cls: "bg-red-500", icon: AlertTriangle };
  if (score > 25) return { label: "Partly AI-like", cls: "bg-amber-500", icon: AlertTriangle };
  return { label: "Reads as human-written", cls: "bg-emerald-500", icon: ShieldCheck };
}

export default function AiCheck() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const words = countWords(text);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/ai-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "The check failed.");
      setResult(d);
    } catch (e: any) {
      toast({ title: "AI check", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const b = result ? band(result.score) : null;
  const flaggedCount = result?.sentences.filter((s) => s.flagged).length ?? 0;

  return (
    <GeneratorLayout
      title="AI Check"
      description="See how AI-like your text reads, sentence by sentence, before you hand it in."
      icon={<ScanSearch className="w-6 h-6 text-white" />}
      gradient="from-sky-500 to-blue-600"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your text</CardTitle>
            <CardDescription>Paste or upload 40 to 10,000 words. Included in your plan (fair use).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <TextInputWithUpload value={text} onChange={setText} placeholder="Paste your paragraph, essay or chapter here..." minHeight="min-h-[320px]" testId="input-ai-check" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{words.toLocaleString("en-US")} words</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setText(""); setResult(null); }} disabled={!text}><Trash2 className="w-4 h-4 mr-1" />Clear</Button>
                <Button onClick={run} disabled={busy || words < 40 || !isAuthenticated} data-testid="button-ai-check">
                  {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ScanSearch className="w-4 h-4 mr-2" />}Check text
                </Button>
              </div>
            </div>
            {!isAuthenticated && <p className="text-sm text-muted-foreground">Please sign in to use AI Check.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Result</CardTitle>
            <CardDescription>Highlighted sentences read as AI-generated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && !busy && <p className="text-sm text-muted-foreground">Your score and highlighted sentences will appear here.</p>}
            {busy && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Checking...</p>}
            {result && b && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-4xl font-bold">{Math.round(result.score)}%</span>
                  <Badge className={`${b.cls} text-white gap-1`}><b.icon className="w-3 h-3" />{b.label}</Badge>
                  <span className="text-xs text-muted-foreground">{flaggedCount} of {result.sentences.length} sentences flagged</span>
                </div>
                <div className="max-h-[360px] overflow-auto rounded-md border p-3 text-sm leading-relaxed">
                  {result.sentences.map((s, i) => (
                    <span key={i} className={s.flagged ? "bg-red-200/70 dark:bg-red-900/50 rounded px-0.5" : ""}>{s.text} </span>
                  ))}
                </div>
                <ResultTools text={text} title="AI Check result" sentences={result.sentences} />
                <div className="rounded-md bg-muted p-3 text-sm space-y-2">
                  <p>Want it to read more naturally?</p>
                  <div className="flex flex-wrap gap-2">
                    <Link href="/humanize"><Button size="sm" variant="outline">Rewrite (included in plan)</Button></Link>
                    <Link href="/rewrite-verify"><Button size="sm"><Sparkles className="w-4 h-4 mr-1" />Rewrite &amp; Verify (premium)</Button></Link>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">No detector is perfect. Use the score as a guide, and follow your university's rules on AI use.</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </GeneratorLayout>
  );
}
