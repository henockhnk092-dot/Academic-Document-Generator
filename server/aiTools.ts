// AI Check, Rewrite review and the premium "Rewrite & Verify" pipeline.
// Pipeline (what we did by hand on long documents): rewrite -> fact guard (citations, numbers, figure/table refs)
// -> Gemini minimal fix -> AI check -> rewrite only the flagged parts -> check again (up to 4 rounds)
// -> final Quetext AI + plagiarism report. Paid with credits; the customer picks the rewrite engine.
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { generateContent } from "./lib/gemini";
import { isFirebaseAdminAvailable } from "./firebaseSubscriptionStorage";
import { fairUse, AMOUNT } from "./fairUse";
import { getBalance, addCredits, chargeCredits, refundCredits } from "./credits";
import { getRandomTopic } from "../shared/random-topics";

const UA = "AcademicGen/1.0 (+https://www.academicgen.com)";
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── engines: credits per 1,000 words (1 credit = R1). Prices cover the engine + all checks with margin. ──
export const ENGINES: Record<string, { label: string; perK: number; desc: string; env?: string }> = {
  standard: { label: "Standard (Gemini)", perK: 19, desc: "Good everyday rewriting at the lowest price." },
  advanced: { label: "Advanced (ZeroGPT engine)", perK: 45, desc: "Stronger rewriting engine for demanding texts.", env: "ZEROGPT_API_KEY" },
  premium: { label: "Premium (WriteHuman engine)", perK: 59, desc: "Our strongest engine, used on full theses.", env: "WRITEHUMAN_API_KEY" },
};
const MIN_WORDS_BILLED = 300;
const MAX_WORDS = 5000;
const TARGET = 15; // ZeroGPT must be at or below this %
const QT_TARGET = 20; // ...and Quetext at or below this % (accept only when BOTH independent detectors agree)
const MAX_ROUNDS = 5;

// Engines on sale (RV_ENGINES, comma list). Default: premium only. Tested 15 Nov 2026 on a technical paragraph:
// Standard (Gemini) and Advanced (ZeroGPT) stayed at 100% AI-likeness after 4 rounds; Premium (WriteHuman) reached 0%.
// Only sell engines that measurably work; enable others here once they pass the same test.
const ENABLED = (process.env.RV_ENGINES || "premium").split(",").map((x) => x.trim());
const available = (e: string) => !!ENGINES[e] && (e !== "premium" || premiumOk) && ENABLED.includes(e) && (!ENGINES[e].env || !!process.env[ENGINES[e].env!]);

// Premium runs on the WriteHuman words already paid for. It switches itself off after RV_PREMIUM_UNTIL
// (the end of the paid cycle, default 2026-12-14) or when fewer than 3,000 words remain, so we never sell
// a job we cannot deliver. Re-subscribing = move RV_PREMIUM_UNTIL forward on Render.
let premiumOk = true;
let premiumWordsLeft: number | null = null;
let premiumCheckedAt = 0;
async function refreshPremium() {
  if (Date.now() - premiumCheckedAt < 10 * 60000) return;
  premiumCheckedAt = Date.now();
  const until = new Date((process.env.RV_PREMIUM_UNTIL || "2026-12-14") + "T00:00:00+02:00");
  if (!process.env.WRITEHUMAN_API_KEY || Date.now() >= until.getTime()) { premiumOk = false; return; }
  try {
    const r = await fetch("https://api.writehuman.ai/v1/usage", { headers: { Authorization: `Bearer ${process.env.WRITEHUMAN_API_KEY}`, "User-Agent": UA } });
    const d: any = await r.json();
    premiumWordsLeft = Number(d.included_words || 0) - Number(d.words_used_this_cycle || 0) + Number(d.topup_balance || 0);
    premiumOk = premiumWordsLeft > 3000;
  } catch {
    premiumOk = true; // usage check failed: keep selling; a failed job is refunded automatically
  }
}
// Pay-once price for one document: 20% above pack credits (minimum R29, covers the Payfast fee) so packs stay the better deal.
export const oncePrice = (cost: number) => Math.max(29, Math.ceil(cost * 1.2));
export const quote = (engine: string, w: number) => Math.ceil((Math.max(w, MIN_WORDS_BILLED) / 1000) * ENGINES[engine].perK);

async function uidOf(req: Request): Promise<string | null> {
  const h = req.headers.authorization;
  const t = h?.startsWith("Bearer ") ? h.slice(7) : (typeof req.body?.token === "string" ? req.body.token : undefined);
  if (!t || !isFirebaseAdminAvailable()) return null;
  try {
    const { getApp } = await import("firebase-admin/app");
    const { getAuth } = await import("firebase-admin/auth");
    return (await getAuth(getApp()).verifyIdToken(t)).uid;
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string>, timeoutMs = 180000, tries = 3): Promise<any> {
  let last = "";
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA, ...headers }, body: JSON.stringify(body), signal: ac.signal });
      const txt = await r.text();
      if ([429, 502, 503, 504].includes(r.status)) { last = `HTTP ${r.status}`; await sleep(8000 * (i + 1)); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 160)}`);
      return JSON.parse(txt || "{}");
    } catch (e: any) {
      last = e?.name === "AbortError" ? "timeout" : e.message;
      if (i < tries - 1) await sleep(8000 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(last);
}

// ── rewrite engines ──
async function rewriteGemini(text: string): Promise<string> {
  const out = await generateContent(
    `Rewrite the passage below in a natural, clear academic style, as a careful student would write it.
Rules: keep every fact, number, unit, name, technical term, citation marker (like [3] or (Smith, 2020)) and figure/table reference exactly.
Vary sentence length (mix short and long sentences), prefer plain words, avoid filler, avoid em dashes, avoid lists and headings.
Do not add new information. Return only the rewritten passage.

PASSAGE:
${text}`,
    { temperature: 0.9, maxTokens: 4096 },
  );
  return out.trim();
}

async function rewriteZeroGPT(text: string): Promise<string> {
  const d = await postJson("https://api.zerogpt.com/api/transform/humanize",
    { string: text, readability: "University", purpose: "Essay", strength: "More Human" },
    { ApiKey: process.env.ZEROGPT_API_KEY! }, 300000);
  const out = (d?.data?.output || "").trim();
  if (!d?.success || !out) throw new Error(`ZeroGPT engine: ${d?.message || "no output"}`);
  return out;
}

async function rewriteWriteHuman(text: string): Promise<string> {
  const d = await postJson("https://api.writehuman.ai/v1/humanize", { text, tone: "academic" },
    { Authorization: `Bearer ${process.env.WRITEHUMAN_API_KEY}` }, 240000);
  const out = (d?.results?.[0] || "").trim();
  if (!out) throw new Error("WriteHuman engine: no output");
  return out;
}

const ENGINE_FN: Record<string, (t: string) => Promise<string>> = { standard: rewriteGemini, advanced: rewriteZeroGPT, premium: rewriteWriteHuman };

// ── detection ──
export async function zerogptDetect(text: string): Promise<{ score: number; flagged: string[] }> {
  const d = await postJson("https://api.zerogpt.com/api/detect/detectText", { input_text: text }, { ApiKey: process.env.ZEROGPT_API_KEY! }, 120000);
  const data = d?.data ?? {};
  const score = Number(data.fakePercentage ?? data.fake_percentage ?? data.aiPercentage ?? 0);
  const flagged = (data.h || data.sentences || []).filter((s: any) => typeof s === "string");
  return { score: Math.round(score * 10) / 10, flagged };
}

async function quetextReport(kind: "ai-detect-report" | "report", text: string, title: string): Promise<any> {
  const key = process.env.QUETEXT_API_KEY!;
  const H = { "X-API-Key": key };
  const base = "https://www.quetext.com/api/v2";
  const id = (await postJson(`${base}/${kind}`, { title: title.slice(0, 120), text }, H, 60000))?.data?.id;
  if (!id) throw new Error("Quetext: no report id");
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const p = await fetch(`${base}/report-progress/${id}`, { headers: { ...H, Accept: "application/json", "User-Agent": UA } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (Number(p?.data?.progress) >= 1) break;
  }
  const r = await fetch(`${base}/${kind}/${id}`, { headers: { ...H, Accept: "application/json", "User-Agent": UA } });
  return ((await r.json().catch(() => ({}))) as any)?.data ?? {};
}

// ── fact guard (same rules as our document pipeline) ──
const CITE_RE = /\[\d+(?:\s*[-–,]\s*\d+)*\]|\([A-Z][^()]{0,80}?\d{4}[a-z]?\)|[A-Z][A-Za-z\-]+(?: et al\.)? \(\d{4}[a-z]?\)/g;
const NUM_RE = /(?<![A-Za-z])[-±]?\d+(?:[.,]\d+)*/g;
const REF_RE = /\b(?:Figure|Fig\.|Table|Section|Chapter|Equation|Eq\.|Appendix)\s+[A-Z]?\d+(?:\.\d+)*/gi;

export function factIssues(orig: string, next: string): string[] {
  const issues: string[] = [];
  const set = (t: string, re: RegExp) => new Set((t.match(re) || []).map((x) => x.replace(/\s+/g, " ").toLowerCase().replace("fig.", "figure")));
  for (const [name, re] of [["citation", CITE_RE], ["reference", REF_RE]] as const) {
    const a = set(orig, re), b = set(next, re);
    for (const x of Array.from(a)) if (!b.has(x)) issues.push(`${name} missing: ${x}`);
    for (const x of Array.from(b)) if (!a.has(x)) issues.push(`${name} added: ${x}`);
  }
  const count = (t: string) => (t.match(NUM_RE) || []).reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map<string, number>());
  const ca = count(orig), cb = count(next);
  for (const [n, k] of Array.from(ca)) if ((cb.get(n) || 0) < k) issues.push(`number missing: ${n}`);
  for (const [n, k] of Array.from(cb)) if ((ca.get(n) || 0) < k) issues.push(`number added: ${n}`);
  return issues;
}

async function geminiFix(orig: string, rewritten: string, issues: string[]): Promise<string> {
  const out = await generateContent(
    `The REWRITTEN passage changed some facts of the ORIGINAL. Problems: ${issues.join("; ")}.
Repair the REWRITTEN passage: put every missing fact back (exact number, citation marker or figure/table reference), adding a short
phrase or clause where it fits, in the same plain style; remove anything the original does not say. Change nothing else and do not
copy whole sentences from the original. No em dashes. Return only the repaired passage.

ORIGINAL:
${orig}

REWRITTEN:
${rewritten}`,
    { temperature: 0.2, maxTokens: 2048 },
  );
  return out.trim();
}

// Rewrite one chunk, then guard its facts against the original; returns the best safe version.
// Method from internal benchmarks on long academic documents (independent Quetext checks):
//  - "fix, then rehumanize": a fact repair puts the original's phrasing back, which detectors flag again, so the
//    repaired text goes through the engine once more and is kept only if its facts still match;
//  - `fresh` starts from the ORIGINAL passage instead of the last output (fresh attempts rescued many passages).
async function safeRewrite(engine: string, orig: string, current: string, log: (s: string) => void, fresh = false): Promise<string> {
  let next = await ENGINE_FN[engine](fresh ? orig : current);
  let issues = factIssues(orig, next);
  if (issues.length) {
    next = await geminiFix(orig, next, issues).catch(() => next);
    issues = factIssues(orig, next);
    if (!issues.length && engine !== "standard") {
      const again = await ENGINE_FN[engine](next).catch(() => "");
      if (again && !factIssues(orig, again).length) next = again; // rehumanized and still faithful
    }
  }
  if (issues.some((i) => /missing|added/.test(i))) {
    log("Kept one passage as it was, to protect its numbers and citations.");
    return current;
  }
  return next;
}

// Split into paragraphs, then into groups of 2-4 sentences (about 70 words). Small pieces keep the engines from
// dropping facts (tested: whole paragraphs lost "Table 2" / "Smith (2020)"; 45-word groups lost nothing).
// Passages under 25 words, equations and reference lists are left untouched.
type Chunk = { text: string; orig: string; edit: boolean; para: number };
function chunksOf(text: string): Chunk[] {
  const out: Chunk[] = [];
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).forEach((t, para) => {
    const skip = words(t) < 25 || /\\[a-z]+\{|[=∑∫√].*[=∑∫√]/.test(t) || /^(references|bibliography)\b/i.test(t);
    if (skip) { out.push({ text: t, orig: t, edit: false, para }); return; }
    let cur = "";
    for (const sent of t.match(/[^.!?]+[.!?]+["')\]]*\s*|.+$/g) || [t]) {
      if (words(cur + sent) > 70 && words(cur) >= 25) { out.push({ text: cur.trim(), orig: cur.trim(), edit: true, para }); cur = ""; }
      cur += sent;
    }
    if (cur.trim()) out.push({ text: cur.trim(), orig: cur.trim(), edit: words(cur) >= 12, para });
  });
  return out;
}
const join = (cs: Chunk[]) => {
  const paras: string[][] = [];
  for (const c of cs) (paras[c.para] ||= []).push(c.text);
  return paras.filter(Boolean).map((p) => p.join(" ")).join("\n\n");
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

// ── jobs ──
interface Job {
  id: string; uid: string; engine: string; words: number; cost: number; status: "running" | "done" | "failed";
  progress: number; log: string[]; rounds: { round: number; score: number; quetext?: number | null }[]; before?: number | null; result?: any; error?: string; startedAt: number; refunded?: boolean;
}
const jobs = new Map<string, Job>();

async function saveJob(j: Job) {
  try {
    if (!isFirebaseAdminAvailable()) return;
    const { getApp } = await import("firebase-admin/app");
    const { getFirestore } = await import("firebase-admin/firestore");
    await getFirestore(getApp()).collection("rv_jobs").doc(j.id).set(JSON.parse(JSON.stringify(j)));
  } catch (e: any) {
    console.warn("[rv] save failed:", e?.message);
  }
}

async function runJob(j: Job, original: string, title: string) {
  const log = (s: string) => { j.log.push(s); };
  try {
    const chunks = chunksOf(original);
    const editable = chunks.filter((c) => c.edit);
    // Score of the original text, so the report can show before -> after on the same detector.
    j.before = await zerogptDetect(original).then((d) => d.score).catch(() => null);
    if (j.before !== null) log(`Your text before: AI-likeness ${j.before}%.`);
    log(`Rewriting ${editable.length} passage(s) with the ${ENGINES[j.engine].label} engine.`);
    let targets = editable;
    let best = { score: Infinity, texts: chunks.map((c) => c.text) };
    let forceFresh = false; // set when Quetext disagrees with ZeroGPT
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      for (let i = 0; i < targets.length; i += 3) {
        // Rounds 2 and 4 retry flagged passages fresh from the original; round 3 rehumanizes the latest version.
        const fresh = forceFresh || round % 2 === 0;
        await Promise.all(targets.slice(i, i + 3).map(async (c) => { c.text = await safeRewrite(j.engine, c.orig, c.text, log, fresh); }));
        j.progress = Math.min(85, Math.round(((round - 1) + (i + 3) / Math.max(targets.length, 1)) / MAX_ROUNDS * 80));
      }
      forceFresh = false;
      const full = join(chunks);
      const det = await zerogptDetect(full);
      // Detectors can disagree (seen: ZeroGPT 0%, Quetext 100% on the same text). When ZeroGPT passes, confirm with
      // Quetext; a round counts only when both are low, and rounds are ranked on the worse of the two.
      let qt: number | null = null;
      if (det.score <= TARGET && process.env.QUETEXT_API_KEY && words(full) >= 50) {
        const r: any = await quetextReport("ai-detect-report", full, title).catch(() => null);
        qt = r && r.ai_score != null ? Math.round(Number(r.ai_score) * 100) / 100 : null;
      }
      j.rounds.push({ round, score: det.score, quetext: qt });
      log(`Round ${round}: AI-likeness ${det.score}% (ZeroGPT)${qt !== null ? `, ${qt}% (Quetext)` : ""}.`);
      const combined = qt !== null ? Math.max(det.score, qt) : det.score + 100; // unconfirmed rounds rank below confirmed ones
      // A later round can score worse than an earlier one: always keep the best version seen.
      if (combined < best.score) best = { score: combined, texts: chunks.map((c) => c.text), zg: det.score, qt } as any;
      if ((det.score <= TARGET && (qt === null ? !process.env.QUETEXT_API_KEY : qt <= QT_TARGET)) || round === MAX_ROUNDS) break;
      if (det.score <= TARGET) {
        targets = editable; forceFresh = true; // ZeroGPT passed but Quetext did not: fresh attempts on every passage
        log(`The second detector still flags it. Reworking all ${targets.length} passage(s).`);
        continue;
      }
      const flagged = det.flagged.map((f) => norm(f).slice(0, 60)).filter(Boolean);
      targets = editable.filter((c) => flagged.some((f) => norm(c.text).includes(f)));
      if (!targets.length) targets = editable;
      log(`Reworking ${targets.length} flagged passage(s).`);
    }
    best.texts.forEach((t, i) => { chunks[i].text = t; });
    const bz = (best as any).zg, bq = (best as any).qt;
    if (j.rounds.length > 1) log(`Keeping the best round (${bz ?? best.score}% ZeroGPT${bq != null ? `, ${bq}% Quetext` : ""}).`);
    const final = join(chunks);
    j.progress = 90;
    let quetext: any = null;
    if (process.env.QUETEXT_API_KEY && words(final) >= 50) {
      log("Final AI check and plagiarism scan.");
      // One after the other: two parallel reports on the same key get rate-limited.
      const ai: any = await quetextReport("ai-detect-report", final, title).catch((e) => ({ error: e.message }));
      const plag: any = await quetextReport("report", final, title).catch((e) => ({ error: e.message }));
      if (ai?.error || plag?.error) console.warn("[rv] Quetext:", ai?.error || "", plag?.error || "");
      quetext = {
        aiScore: ai?.ai_score ?? null,
        plagiarism: plag?.score ?? plag?.percentage ?? null,
        sources: (plag?.matches || []).slice(0, 10).map((m: any) => ({ url: m?.source?.url, similar: m?.percent_similar })),
      };
    }
    if (chunks.every((c) => c.text === c.orig)) {
      await refundCredits(j.uid, j.cost, j.id, "Refund: no safe rewrite was possible").catch(() => {});
      log(`We could not rewrite this text safely without changing its facts, so your ${j.cost} credits were refunded.`);
      j.refunded = true;
    } else if (j.cost > 0 && process.env.QUETEXT_API_KEY && !(bz != null && bz <= TARGET && bq != null && bq <= QT_TARGET)) {
      // Fair-result guarantee: if the two independent detectors never both agreed, half the credits come back.
      const back = Math.floor(j.cost / 2);
      if (back > 0) {
        await refundCredits(j.uid, back, j.id, "Partial refund: the two detectors did not both agree").catch(() => {});
        log(`The two independent detectors did not both agree within ${MAX_ROUNDS} rounds, so ${back} of your ${j.cost} credits were refunded. You keep the best version.`);
        (j as any).partialRefund = back;
      }
    }
    j.result = { text: final, originalWords: j.words, finalWords: words(final), before: j.before ?? null, rounds: j.rounds, finalCheck: quetext };
    j.status = "done";
    j.progress = 100;
    log("Done.");
  } catch (e: any) {
    j.status = "failed";
    j.error = String(e?.message || e).slice(0, 300);
    await refundCredits(j.uid, j.cost, j.id, `Refund: Rewrite & Verify failed (${j.error.slice(0, 60)})`).catch(() => {});
    log(`Failed: ${j.error}. Your ${j.cost} credits were refunded.`);
  }
  await saveJob(j);
}

async function firestore() {
  if (!isFirebaseAdminAvailable()) return null;
  const { getApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  return getFirestore(getApp());
}

function validate(text: string, engine: string, uid: string): { status: number; error: string } | null {
  const w = words(text);
  if (!available(engine)) return { status: 400, error: "That engine is not available right now. Please choose another." };
  if (w < 50) return { status: 400, error: "Please paste at least 50 words." };
  if (w > MAX_WORDS) return { status: 400, error: `Please submit at most ${MAX_WORDS.toLocaleString("en-US")} words at a time (split longer documents).` };
  if (!process.env.ZEROGPT_API_KEY) return { status: 503, error: "Rewrite & Verify is temporarily unavailable." };
  if (Array.from(jobs.values()).some((j) => j.uid === uid && j.status === "running")) return { status: 429, error: "You already have a job running. Please wait for it to finish." };
  return null;
}

// Admin accounts (users/<uid>.isAdmin) run Rewrite & Verify without credits.
async function isAdminUid(uid: string): Promise<boolean> {
  try {
    const db = await firestore();
    const d = db ? (await db.collection("users").doc(uid).get()).data() : null;
    return d?.isAdmin === true || d?.role === "admin";
  } catch { return false; }
}

async function startJob(uid: string, text: string, engine: string, title: string): Promise<{ id: string; cost: number } | { status: number; error: string; code?: string; cost?: number }> {
  const w = words(text);
  const admin = await isAdminUid(uid);
  const cost = admin ? 0 : quote(engine, w); // admins test for free (still uses engine words)
  const id = crypto.randomUUID();
  try {
    if (cost > 0) await chargeCredits(uid, cost, id, `Rewrite & Verify, ${w} words, ${ENGINES[engine].label}`);
  } catch (e: any) {
    if (e?.message === "not_enough_credits") return { status: 402, error: `This needs ${cost} credits. Please buy credits or pay once for this document.`, code: "not_enough_credits", cost };
    return { status: 500, error: "Could not reserve credits. Please try again." };
  }
  const job: Job = { id, uid, engine, words: w, cost, status: "running", progress: 2, log: [], rounds: [], startedAt: Date.now() };
  jobs.set(id, job);
  saveJob(job);
  runJob(job, text, title).finally(() => setTimeout(() => jobs.delete(id), 6 * 3600 * 1000));
  return { id, cost };
}

interface Order { id: string; uid: string; text: string; engine: string; title: string; words: number; cost: number; amount: number; launch?: boolean; status: "pending" | "started" | "failed"; createdAt: number; jobId?: string }

// Launch offer: a customer's first document (up to 1,000 words) for R29, for the first 50 paying customers.
// WriteHuman words are already paid until 14 Dec, so each launch sale still earns more than its check costs.
export const LAUNCH = { price: 29, maxWords: 1000, slots: 50 };
async function launchEligible(uid: string, w: number): Promise<boolean> {
  if (w > LAUNCH.maxWords) return false;
  const db = await firestore();
  if (!db) return false;
  const used = Number((await db.collection("settings").doc("launchOffer").get()).data()?.used ?? 0);
  if (used >= LAUNCH.slots) return false;
  const prior = await db.collection("rv_jobs").where("uid", "==", uid).limit(1).get();
  return prior.empty;
}
export async function launchStatus() {
  const db = await firestore();
  const used = db ? Number((await db.collection("settings").doc("launchOffer").get()).data()?.used ?? 0) : 0;
  return { ...LAUNCH, left: Math.max(0, LAUNCH.slots - used) };
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!id) return null;
  const db = await firestore();
  return db ? ((await db.collection("rv_orders").doc(id).get()).data() as Order) ?? null : null;
}

// Called by the Payfast ITN after a verified one-time payment: credit the job cost, then start the job.
export async function startPaidOrder(orderId: string, paymentRef: string): Promise<string> {
  const db = await firestore();
  const o = await getOrder(orderId);
  if (!db || !o) return "order not found";
  if (o.status !== "pending") return `already ${o.status}`;
  await addCredits(o.uid, o.cost, paymentRef, `One-time payment R${o.amount} for one document`);
  if (o.launch) {
    const { FieldValue } = await import("firebase-admin/firestore");
    await db.collection("settings").doc("launchOffer").set({ used: FieldValue.increment(1) }, { merge: true });
  }
  const r = await startJob(o.uid, o.text, o.engine, o.title);
  if ("error" in r) {
    await db.collection("rv_orders").doc(orderId).update({ status: "failed", error: r.error });
    return `paid, credits kept in wallet (${r.error})`;
  }
  await db.collection("rv_orders").doc(orderId).update({ status: "started", jobId: r.id, text: "" });
  return `job ${r.id}`;
}

export function registerAiTools(app: Express, deps: { geminiDetect: (t: string) => Promise<{ aiPercentage: number; sentenceScores: any[] }> }) {
  // AI Check page: ZeroGPT when configured, otherwise our Gemini detector. Included in plans (fair use).
  app.post("/api/ai-check", fairUse("checks", AMOUNT.words), async (req, res) => {
    try {
      const text = String(req.body?.text || "").trim();
      if (words(text) < 40) return res.status(400).json({ error: "Please paste at least 40 words." });
      if (words(text) > 10000) return res.status(400).json({ error: "Please check at most 10,000 words at a time." });
      if (process.env.ZEROGPT_API_KEY) {
        const d = await zerogptDetect(text);
        const flagged = new Set(d.flagged.map(norm));
        const sentences = (text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) || [text]).map((s) => s.trim()).filter(Boolean)
          .map((s) => ({ text: s, flagged: flagged.has(norm(s)) || Array.from(flagged).some((f) => f.length > 20 && norm(s).includes(f.slice(0, 50))) }));
        return res.json({ success: true, engine: "zerogpt", score: d.score, sentences });
      }
      const g = await deps.geminiDetect(text);
      res.json({ success: true, engine: "gemini", score: g.aiPercentage, sentences: g.sentenceScores.map((s: any) => ({ text: s.text, flagged: !!s.isAI })) });
    } catch (e: any) {
      res.status(500).json({ error: "The AI check failed. Please try again in a minute." });
      console.error("[ai-check]", e?.message);
    }
  });

  // "Surprise me": a short academic paragraph on a random topic, so visitors can try the tools instantly.
  app.post("/api/sample-text", fairUse("sections"), async (_req, res) => {
    try {
      const { topic, category } = getRandomTopic();
      const text = await generateContent(
        `Write one academic paragraph of 170 to 220 words for a university report on: "${topic}".
Typical AI-assistant style is fine. Include one numeric citation marker like [1], one reference to "Figure 1" or "Table 1",
and two or three concrete numbers with units. No heading, no title, no bullet points, no em dashes. Return only the paragraph.`,
        { temperature: 1.0, maxTokens: 8192 },
      );
      res.json({ success: true, topic, category, text: text.trim() });
    } catch (e: any) {
      console.error("[sample-text]", e?.message);
      res.status(500).json({ error: "Could not create a sample right now. Please try again." });
    }
  });

  // Rewrite page: Gemini reviews the rewrite against the original and proposes minimal corrections.
  app.post("/api/humanize/review", fairUse("words", (r) => words(String(r.body?.rewritten || ""))), async (req, res) => {
    try {
      const original = String(req.body?.original || "").trim();
      const rewritten = String(req.body?.rewritten || "").trim();
      if (!original || !rewritten) return res.status(400).json({ error: "Original and rewritten text are required." });
      if (words(rewritten) > 5000) return res.status(400).json({ error: "Please review at most 5,000 words at a time." });
      const guard = factIssues(original, rewritten);
      const raw = await generateContent(
        `Compare an ORIGINAL academic passage with its REWRITTEN version.
1. List real problems in the rewrite: meaning changed, facts/numbers/names/citations lost or altered, claims added that are not in the original, grammar errors, unclear or awkward sentences.
2. Write a CORRECTED version of the REWRITTEN text that fixes only those problems with minimal edits.
   Keep the rewritten wording and sentence structure elsewhere. Do NOT copy sentences back from the original word for word (that would look like plagiarism of the source); express the original idea in the rewrite's own words.
   Keep every citation marker, number and figure/table reference exactly as in the original. No em dashes.
Return JSON: {"issues":[{"type":"meaning|fact|citation|grammar|clarity","detail":"short explanation","quote":"short excerpt from the rewrite"}],"corrected":"full corrected text","summary":"one sentence"}
${guard.length ? `\nAutomatic fact check found: ${guard.join("; ")}\n` : ""}
ORIGINAL:
${original}

REWRITTEN:
${rewritten}`,
        { responseFormat: "json", temperature: 0.2, maxTokens: 8192 },
      );
      const d = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      res.json({ success: true, issues: d.issues || [], corrected: d.corrected || rewritten, summary: d.summary || "", factCheck: guard });
    } catch (e: any) {
      console.error("[review]", e?.message);
      res.status(500).json({ error: "The review failed. Please try again." });
    }
  });

  // Rewrite & Verify (credits).
  app.get("/api/rv/engines", async (_req, res) => {
    await refreshPremium();
    res.json({ engines: Object.entries(ENGINES).map(([id, e]) => ({ id, label: e.label, perK: e.perK, desc: e.desc, available: available(id) })), minWords: MIN_WORDS_BILLED, maxWords: MAX_WORDS, once: { markup: 1.2, min: 29 }, launch: await launchStatus().catch(() => null) });
  });

  app.get("/api/credits", async (req, res) => {
    const uid = await uidOf(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    res.set("Cache-Control", "no-store");
    res.json({ balance: await getBalance(uid).catch(() => 0) });
  });

  app.post("/api/rv/start", async (req, res) => {
    await refreshPremium();
    const uid = await uidOf(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    const text = String(req.body?.text || "").trim();
    const engine = String(req.body?.engine || "standard");
    const bad = validate(text, engine, uid);
    if (bad) return res.status(bad.status).json({ error: bad.error });
    const r = await startJob(uid, text, engine, String(req.body?.title || "AcademicGen document"));
    if ("error" in r) return res.status(r.status).json(r);
    res.json({ success: true, jobId: r.id, cost: r.cost });
  });

  // Pay once for one document: save the order (text + engine + price); Payfast ITN starts it after payment.
  app.post("/api/rv/order", async (req, res) => {
    await refreshPremium();
    const uid = await uidOf(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    const text = String(req.body?.text || "").trim();
    const engine = String(req.body?.engine || "standard");
    const bad = validate(text, engine, uid);
    if (bad) return res.status(bad.status).json({ error: bad.error });
    const cost = quote(engine, words(text));
    const launch = await launchEligible(uid, words(text));
    const order: Order = { id: crypto.randomUUID(), uid, text, engine, title: String(req.body?.title || "AcademicGen document"), words: words(text), cost, amount: launch ? LAUNCH.price : oncePrice(cost), launch, status: "pending", createdAt: Date.now() };
    const db = await firestore();
    if (!db) return res.status(503).json({ error: "Payments are not available right now." });
    await db.collection("rv_orders").doc(order.id).set(order);
    res.json({ success: true, orderId: order.id, amount: order.amount, launch });
  });

  app.get("/api/rv/order/:id", async (req, res) => {
    const uid = await uidOf(req);
    const o = await getOrder(req.params.id);
    if (!uid || !o || o.uid !== uid) return res.status(404).json({ error: "Order not found." });
    res.set("Cache-Control", "no-store");
    res.json({ status: o.status, jobId: o.jobId || null, amount: o.amount, engine: o.engine, words: o.words });
  });

  app.get("/api/rv/job/:id", async (req, res) => {
    const uid = await uidOf(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    res.set("Cache-Control", "no-store");
    let j: any = jobs.get(req.params.id);
    if (!j && isFirebaseAdminAvailable()) {
      const { getApp } = await import("firebase-admin/app");
      const { getFirestore } = await import("firebase-admin/firestore");
      j = (await getFirestore(getApp()).collection("rv_jobs").doc(req.params.id).get()).data();
      // Server restarted during the job: refund and report it.
      if (j && j.status === "running" && Date.now() - j.startedAt > 15 * 60000) {
        await refundCredits(j.uid, j.cost, j.id, "Refund: job interrupted").catch(() => {});
        j.status = "failed"; j.error = "The job was interrupted. Your credits were refunded."; await saveJob(j);
      }
    }
    if (!j || j.uid !== uid) return res.status(404).json({ error: "Job not found." });
    const { uid: _u, ...pub } = j;
    res.json(pub);
  });
}
