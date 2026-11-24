import { useState } from "react";
import { AlertTriangle, CheckCircle2, Pencil, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export type ReviewItem = { para: number; orig: string; next: string; flagged: boolean; why?: string };

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// Side-by-side review of every rewritten paragraph. The reader decides what goes into the final text.
export function ParagraphReview({ items, paras, onChange }: { items: ReviewItem[]; paras: string[]; onChange: (para: number, text: string) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const flagged = items.filter((i) => i.flagged).length;
  const sorted = [...items].sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.para - b.para);

  return (
    <div className="rounded-lg border p-3 space-y-3" data-testid="rv-review">
      <div>
        <p className="text-sm font-medium">Review the rewrite</p>
        <p className="text-xs text-muted-foreground">
          {flagged ? `${flagged} of ${items.length} paragraphs may have changed what you wrote, so your original is used until you choose otherwise.` : `${items.length} paragraphs were rewritten.`}
          {" "}The automatic check can miss things: read each one.
        </p>
      </div>
      <div className="max-h-[560px] overflow-y-auto space-y-3 pr-1" data-testid="rv-review-list">
        {sorted.map((it) => {
          const cur = norm(paras[it.para] ?? "");
          const using = cur === norm(it.orig) ? "orig" : cur === norm(it.next) ? "next" : "edit";
          return (
            <div key={it.para} className="rounded-md border p-3 space-y-2" data-testid={`rv-item-${it.flagged ? "flagged" : "ok"}`}>
              <div className="flex flex-wrap items-center gap-2">
                {it.flagged
                  ? <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400"><AlertTriangle className="w-3 h-3 mr-1" />Check meaning</Badge>
                  : <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3 mr-1" />No change found</Badge>}
                {it.why && <span className="text-xs text-muted-foreground">{it.why}</span>}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div className={`rounded p-2 text-sm border ${using === "orig" ? "border-primary bg-primary/5" : ""}`}><p className="text-[11px] font-semibold text-muted-foreground mb-1">Your original</p>{it.orig}</div>
                <div className={`rounded p-2 text-sm border ${using === "next" ? "border-primary bg-primary/5" : ""}`}><p className="text-[11px] font-semibold text-muted-foreground mb-1">Rewrite</p>{it.next}</div>
              </div>
              {editing === it.para ? (
                <div className="space-y-2">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[90px]" data-testid="rv-edit-text" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { if (norm(draft)) onChange(it.para, norm(draft)); setEditing(null); }} data-testid="rv-edit-save">Save my version</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={using === "orig" ? "default" : "outline"} onClick={() => onChange(it.para, it.orig)} data-testid="rv-use-original"><Undo2 className="w-3.5 h-3.5 mr-1" />Use original</Button>
                  <Button size="sm" variant={using === "next" ? "default" : "outline"} onClick={() => onChange(it.para, it.next)} data-testid="rv-use-rewrite"><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Use rewrite</Button>
                  <Button size="sm" variant={using === "edit" ? "default" : "outline"} onClick={() => { setDraft(using === "edit" ? paras[it.para] : it.next); setEditing(it.para); }} data-testid="rv-edit"><Pencil className="w-3.5 h-3.5 mr-1" />Edit</Button>
                </div>
              )}
              {using === "edit" && editing !== it.para && <p className="text-sm rounded border border-primary bg-primary/5 p-2"><span className="block text-[11px] font-semibold text-muted-foreground">Your version</span>{paras[it.para]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
