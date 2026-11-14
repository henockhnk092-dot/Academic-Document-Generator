// Payfast (South Africa) checkout + ITN (Instant Transaction Notification) for AcademicGen plans.
// Sandbox mode (PAYFAST_SANDBOX=true, the default) uses Payfast's public sandbox merchant, so no real money moves.
// Live mode uses PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE from the environment.
import crypto from "crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import { log } from "./app";
import { firebaseSubscriptionStorage } from "./firebaseSubscriptionStorage";

// Provisional rand prices per plan (Payfast charges in ZAR). Change here only.
export const PAYFAST_PRICES_ZAR: Record<string, { amount: number; days: number; label: string; recurring?: 3 | 6 }> = {
  day_pass: { amount: 19, days: 1, label: "AcademicGen Day Pass" },
  weekly: { amount: 49, days: 7, label: "AcademicGen Weekly" },
  monthly: { amount: 149, days: 30, label: "AcademicGen Monthly", recurring: 3 }, // 3 = monthly
  yearly: { amount: 1499, days: 365, label: "AcademicGen Yearly", recurring: 6 }, // 6 = annual
};

// Payfast's published public sandbox merchant (documentation test credentials, not a secret).
const SANDBOX = { merchantId: "10000100", merchantKey: "46f0cd694581a", passphrase: "jt7NOE43FZPn" };

function config() {
  const sandbox = (process.env.PAYFAST_SANDBOX ?? "true").toLowerCase() !== "false";
  const creds = sandbox
    ? SANDBOX
    : {
        merchantId: process.env.PAYFAST_MERCHANT_ID || "",
        merchantKey: process.env.PAYFAST_MERCHANT_KEY || "",
        passphrase: process.env.PAYFAST_PASSPHRASE || "",
      };
  const host = sandbox ? "https://sandbox.payfast.co.za" : "https://www.payfast.co.za";
  return { sandbox, ...creds, processUrl: `${host}/eng/process`, validateUrl: `${host}/eng/query/validate` };
}

// PHP-style urlencode (what Payfast's signature uses): spaces as '+', uppercase hex.
function pfEncode(v: string): string {
  return encodeURIComponent(v.trim())
    .replace(/%20/g, "+")
    .replace(/[!'()*~]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

function paramString(pairs: [string, string][]): string {
  return pairs.filter(([, v]) => v !== undefined && v !== null && String(v) !== "").map(([k, v]) => `${k}=${pfEncode(String(v))}`).join("&");
}

function sign(pairs: [string, string][], passphrase: string): string {
  let s = paramString(pairs);
  if (passphrase) s += `&passphrase=${pfEncode(passphrase)}`;
  return crypto.createHash("md5").update(s).digest("hex");
}

async function uidFromRequest(req: Request): Promise<{ uid: string; email?: string } | null> {
  const h = req.headers.authorization;
  const token = h?.startsWith("Bearer ") ? h.slice(7) : undefined;
  if (!token) return null;
  const { getApps, getApp } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  if (getApps().length === 0) return null;
  const d = await getAuth(getApp()).verifyIdToken(token);
  return { uid: d.uid, email: d.email };
}

export function registerPayfastRoutes(app: Express) {
  app.get("/api/payfast/status", (_req, res) => {
    const c = config();
    res.json({ enabled: c.sandbox || Boolean(c.merchantId && c.merchantKey), sandbox: c.sandbox, prices: PAYFAST_PRICES_ZAR });
  });

  // Build a signed payment for the chosen plan; the browser posts these fields to Payfast.
  app.post("/api/payfast/checkout", async (req: Request, res: Response) => {
    try {
      const user = await uidFromRequest(req).catch(() => null);
      if (!user) return res.status(401).json({ error: "Please sign in first." });
      const tier = String(req.body?.tier || "");
      const plan = PAYFAST_PRICES_ZAR[tier];
      if (!plan) return res.status(400).json({ error: "Unknown plan." });
      const c = config();
      if (!c.merchantId || !c.merchantKey) return res.status(503).json({ error: "Payments are not configured yet." });

      const site = (process.env.APP_BASE_URL || "https://academicgen.com").replace(/\/$/, "");
      const api = (process.env.API_PUBLIC_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
      const pairs: [string, string][] = [
        ["merchant_id", c.merchantId],
        ["merchant_key", c.merchantKey],
        ["return_url", `${site}/checkout-success?provider=payfast&tier=${tier}`],
        ["cancel_url", `${site}/pricing?payment=cancelled`],
        ["notify_url", `${api}/api/payfast/notify`],
        ["email_address", user.email || ""],
        ["m_payment_id", `${user.uid.slice(0, 20)}-${tier}-${Date.now()}`],
        ["amount", plan.amount.toFixed(2)],
        ["item_name", plan.label],
        ["custom_str1", user.uid],
        ["custom_str2", tier],
      ];
      if (plan.recurring) {
        pairs.push(["subscription_type", "1"], ["recurring_amount", plan.amount.toFixed(2)], ["frequency", String(plan.recurring)], ["cycles", "0"]);
      }
      const fields = Object.fromEntries(pairs.filter(([, v]) => v !== ""));
      fields.signature = sign(pairs, c.passphrase);
      res.json({ action: c.processUrl, fields, sandbox: c.sandbox });
    } catch (e) {
      log(`Payfast checkout error: ${e instanceof Error ? e.message : e}`, "payfast");
      res.status(500).json({ error: "Could not start the payment." });
    }
  });

  // ITN: Payfast posts here after a payment. Verify signature, amount and with Payfast, then activate the plan.
  app.post("/api/payfast/notify", express.urlencoded({ extended: false }), async (req: Request, res: Response) => {
    res.status(200).end(); // Payfast needs a quick 200; work continues below
    try {
      const c = config();
      const body = req.body as Record<string, string>;
      const pairs = Object.entries(body).filter(([k]) => k !== "signature") as [string, string][];
      if (sign(pairs, c.passphrase) !== body.signature) return log("ITN rejected: bad signature", "payfast");
      if (body.merchant_id !== c.merchantId) return log("ITN rejected: merchant mismatch", "payfast");
      const tier = body.custom_str2;
      const plan = PAYFAST_PRICES_ZAR[tier];
      if (!plan || Math.abs(parseFloat(body.amount_gross) - plan.amount) > 0.01) return log("ITN rejected: amount mismatch", "payfast");
      const check = await fetch(c.validateUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: paramString(pairs) });
      if ((await check.text()).trim() !== "VALID") return log("ITN rejected: Payfast validation failed", "payfast");
      if (body.payment_status !== "COMPLETE") return log(`ITN status ${body.payment_status} for ${tier}`, "payfast");

      const uid = body.custom_str1;
      await firebaseSubscriptionStorage.getOrCreateSubscription(uid);
      const expiry = new Date(Date.now() + plan.days * 86400000);
      await firebaseSubscriptionStorage.activateSubscription(uid, `payfast:${body.token || body.pf_payment_id}`, tier, expiry);
      log(`Payfast payment COMPLETE: ${tier} activated until ${expiry.toISOString().slice(0, 10)}${c.sandbox ? " (sandbox)" : ""}`, "payfast");
    } catch (e) {
      log(`Payfast ITN error: ${e instanceof Error ? e.message : e}`, "payfast");
    }
  });
}
