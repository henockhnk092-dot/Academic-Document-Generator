import { useState } from "react";
import { SearchCheck, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Issue { type: string; detail: string; quote?: string }
interface Review { issues: Issue[]; corrected: string; summary: string; factCheck: string[] }

// After a rewrite, Gemini compares it with the original: meaning changes, lost facts or citations, grammar.
// "Apply corrections" fixes only those problems and keeps the new wording (no copying back from the source).
export function RewriteReview({ original, rewritten, onApply }: { original: string; rewritten: string; onApply: (text: string) => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<Review | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/humanize/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ original, rewritten }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "The review failed.");
      setReview(d);
    } catch (e: any) {
      toast({ title: "Review", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!review) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3">
        <p className="text-sm text-muted-foreground flex-1 min-w-[200px]">Check that the rewrite still says what you meant: facts, citations, meaning and grammar.</p>
        <Button size="sm" variant="secondary" onClick={run} disabled={busy || !original || !rewritten} data-testid="button-review-rewrite">
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <SearchCheck className="w-4 h-4 mr-1" />}Review with AI
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium flex items-center gap-2"><SearchCheck className="w-4 h-4" />AI review: {review.issues.length ? `${review.issues.length} thing(s) to fix` : "no problems found"}</p>
        <Button size="icon" variant="ghost" onClick={() => setReview(null)} aria-label="Close review"><X className="w-4 h-4" /></Button>
      </div>
      {review.summary && <p className="text-sm text-muted-foreground">{review.summary}</p>}
      {review.issues.length > 0 && (
        <ul className="text-sm space-y-1 max-h-48 overflow-auto">
          {review.issues.map((i, k) => (
            <li key={k} className="flex gap-2">
              <Badge variant="outline" className="shrink-0 capitalize">{i.type}</Badge>
              <span>{i.detail}{i.quote ? <span className="text-muted-foreground"> ("{i.quote}")</span> : null}</span>
            </li>
          ))}
        </ul>
      )}
      {review.issues.length > 0 && review.corrected && review.corrected.trim() !== rewritten.trim() && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { onApply(review.corrected); setReview(null); toast({ title: "Corrections applied" }); }} data-testid="button-apply-review">
            <Check className="w-4 h-4 mr-1" />Apply corrections
          </Button>
          <span className="text-xs text-muted-foreground self-center">Only the problems above are fixed; your new wording is kept.</span>
        </div>
      )}
    </div>
  );
}
