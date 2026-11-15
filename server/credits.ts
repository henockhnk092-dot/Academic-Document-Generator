// Credits wallet for the premium "Rewrite & Verify" service. 1 credit = R1. Stored in Firestore:
// credits/<uid> { balance } and credits/<uid>/ledger/<ref> (one entry per purchase, charge or refund).
import { isFirebaseAdminAvailable } from "./firebaseSubscriptionStorage";

// Packs sold through Payfast (rand price -> credits; bigger packs include bonus credits).
export const CREDIT_PACKS: Record<string, { amount: number; credits: number; label: string }> = {
  credits_69: { amount: 69, credits: 69, label: "AcademicGen 69 credits" },
  credits_299: { amount: 299, credits: 320, label: "AcademicGen 320 credits" },
  credits_799: { amount: 799, credits: 900, label: "AcademicGen 900 credits" },
};

async function fs() {
  if (!isFirebaseAdminAvailable()) throw new Error("Credits are not available right now.");
  const { getApp } = await import("firebase-admin/app");
  const { getFirestore, FieldValue } = await import("firebase-admin/firestore");
  return { db: getFirestore(getApp()), FieldValue };
}

export async function getBalance(uid: string): Promise<number> {
  const { db } = await fs();
  return Number((await db.collection("credits").doc(uid).get()).data()?.balance ?? 0);
}

// Adds (or with a negative amount removes) credits once per ref; returns false if the ref was already applied.
async function apply(uid: string, amount: number, ref: string, note: string, requireFunds = false): Promise<boolean> {
  const { db, FieldValue } = await fs();
  const wallet = db.collection("credits").doc(uid);
  const entry = wallet.collection("ledger").doc(ref.replace(/[\/#?]/g, "_").slice(0, 140));
  return db.runTransaction(async (tx) => {
    const [w, e] = await Promise.all([tx.get(wallet), tx.get(entry)]);
    if (e.exists) return false;
    const bal = Number(w.data()?.balance ?? 0);
    if (requireFunds && bal + amount < 0) throw new Error("not_enough_credits");
    tx.set(wallet, { balance: FieldValue.increment(amount), updatedAt: new Date() }, { merge: true });
    tx.set(entry, { amount, note, at: new Date() });
    return true;
  });
}

export const addCredits = (uid: string, amount: number, ref: string, note: string) => apply(uid, amount, ref, note);
export const chargeCredits = (uid: string, amount: number, ref: string, note: string) => apply(uid, -amount, ref, note, true);
export const refundCredits = (uid: string, amount: number, ref: string, note: string) => apply(uid, amount, `refund-${ref}`, note);
