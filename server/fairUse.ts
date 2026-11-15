// Fair-use meter: caps what one account (or one guest IP) can use per period, so no plan can cost more in
// AI / voice API fees than it brings in. Counts are kept in Firestore (fair_use/<uid>) and in memory for guests.
// Limits are generous for normal students; they only stop abuse (bots, resellers, direct API calls).
import type { Request, Response, NextFunction } from "express";
import { isFirebaseAdminAvailable } from "./firebaseSubscriptionStorage";

export type Meter = "docs" | "sections" | "words" | "chars";
type Period = "day" | "week" | "month";
interface PlanLimits { period: Period; docs: number; sections: number; words: number; chars: number }

// docs = full documents (report, thesis, paper, slides); sections = single-section generations;
// words = humanize/paraphrase words; chars = read-aloud characters (Azure / Gemini voices).
// Worst case per plan (every meter maxed, paid Gemini ~R1.20 per thesis, ~R0.15 per section, ~R0.15 per
// 1,000 humanize words, ~R0.29 per 1,000 Azure characters) stays at about 70-80% of what the plan nets after
// the Payfast fee: Day R16 -> ~R12.5, Week R45 -> ~R32, Month R141 -> ~R101, Year ~R120/month -> ~R84.
export const FAIR_USE: Record<string, PlanLimits> = {
  guest:    { period: "day",   docs: 10, sections: 30,  words: 0,     chars: 20000 }, // per IP (campus networks share IPs)
  free:     { period: "day",   docs: 3,  sections: 10,  words: 1000,  chars: 5000 },
  day_pass: { period: "day",   docs: 6,  sections: 15,  words: 5000,  chars: 8000 },
  weekly:   { period: "week",  docs: 15, sections: 40,  words: 15000, chars: 20000 },
  monthly:  { period: "month", docs: 50, sections: 120, words: 60000, chars: 50000 },
  yearly:   { period: "month", docs: 40, sections: 100, words: 50000, chars: 45000 },
};
const PAID = ["day_pass", "weekly", "monthly", "yearly", "pro", "business", "paid"];
const LABEL: Record<Meter, string> = { docs: "documents", sections: "section generations", words: "humanize words", chars: "read-aloud characters" };

// South African time (UTC+2, no daylight saving) so "resets tomorrow" matches the user's day.
function periodKey(p: Period, now = new Date()): string {
  const d = new Date(now.getTime() + 2 * 3600 * 1000);
  const ymd = d.toISOString().slice(0, 10);
  if (p === "day") return ymd;
  if (p === "month") return ymd.slice(0, 7);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const week = Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
const RESETS: Record<Period, string> = { day: "tomorrow", week: "on Monday", month: "on the 1st of next month" };

async function admin() {
  if (!isFirebaseAdminAvailable()) return null;
  const { getApps, getApp } = await import("firebase-admin/app");
  if (getApps().length === 0) return null;
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  return { auth: getAuth(getApp()), db: getFirestore(getApp()), FieldValue };
}

function tokenOf(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return typeof req.body?.token === "string" ? req.body.token : undefined;
}

// Who is calling and on which plan. Same sources as the paid-access check: users/<uid> and subscriptions/<uid>.
type Who = { key: string; plan: string } | "unlimited" | null;
const whoCache = new Map<string, { at: number; who: Who }>();

async function whoIs(req: Request): Promise<Who> {
  const t = tokenOf(req);
  const hit = t ? whoCache.get(t) : undefined;
  if (hit && Date.now() - hit.at < 60000) return hit.who;
  const who = await whoIsUncached(req);
  if (t) {
    if (whoCache.size > 5000) whoCache.clear();
    whoCache.set(t, { at: Date.now(), who });
  }
  return who;
}

async function whoIsUncached(req: Request): Promise<Who> {
  const a = await admin();
  if (!a) return null; // no Firebase (local dev): do not meter
  const ip = (String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.ip || "").split(",")[0] || "unknown").trim();
  const token = tokenOf(req);
  if (!token) return { key: `ip:${ip}`, plan: "guest" };
  let uid: string;
  try { uid = (await a.auth.verifyIdToken(token)).uid; } catch { return { key: `ip:${ip}`, plan: "guest" }; }
  const [userSnap, subSnap] = await Promise.all([a.db.collection("users").doc(uid).get(), a.db.collection("subscriptions").doc(uid).get()]);
  const u = userSnap.data() ?? {};
  if (u.isAdmin === true || u.role === "admin" || u.role === "developer") return "unlimited";
  const now = new Date();
  if (PAID.includes(u.plan) && (!u.planExpiresAt || new Date(u.planExpiresAt) > now)) return { key: uid, plan: u.plan };
  const s = subSnap.data() ?? {};
  const exp = s.subscriptionExpiry?.toDate?.() ?? (s.subscriptionExpiry ? new Date(s.subscriptionExpiry) : null);
  if (s.subscriptionStatus === "active" && exp && exp > now) return { key: uid, plan: s.subscriptionTier || "paid" };
  return { key: uid, plan: "free" };
}

const guestCounts = new Map<string, number>(); // `${ip}|${period}|${meter}` -> used (resets on restart; fine for a safety cap)

async function used(key: string, pk: string, meter: Meter): Promise<number> {
  if (key.startsWith("ip:")) return guestCounts.get(`${key}|${pk}|${meter}`) ?? 0;
  const a = await admin();
  const snap = await a!.db.collection("fair_use").doc(key).get();
  return Number(snap.data()?.[pk]?.[meter] ?? 0);
}

async function add(key: string, pk: string, meter: Meter, amount: number) {
  if (key.startsWith("ip:")) {
    const k = `${key}|${pk}|${meter}`;
    guestCounts.set(k, (guestCounts.get(k) ?? 0) + amount);
    if (guestCounts.size > 50000) guestCounts.clear();
    return;
  }
  const a = await admin();
  await a!.db.collection("fair_use").doc(key).set({ [pk]: { [meter]: a!.FieldValue.increment(amount) }, updatedAt: new Date() }, { merge: true });
}

const textLen = (req: Request) => String(req.body?.text ?? "").length;
const wordLen = (req: Request) => String(req.body?.text ?? "").trim().split(/\s+/).filter(Boolean).length;
export const AMOUNT = { one: () => 1, words: wordLen, chars: textLen };

// Express middleware: refuse when the call would pass the plan's limit; count it once the call succeeds.
export function fairUse(meter: Meter, amountOf: (req: Request) => number = AMOUNT.one) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const who = await whoIs(req);
      if (!who || who === "unlimited") return next();
      const limits = FAIR_USE[who.plan] ?? FAIR_USE.monthly; // unknown paid tiers get the monthly allowance
      const amount = Math.max(1, amountOf(req));
      const pk = periodKey(limits.period);
      const limit = limits[meter];
      const now = await used(who.key, pk, meter);
      if (now + amount > limit) {
        const signedOut = who.plan === "guest";
        const message = limit === 0
          ? (signedOut ? "Please sign in to use this feature." : "This feature is available on paid plans.")
          : `Fair use limit reached: ${limit.toLocaleString("en-ZA")} ${LABEL[meter]} per ${limits.period} on your plan` +
            ` (used ${now.toLocaleString("en-ZA")}). It resets ${RESETS[limits.period]}.` +
            (signedOut ? " Sign in for your own allowance." : who.plan === "free" ? " Upgrade for a higher allowance." : "");
        return res.status(403).json({ error: message, code: "fair_use_limit", meter, limit, used: now, plan: who.plan, resets: RESETS[limits.period] });
      }
      res.on("finish", () => {
        if (res.statusCode < 400) add(who.key, pk, meter, amount).catch((e) => console.warn("[fair-use] count failed:", e?.message));
      });
      next();
    } catch (e: any) {
      console.warn("[fair-use] check skipped:", e?.message); // never block a user because the meter itself failed
      next();
    }
  };
}

// Current usage for the signed-in user (shown on the pricing/settings page).
export async function fairUseStatus(req: Request) {
  const who = await whoIs(req);
  if (!who) return { metered: false };
  if (who === "unlimited") return { metered: false, plan: "admin" };
  const limits = FAIR_USE[who.plan] ?? FAIR_USE.monthly;
  const pk = periodKey(limits.period);
  const out: Record<string, { used: number; limit: number }> = {};
  for (const m of ["docs", "sections", "words", "chars"] as Meter[]) out[m] = { used: await used(who.key, pk, m), limit: limits[m] };
  return { metered: true, plan: who.plan, period: limits.period, resets: RESETS[limits.period], usage: out };
}
