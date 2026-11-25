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
const TARGET = 10; // ZeroGPT must be at or below this %
const QT_TARGET = 10; // ...and Quetext at or below this % (accept only when BOTH independent detectors agree)
const MAX_ROUNDS = 8;
const MAX_ENGINE_FACTOR = 6; // stop when the engine has rewritten this many times the editable words (cost limit)

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

// Quetext has no balance endpoint: an "insufficient credits" (402) answer pauses new jobs for a while, and a running job
// stops at once (no more rewrite-engine words spent) and is refunded in full, instead of going on with one detector.
class QuetextNoCredit extends Error {}
let quetextOutAt = 0;
const QT_PAUSE_MS = 20 * 60 * 1000;
const quetextOut = () => Boolean(process.env.QUETEXT_API_KEY) && Date.now() - quetextOutAt < QT_PAUSE_MS;

async function quetextReport(kind: "ai-detect-report" | "report", text: string, title: string): Promise<any> {
  const key = process.env.QUETEXT_API_KEY!;
  const H = { "X-API-Key": key };
  const base = "https://www.quetext.com/api/v2";
  let id: string | undefined;
  try {
    id = (await postJson(`${base}/${kind}`, { title: title.slice(0, 120), text }, H, 60000))?.data?.id;
  } catch (e: any) {
    if (/HTTP 402/.test(String(e?.message))) {
      quetextOutAt = Date.now();
      console.error("[rv] Quetext is out of credit: new Rewrite & Verify jobs are paused. Top up Quetext.");
      throw new QuetextNoCredit("quetext_no_credit");
    }
    throw e;
  }
  quetextOutAt = 0;
  if (!id) throw new Error("Quetext: no report id");
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const p = await fetch(`${base}/report-progress/${id}`, { headers: { ...H, Accept: "application/json", "User-Agent": UA } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (Number(p?.data?.progress) >= 1) break;
  }
  // Only the download of the finished report is retried; creating it again would be billed again.
  const r = await retry(() => fetch(`${base}/${kind}/${id}`, { headers: { ...H, Accept: "application/json", "User-Agent": UA } }));
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
  let next = (await ENGINE_FN[engine](fresh ? orig : current)).replace(/^\s*[•\-*]\s+/, "");
  let issues = factIssues(orig, next);
  if (issues.length) {
    next = await geminiFix(orig, next, issues).catch(() => next);
    issues = factIssues(orig, next);
    if (!issues.length && engine !== "standard") {
      const again = await ENGINE_FN[engine](next).catch(() => "");
      if (again && !factIssues(orig, again).length) next = again; // rehumanized and still faithful
      else {
        // The repair tends to copy the original's sentences back (detectors then flag the passage again), so try one
        // new engine rewrite from the original and keep it when its facts match (25 Nov 2026).
        const retry2 = await ENGINE_FN[engine](orig).catch(() => "");
        if (retry2 && !factIssues(orig, retry2).length) next = retry2;
      }
    }
  }
  if (issues.some((i) => /missing|added/.test(i))) {
    log("Kept one passage as it was, to protect its numbers and citations.");
    return current;
  }
  return next;
}

// Meaning check: numbers and citations can survive while the claim changes (seen: "simulated" -> "was tested", a
// comparison reversed, sentences invented). Returns the indices whose rewrite is not faithful, or null when the check
// could not run (the caller must then say so instead of implying that the text was verified).
// Retry a step that fails on a dropped connection ("fetch failed").
async function retry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) { if (i >= tries) throw e; await sleep(5000 * i); }
  }
}

// Second look at flagged passages: a flag stands only when the model quotes the original words and the rewrite words
// that differ, and both quotes really occur in the texts. Lighter fallback models (used when the main model's daily
// quota is gone) flagged plain rewording as "meaning changed", which threw most rewrites away (25 Nov 2026).
async function confirmMeaning(batch: { orig: string; next: string }[], first: Map<number, string>): Promise<Map<number, string>> {
  if (!first.size) return first;
  const ids = Array.from(first.keys());
  const n = (t: string) => t.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
  try {
    const out = await retry(async () => {
      const r = await generateContent(
        `For each pair, decide whether the REWRITE tells the reader something different from the ORIGINAL (a changed fact,
number, claim strength, cause, condition or comparison, an added claim, or a dropped substantive point). Different wording,
sentence order or dropped filler words are NOT a change. When it is a change, copy the exact ORIGINAL words and the exact
REWRITE words that differ (each at most 12 words, copied character for character).
Return only JSON: {"items":[{"id":<id>,"changed":true|false,"original":"<words>","rewrite":"<words>","why":"<at most 14 words>"}]}

${ids.map((k) => `ID ${k}
ORIGINAL: ${batch[k].orig}
REWRITE: ${batch[k].next}`).join("\n\n")}`,
        { temperature: 0, maxTokens: 8192, responseFormat: "json" },
      );
      const items = JSON.parse(r)?.items;
      if (!Array.isArray(items)) throw new Error("unexpected answer");
      return items;
    });
    const kept = new Map<number, string>();
    for (const it of out) {
      const k = Number(it?.id);
      if (!first.has(k) || it?.changed !== true) continue;
      const o = n(String(it?.original || "")), w = n(String(it?.rewrite || ""));
      const grounded = (o && n(batch[k].orig).includes(o)) || (w && n(batch[k].next).includes(w));
      if (grounded) kept.set(k, String(it?.why || first.get(k) || "").slice(0, 160));
    }
    return kept;
  } catch {
    return first; // if the second look fails, stay on the safe side and keep the original flags
  }
}

async function meaningIssues(pairs: { orig: string; next: string }[]): Promise<Map<number, string> | null> {
  const bad = new Map<number, string>();
  for (let i = 0; i < pairs.length; i += 10) {
    const batch = pairs.slice(i, i + 10);
    try {
      const flagged = await retry(async () => {
        const out = await generateContent(
          `Compare each REWRITE with its ORIGINAL. Flag a rewrite only when a reader would learn something different: it states
something the original does not say, reverses, weakens or strengthens a claim ("simulated" becoming "tested", "an estimated
third" becoming "more than a third", "e.g., 4" becoming a fixed 4), drops a substantive point, or changes a cause, condition or
comparison. Do not flag different wording, or lost filler adjectives such as "comprehensive" or "robust".
Return only JSON: {"flagged":[{"id":<id>,"why":"<what changed, at most 14 words>"}]}

${batch.map((p, k) => `ID ${k}\nORIGINAL: ${p.orig}\nREWRITE: ${p.next}`).join("\n\n")}`,
          { temperature: 0, maxTokens: 8192, responseFormat: "json" },
        );
        const f = JSON.parse(out)?.flagged;
        if (!Array.isArray(f)) throw new Error("unexpected answer");
        return f;
      });
      const first = new Map<number, string>();
      for (const f of flagged) {
        const k = Number(f?.id);
        if (Number.isInteger(k) && k >= 0 && k < batch.length) first.set(k, String(f?.why || "").slice(0, 160));
      }
      (await confirmMeaning(batch, first)).forEach((why, k) => bad.set(i + k, why));
    } catch (e: any) {
      console.warn("[rv] meaning check failed:", String(e?.message || e).slice(0, 160));
      return null;
    }
  }
  return bad;
}

// Split into paragraphs, then into groups of 2-4 sentences (about 70 words). Small pieces keep the engines from
// dropping facts (tested: whole paragraphs lost "Table 2" / "Smith (2020)"; 45-word groups lost nothing).
// Left untouched: headings and captions (under 12 words, "Figure 3: ..."), the reference list (from a
// "References" heading to the next numbered heading, and "[1] ..." entries), and every SENTENCE that holds an
// equation. The prose around an equation is still rewritten (a paragraph with one formula used to be skipped
// whole, which left most of a technical report untouched and scored 100% AI in every round).
type Chunk = { text: string; orig: string; edit: boolean; para: number };
const isFormula = (s: string) => /\\[a-z]+\{|[=≈∑∫√]/.test(s);
const isHeading = (s: string) => /^(\d+(\.\d+)*\.?|[A-Z]\.|appendix\b|chapter\b)\s*\S/i.test(s) && words(s) < 15;
// Whole paragraphs (up to ~220 words) go to the engine. Tested 25 Nov 2026 on the same 115-word paragraph: sent whole,
// WriteHuman scored 0-0.4% on Quetext; cut into ~40-word pieces it scored 44%, and a full report in ~70-word pieces
// stayed at 100% for 7 rounds. Facts are still protected by the fact guard and the meaning check.
const CHUNK_WORDS = Number(process.env.RV_CHUNK_WORDS || 220);
function chunksOf(text: string): Chunk[] {
  const out: Chunk[] = [];
  let inRefs = false;
  text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).forEach((t0, para) => {
    let t = t0;
    const refHead = /^(\d+(\.\d+)*\.?\s*)?(references|bibliography|reference list|works cited)\b/i.test(t) && words(t) < 6;
    if (refHead) inRefs = true;
    else if (inRefs && isHeading(t) && !/^\[\d+\]/.test(t)) inRefs = false;
    const keep = refHead || inRefs || words(t) < 12 || /^\[\d+\]\s/.test(t) || /^(figure|fig\.|table|equation|eq\.)\s*\d/i.test(t);
    const isTitle = words(t) < 25 && !/[.!?:;]["')\]]?$/.test(t) && !/^[•\-*]\s/.test(t); // document title, long headings
    if (keep || isTitle) { out.push({ text: t, orig: t, edit: false, para }); return; }
    const mark = t.match(/^[•\-*]\s+/)?.[0]; // the bullet itself is never rewritten
    if (mark) { out.push({ text: mark.trim(), orig: mark.trim(), edit: false, para }); t = t.slice(mark.length); }
    // Sentences (split after . ! ? followed by a capital, so decimals like 0.75 stay whole); equations stay as they are.
    const sents = t.split(/(?<=[.!?]["')\]]?)\s+(?=[A-Z(\["'•\-])/);
    let cur = "";
    const flush = () => { const s = cur.trim(); if (s) out.push({ text: s, orig: s, edit: words(s) >= 8, para }); cur = ""; };
    for (const s of sents) {
      if (isFormula(s)) { flush(); out.push({ text: s, orig: s, edit: false, para }); continue; }
      if (words(cur + " " + s) > CHUNK_WORDS && words(cur) >= 60) flush();
      cur += (cur ? " " : "") + s;
    }
    flush();
  });
  return out;
}
const join = (cs: Chunk[]) => {
  const paras: string[][] = [];
  for (const c of cs) (paras[c.para] ||= []).push(c.text);
  // One output paragraph per input paragraph (line breaks inside a rewrite are folded), so a Word file's
  // paragraphs can be put back in place ("keep layout").
  return paras.filter(Boolean).map((p) => p.join(" ").replace(/\s*\n+\s*/g, " ").trim()).join("\n\n");
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
    let best = { score: Infinity, texts: chunks.map((c) => c.text), zg: null as number | null, qt: null as number | null };
    const good = new Map<Chunk, string>(editable.map((c) => [c, c.orig])); // last version whose meaning was verified
    const editableWords = editable.reduce((n, c) => n + words(c.orig), 0);
    let engineWords = 0, forceFresh = false, meaningChecked = true;
    const unchecked = new Set<Chunk>(); // kept rewrites whose meaning could not be checked automatically
    const retryFresh = new Set<Chunk>(); // passages whose last rewrite changed the meaning: try again from the original
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      for (let i = 0; i < targets.length; i += 3) {
        await Promise.all(targets.slice(i, i + 3).map(async (c) => {
          const fresh = forceFresh || round % 2 === 0 || retryFresh.has(c);
          engineWords += words(c.orig);
          c.text = await safeRewrite(j.engine, c.orig, c.text, log, fresh);
        }));
        j.progress = Math.min(85, Math.round(((round - 1) + (i + 3) / Math.max(targets.length, 1)) / MAX_ROUNDS * 80));
      }
      forceFresh = false; retryFresh.clear();
      // Meaning check, automatic: a passage that changed what the author wrote goes back to its last verified version.
      const fresh2 = targets.filter((c) => c.text !== c.orig && c.text !== good.get(c));
      let bad = fresh2.length ? await meaningIssues(fresh2.map((c) => ({ orig: c.orig, next: c.text }))) : new Map<number, string>();
      for (const wait of [20000, 60000]) { // Gemini busy or out of quota for a moment: try again before giving up
        if (bad !== null) break;
        await sleep(wait);
        bad = await meaningIssues(fresh2.map((c) => ({ orig: c.orig, next: c.text })));
      }
      if (bad === null) {
        // Throwing the whole round away (old behaviour) left most of the document untouched. The numbers, citations and
        // references were already checked by the fact guard, so keep these rewrites and ask the customer to read them.
        meaningChecked = false;
        fresh2.forEach((c) => { unchecked.add(c); good.set(c, c.text); });
        log(`The automatic meaning check was not available this round, so ${fresh2.length} passage(s) are marked for you to read.`);
      } else {
        fresh2.forEach((c) => unchecked.delete(c));
        fresh2.forEach((c, k) => { if (bad.has(k)) { c.text = good.get(c)!; retryFresh.add(c); } else good.set(c, c.text); });
        if (bad.size) log(`Meaning check: ${bad.size} of ${fresh2.length} passage(s) changed what you wrote and were put back.`);
      }
      const full = join(chunks);
      // AI checks read the prose only: tables, headings, captions and references are not AI writing and Quetext scored
      // every table row 100% AI, which kept whole documents at 100% (Turnitin's AI check also skips them).
      const prose = editable.map((c) => c.text).join("\n\n");
      if (round === 1) log("AI checks read your paragraphs of text; tables, headings and references are not scored.");
      const det = await zerogptDetect(prose);
      // Detectors can disagree (seen: ZeroGPT 0%, Quetext 83% on the same text), so a round passes only when both are low.
      let qt: number | null = null; let qtFlagged: string[] = [];
      if (det.score <= TARGET && process.env.QUETEXT_API_KEY && words(prose) >= 50) {
        const r: any = await quetextReport("ai-detect-report", prose, title).catch((e) => { if (e instanceof QuetextNoCredit) throw e; return null; });
        qt = r && r.ai_score != null ? Math.round(Number(r.ai_score) * 100) / 100 : null;
        qtFlagged = (r?.ai_matches || []).filter((m: any) => Number(m?.generated_prob) >= 0.5).map((m: any) => String(m?.sentence || ""));
      }
      j.rounds.push({ round, score: det.score, quetext: qt });
      log(`Round ${round}: AI-likeness ${det.score}% (ZeroGPT)${qt !== null ? `, ${qt}% (Quetext)` : ""}.`);
      const combined = qt !== null ? Math.max(det.score, qt) : det.score + 100; // unconfirmed rounds rank below confirmed ones
      if (combined <= best.score) best = { score: combined, texts: chunks.map((c) => c.text), zg: det.score, qt };
      if (det.score <= TARGET && (qt === null ? !process.env.QUETEXT_API_KEY : qt <= QT_TARGET)) { log(`Both detectors are at ${TARGET}% or below after round ${round}.`); break; }
      if (round === MAX_ROUNDS) break;
      if (engineWords >= editableWords * MAX_ENGINE_FACTOR) { log("Stopped here: further rounds are not bringing the score down."); break; }
      const flagged = [...det.flagged, ...qtFlagged].map((f) => norm(f).slice(0, 60)).filter(Boolean);
      const untouched = editable.filter((c) => c.text === c.orig);
      targets = editable.filter((c) => flagged.some((f) => norm(c.text).includes(f)) || untouched.includes(c));
      if (!targets.length) targets = editable;
      if (det.score <= TARGET) { forceFresh = true; log("The second detector still flags it."); }
      log(`Round ${round + 1}: reworking ${targets.length} passage(s).`);
    }
    best.texts.forEach((t, i) => { chunks[i].text = t; });
    const bz = best.zg; let bq = best.qt;
    if (j.rounds.length > 1) log(`Keeping the best round (${bz ?? "?"}% ZeroGPT${bq != null ? `, ${bq}% Quetext` : ""}).`);
    const origParas = join(chunks.map((c) => ({ ...c, text: c.orig }))).split("\n\n"), nextParas = join(chunks).split("\n\n");
    const review = origParas.length === nextParas.length
      ? origParas.map((orig, para) => {
          const unc = Array.from(unchecked).some((c) => c.para === para && c.text !== c.orig);
          return { para, orig, next: nextParas[para], flagged: unc, why: unc ? "Meaning not checked automatically. Please read it." : "" };
        }).filter((r) => r.orig !== r.next) : [];
    const final = join(chunks);
    j.progress = 90;
    let quetext: any = null;
    if (process.env.QUETEXT_API_KEY && words(final) >= 50) {
      log("Final AI check and plagiarism scan.");
      // One after the other: two parallel reports on the same key get rate-limited.
      const finalProse = editable.map((c) => c.text).join("\n\n");
      const ai: any = await quetextReport("ai-detect-report", finalProse, title).catch((e) => ({ error: e.message }));
      const plag: any = await quetextReport("report", final, title).catch((e) => ({ error: e.message }));
      if (ai?.error || plag?.error) console.warn("[rv] Quetext:", ai?.error || "", plag?.error || "");
      if (ai?.ai_score == null) log("The Quetext AI check did not return a score this time.");
      if (plag?.score == null && plag?.percentage == null) log("The plagiarism scan did not return a result this time.");
      if (bq == null && ai?.ai_score != null) bq = Math.round(Number(ai.ai_score) * 100) / 100;
      quetext = {
        aiScore: ai?.ai_score ?? null,
        plagiarism: plag?.score ?? plag?.percentage ?? null,
        sources: (plag?.matches || []).slice(0, 10).map((m: any) => ({ url: m?.source?.url, similar: m?.percent_similar })),
      };
    }
    if (!review.length) {
      await refundCredits(j.uid, j.cost, j.id, "Refund: no safe rewrite was possible").catch(() => {});
      log(`We could not rewrite this text safely without changing its facts, so your ${j.cost} credits were refunded.`);
      j.refunded = true;
    } else if (j.cost > 0 && process.env.QUETEXT_API_KEY && !(bz != null && bz <= TARGET && bq != null && bq <= QT_TARGET)) {
      // Fair-result guarantee: if the two independent detectors never both agreed, half the credits come back.
      const back = Math.floor(j.cost / 2);
      if (back > 0) {
        await refundCredits(j.uid, back, j.id, "Partial refund: the two detectors did not both agree").catch(() => {});
        log(`The two detectors did not both confirm a low score, so ${back} of your ${j.cost} credits were refunded. You keep the best version.`);
        (j as any).partialRefund = back;
      }
    }
    j.result = { text: final, originalWords: j.words, finalWords: words(final), before: j.before ?? null, rounds: j.rounds, finalCheck: quetext, finalScore: bz, meaningChecked, review };
    j.status = "done";
    j.progress = 100;
    log("Done.");
  } catch (e: any) {
    j.status = "failed";
    if (e instanceof QuetextNoCredit) {
      j.error = "The second AI detector is temporarily unavailable.";
      await refundCredits(j.uid, j.cost, j.id, "Refund: second detector unavailable").catch(() => {});
      log(`Our second AI detector is temporarily unavailable, so we stopped before using more of your text. Your ${j.cost} credits were refunded. Please try again later.`);
      j.refunded = true;
      await saveJob(j);
      return;
    }
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
  if (quetextOut()) return { status: 503, error: "Rewrite & Verify is paused for a short while for maintenance. Nothing was charged. Please try again later." };
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

  // Re-check the score after the user's own edits: part of the paid job (no fair-use limit), 5 times per job,
  // only for a text of about the same length as the job's.
  app.post("/api/rv/job/:id/recheck", async (req, res) => {
    const uid = await uidOf(req);
    if (!uid) return res.status(401).json({ error: "Please sign in." });
    try {
      let j: any = jobs.get(req.params.id);
      if (!j) { const db: any = await firestore(); j = db ? (await db.collection("rv_jobs").doc(req.params.id).get()).data() : null; }
      if (!j || j.uid !== uid || j.status !== "done") return res.status(404).json({ error: "Job not found." });
      const text = String(req.body?.text || "").trim();
      if (words(text) < 40 || words(text) > j.words * 1.3 + 100) return res.status(400).json({ error: "This text does not match the job." });
      if ((j.rechecks || 0) >= 5) return res.status(429).json({ error: "You have used the 5 re-checks of this job." });
      j.rechecks = (j.rechecks || 0) + 1; await saveJob(j);
      res.json({ success: true, score: (await zerogptDetect(text)).score });
    } catch (e: any) {
      console.error("[rv] recheck", e?.message);
      res.status(500).json({ error: "The check failed. Please try again in a minute." });
    }
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
