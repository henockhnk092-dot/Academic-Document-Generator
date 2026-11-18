import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Users, Hash, Sparkles, Send, Loader2, MoreVertical, Reply, Copy, Trash2, Flag, ShieldCheck, X, AtSign, MessageSquare, BookOpen, GraduationCap, LifeBuoy, ChevronUp, AlertCircle } from "lucide-react";
import { GeneratorLayout } from "@/components/generator-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";
import { AuthDialog } from "@/components/auth-dialog";
import { useToast } from "@/hooks/use-toast";

type Room = { id: string; name: string; desc: string };
type Msg = { id: string; uid: string; name: string; photo: string | null; text: string; kind: "user" | "ai"; replyTo: string | null; createdAt: number; deleted?: boolean };
type Me = { uid: string; name: string; admin: boolean };

const ROOMS: Room[] = [
  { id: "general", name: "General", desc: "Say hello, share wins and talk about student life." },
  { id: "writing", name: "Reports and theses", desc: "Structure, chapters, methodology and academic style." },
  { id: "research", name: "Research and references", desc: "Finding sources, citation styles and literature reviews." },
  { id: "help", name: "AcademicGen help", desc: "Questions and tips about the AcademicGen tools." },
];
const ROOM_ICON: Record<string, JSX.Element> = {
  general: <MessageSquare className="w-4 h-4" />, writing: <GraduationCap className="w-4 h-4" />,
  research: <BookOpen className="w-4 h-4" />, help: <LifeBuoy className="w-4 h-4" />,
};
const MAX_LEN = 1000, POLL_MS = 4000;

const RULES = [
  "Be kind and stay on study topics.",
  "No adverts, links or selling.",
  "No writing or buying assignments for others.",
  "No phone numbers, e-mails or personal details.",
  "Write your own work and follow your university's rules on AI.",
];

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
function timeLabel(ms: number) {
  const d = new Date(ms), now = new Date();
  const same = d.toDateString() === now.toDateString();
  return same ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
// Stable soft colour per member for avatars
const HUES = ["bg-sky-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-teal-500", "bg-orange-500", "bg-indigo-500"];
const hueOf = (uid: string) => HUES[Array.from(uid).reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

function Avatar({ m }: { m: Msg }) {
  if (m.kind === "ai") return <div className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>;
  if (m.photo) return <img src={m.photo} alt="" referrerPolicy="no-referrer" className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full object-cover" />;
  return <div className={`w-8 h-8 sm:w-9 sm:h-9 shrink-0 rounded-full ${hueOf(m.uid)} text-white text-xs font-semibold flex items-center justify-center`}>{initials(m.name)}</div>;
}

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [room, setRoom] = useState("general");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [online, setOnline] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAt = useRef(0), lastPoll = useRef(0), stick = useRef(true), roomRef = useRef(room);
  roomRef.current = room;

  const merge = useCallback((incoming: Msg[], removed: string[] = []) => {
    setMsgs((cur) => {
      const map = new Map(cur.map((m) => [m.id, m]));
      for (const m of incoming) map.set(m.id, m);
      for (const id of removed) { const m = map.get(id); if (m) map.set(id, { ...m, deleted: true, text: "" }); }
      const all = Array.from(map.values()).sort((a, b) => a.createdAt - b.createdAt);
      if (all.length) lastAt.current = Math.max(lastAt.current, all[all.length - 1].createdAt);
      return all;
    });
  }, []);

  const load = useCallback(async (r: string) => {
    setLoading(true); setError(null); setMsgs([]); lastAt.current = 0; stick.current = true;
    try {
      const res = await fetch(`/api/community?room=${r}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not load the chat.");
      if (roomRef.current !== r) return;
      setMe(d.me); setOnline(d.online); setMore(d.more); lastPoll.current = d.now; merge(d.messages);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [merge]);

  const poll = useCallback(async () => {
    if (document.hidden) return;
    const r = roomRef.current;
    try {
      const res = await fetch(`/api/community?room=${r}&after=${lastAt.current || 1}&since=${lastPoll.current || 1}`);
      if (!res.ok) return;
      const d = await res.json();
      if (roomRef.current !== r) return;
      setOnline(d.online); lastPoll.current = d.now; merge(d.messages, d.removed);
    } catch { /* offline: try again next tick */ }
  }, [merge]);

  useEffect(() => { if (isAuthenticated) load(room); }, [isAuthenticated, room, load]);
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setInterval(poll, POLL_MS);
    return () => clearInterval(t);
  }, [isAuthenticated, poll]);

  // keep the view pinned to the newest message unless the reader scrolled up
  useLayoutEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [msgs]);
  const onScroll = () => { const el = listRef.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; };

  const loadOlder = async () => {
    const first = msgs[0]; if (!first) return;
    const el = listRef.current, h = el?.scrollHeight || 0;
    stick.current = false;
    const res = await fetch(`/api/community?room=${room}&before=${first.createdAt}`);
    const d = await res.json();
    if (res.ok) { setMore(d.messages.length >= 60); merge(d.messages); requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - h; }); }
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setBlocked(null);
    try {
      const res = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", room, text: t, replyTo: replyTo?.id || null }) });
      const d = await res.json();
      if (res.status === 422 && d.blocked) { setBlocked(d.reason); return; }
      if (!res.ok) throw new Error(d.error || "Could not send.");
      setText(""); setReplyTo(null); stick.current = true;
      await poll();
      if (d.answered) toast({ title: "AcademicGen AI replied", description: "Its answer is in the chat." });
    } catch (e: any) {
      toast({ title: "Message not sent", description: e.message, variant: "destructive" });
    } finally { setSending(false); inputRef.current?.focus(); }
  };

  const act = async (action: "delete" | "report", m: Msg) => {
    const res = await fetch("/api/community", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, room, id: m.id }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return toast({ title: "Not possible", description: d.error, variant: "destructive" });
    if (action === "delete") merge([], [m.id]);
    toast({ title: action === "delete" ? "Message deleted" : "Thanks for reporting", description: action === "report" ? "Messages reported by several members are hidden for review." : undefined });
  };

  const byId = new Map(msgs.map((m) => [m.id, m]));
  const current = ROOMS.find((r) => r.id === room)!;

  // ── signed-out view ──
  if (!isAuthenticated) {
    return (
      <GeneratorLayout title="Community" description="Chat with other students about writing, research and studying. Every message is reviewed by AI to keep it safe."
        icon={<Users className="w-6 h-6 text-white" />} gradient="from-emerald-500 to-teal-600">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card>
            <CardContent className="p-5 sm:p-8 space-y-5">
              <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3.5 h-3.5" />AI-reviewed community</Badge>
              <h2 className="text-xl sm:text-2xl font-bold leading-tight">Study together, ask questions and share tips</h2>
              <p className="text-sm sm:text-base text-muted-foreground">Join channels for reports and theses, research and references, and AcademicGen help. Tag <span className="font-medium text-foreground">@AcademicGen</span> to get a quick answer from the AI.</p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                {ROOMS.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="w-8 h-8 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">{ROOM_ICON[r.id]}</div>
                    <div className="min-w-0"><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
                  </div>
                ))}
              </div>
              <Button onClick={() => setAuthOpen(true)} className="w-full sm:w-auto" data-testid="button-community-signin">Sign in to join the community</Button>
            </CardContent>
          </Card>
          <RulesCard />
        </div>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </GeneratorLayout>
    );
  }

  return (
    <GeneratorLayout title="Community" description="Chat with other students about writing, research and studying. Every message is reviewed by AI to keep it safe."
      icon={<Users className="w-6 h-6 text-white" />} gradient="from-emerald-500 to-teal-600">
      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_270px]">
        {/* Channels: sidebar on desktop, scrollable chips on phones and tablets */}
        <div className="lg:hidden -mx-1 overflow-x-auto">
          <div className="flex gap-2 px-1 pb-1 w-max">
            {ROOMS.map((r) => (
              <button key={r.id} onClick={() => setRoom(r.id)} data-testid={`chip-room-${r.id}`}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${room === r.id ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
                {ROOM_ICON[r.id]}{r.name}
              </button>
            ))}
          </div>
        </div>
        <Card className="hidden lg:block h-fit">
          <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">Channels</CardTitle></CardHeader>
          <CardContent className="space-y-1 px-2 pb-3">
            {ROOMS.map((r) => (
              <button key={r.id} onClick={() => setRoom(r.id)} data-testid={`button-room-${r.id}`}
                className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-left transition-colors ${room === r.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}>
                <Hash className="w-4 h-4 shrink-0 opacity-70" /><span className="truncate">{r.name}</span>
              </button>
            ))}
            <div className="flex items-center gap-2 px-2.5 pt-3 text-xs text-muted-foreground"><span className="w-2 h-2 rounded-full bg-emerald-500" />{online} online now</div>
          </CardContent>
        </Card>

        {/* Chat */}
        <Card className="flex flex-col min-w-0 h-[calc(100dvh-15.5rem)] min-h-[440px] sm:h-[calc(100dvh-16rem)] md:h-[calc(100dvh-22rem)] lg:h-[calc(100dvh-17.5rem)] overflow-hidden">
          <div className="flex items-center gap-3 border-b px-3 sm:px-4 py-2.5">
            <div className="w-8 h-8 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center">{ROOM_ICON[room]}</div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm sm:text-base truncate">{current.name}</p>
              <p className="text-xs text-muted-foreground truncate">{current.desc}</p>
            </div>
            <Badge variant="outline" className="shrink-0 gap-1 text-[11px]"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{online}<span className="hidden sm:inline"> online</span></Badge>
          </div>

          <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 space-y-1" data-testid="list-messages">
            {more && <div className="flex justify-center pb-2"><Button size="sm" variant="ghost" onClick={loadOlder}><ChevronUp className="w-4 h-4 mr-1" />Earlier messages</Button></div>}
            {loading && <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>}
            {error && <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
            {!loading && !error && msgs.filter((m) => !m.deleted).length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 text-muted-foreground gap-2">
                <MessageSquare className="w-8 h-8 opacity-50" />
                <p className="text-sm">No messages here yet. Start the conversation, or tag @AcademicGen with a question.</p>
              </div>
            )}
            {msgs.map((m, i) => {
              if (m.deleted) return null;
              const mine = me?.uid === m.uid;
              const prev = msgs[i - 1];
              const grouped = prev && !prev.deleted && prev.uid === m.uid && m.createdAt - prev.createdAt < 5 * 60_000 && !m.replyTo;
              const parent = m.replyTo ? byId.get(m.replyTo) : undefined;
              return (
                <div key={m.id} className={`group flex gap-2 sm:gap-3 ${mine ? "flex-row-reverse" : ""} ${grouped ? "mt-0.5" : "mt-3"}`} data-testid={`msg-${m.id}`}>
                  <div className="w-8 sm:w-9 shrink-0">{!grouped && <Avatar m={m} />}</div>
                  <div className={`min-w-0 max-w-[85%] sm:max-w-[75%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!grouped && (
                      <div className={`flex items-center gap-2 mb-0.5 text-xs ${mine ? "flex-row-reverse" : ""}`}>
                        <span className="font-medium text-foreground truncate max-w-[160px]">{mine ? "You" : m.name}</span>
                        {m.kind === "ai" && <Badge className="h-4 px-1.5 text-[10px] bg-violet-600 hover:bg-violet-600">AI</Badge>}
                        <span className="text-muted-foreground">{timeLabel(m.createdAt)}</span>
                      </div>
                    )}
                    <div className={`flex items-start gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                      <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                        m.kind === "ai" ? "bg-violet-500/10 border border-violet-500/30" : mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {parent && (
                          <div className={`mb-1.5 border-l-2 pl-2 text-xs opacity-80 ${mine ? "border-primary-foreground/60" : "border-primary/60"}`}>
                            <span className="font-medium">{parent.uid === me?.uid ? "You" : parent.name}</span>: {parent.deleted ? "message removed" : parent.text.slice(0, 90)}{parent.text.length > 90 ? "..." : ""}
                          </div>
                        )}
                        {m.text}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="mt-1 p-1 rounded text-muted-foreground hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="Message actions">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={mine ? "end" : "start"}>
                          <DropdownMenuItem onClick={() => { setReplyTo(m); inputRef.current?.focus(); }}><Reply className="w-4 h-4 mr-2" />Reply</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(m.text)}><Copy className="w-4 h-4 mr-2" />Copy text</DropdownMenuItem>
                          {(mine || me?.admin) && <DropdownMenuItem onClick={() => act("delete", m)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>}
                          {!mine && m.kind !== "ai" && <DropdownMenuItem onClick={() => act("report", m)}><Flag className="w-4 h-4 mr-2" />Report</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Composer */}
          <div className="border-t p-2 sm:p-3 space-y-2 bg-card">
            {replyTo && (
              <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs">
                <Reply className="w-3.5 h-3.5 shrink-0" /><span className="truncate flex-1">Replying to <span className="font-medium">{replyTo.uid === me?.uid ? "yourself" : replyTo.name}</span>: {replyTo.text.slice(0, 80)}</span>
                <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {blocked && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-xs" data-testid="text-blocked">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" /><span className="flex-1">{blocked} You can edit your message and try again.</span>
                <button onClick={() => setBlocked(null)} aria-label="Dismiss"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea ref={inputRef} value={text} maxLength={MAX_LEN} rows={1} data-testid="input-message"
                onChange={(e) => { setText(e.target.value); if (blocked) setBlocked(null); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                placeholder={`Message #${current.name}`} className="min-h-[42px] max-h-36 resize-none text-sm" />
              <Button size="icon" className="h-[42px] w-[42px] shrink-0" onClick={send} disabled={!text.trim() || sending} aria-label="Send" data-testid="button-send">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <button onClick={() => { setText((t) => (t.includes("@AcademicGen") ? t : "@AcademicGen " + t)); inputRef.current?.focus(); }}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 hover:bg-muted" data-testid="button-ask-ai">
                <AtSign className="w-3 h-3" />Ask AcademicGen AI
              </button>
              <span className="flex items-center gap-1 min-w-0">
                {sending ? <><ShieldCheck className="w-3 h-3 shrink-0" /><span className="truncate">AI is reviewing your message...</span></> : <span className="hidden sm:inline">Enter to send, Shift+Enter for a new line</span>}
                <span className="tabular-nums">{text.length}/{MAX_LEN}</span>
              </span>
            </div>
          </div>
        </Card>

        {/* Guidelines: right column on wide screens, below the chat otherwise */}
        <div className="lg:col-span-2 xl:col-span-1"><RulesCard /></div>
      </div>
    </GeneratorLayout>
  );
}

function RulesCard() {
  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" />Community guidelines</CardTitle>
        <CardDescription className="text-xs">AI reviews every message before it appears. Messages that break a rule are not posted, and you see why.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {RULES.map((r) => <li key={r} className="flex items-start gap-2"><span className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full bg-primary" /><span>{r}</span></li>)}
        </ul>
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-3 text-xs">
          <p className="font-medium flex items-center gap-1.5 mb-1"><Sparkles className="w-3.5 h-3.5 text-violet-600" />Ask the AI</p>
          <p className="text-muted-foreground">Start a message with @AcademicGen, for example "@AcademicGen how do I cite a website in Harvard?", and the AI answers in the channel.</p>
        </div>
        <p className="text-xs text-muted-foreground">See something wrong? Use Report in the message menu. Messages reported by several members are hidden for review.</p>
      </CardContent>
    </Card>
  );
}
