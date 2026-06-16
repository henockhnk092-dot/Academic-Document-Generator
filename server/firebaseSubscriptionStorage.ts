import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { USAGE_LIMITS } from '@shared/schema';

// Initialize Firebase Admin SDK
let firebaseApp: App | null = null;
let firebaseInitialized = false;
let firebaseInitError: Error | null = null;

function tryInitializeFirebase(): boolean {
  if (firebaseInitialized) return firebaseApp !== null;
  if (firebaseInitError) return false;

  try {
    const apps = getApps();
    if (apps.length > 0) {
      firebaseApp = apps[0]!;
      firebaseInitialized = true;
      return true;
    }

    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccount) {
      console.log('[Firebase Admin] No FIREBASE_SERVICE_ACCOUNT_KEY set - Firebase storage disabled');
      firebaseInitialized = true;
      return false;
    }

    const credentials = JSON.parse(serviceAccount);
    firebaseApp = initializeApp({
      credential: cert(credentials),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'academic-document-generator',
    });
    firebaseInitialized = true;
    console.log('[Firebase Admin] Initialized successfully');
    return true;
  } catch (error) {
    firebaseInitError = error as Error;
    firebaseInitialized = true;
    console.error('[Firebase Admin] Failed to initialize:', error);
    return false;
  }
}

function getFirestore(): Firestore | null {
  if (!tryInitializeFirebase() || !firebaseApp) {
    return null;
  }
  return getAdminFirestore();
}

export function isFirebaseAdminAvailable(): boolean {
  return tryInitializeFirebase() && firebaseApp !== null;
}

export interface UserSubscription {
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: 'active' | 'expired' | 'cancelled' | 'past_due' | 'pending';
  subscriptionTier: string;
  subscriptionExpiry: Date | null;
  freeAttemptsUsed: number;
  maxFreeAttempts: number;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SUBSCRIPTIONS_COLLECTION = 'subscriptions';

export class FirebaseSubscriptionStorage {
  private get db(): Firestore | null {
    return getFirestore();
  }

  isAvailable(): boolean {
    return isFirebaseAdminAvailable();
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    if (!this.db) {
      console.log('[Firebase Admin] Database not available - returning null subscription');
      return null;
    }
    try {
      const doc = await this.db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        userId: doc.id,
        stripeCustomerId: data.stripeCustomerId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        subscriptionStatus: data.subscriptionStatus || 'expired',
        subscriptionTier: data.subscriptionTier || 'free',
        subscriptionExpiry: data.subscriptionExpiry?.toDate() || null,
        freeAttemptsUsed: data.freeAttemptsUsed || 0,
        maxFreeAttempts: data.maxFreeAttempts || USAGE_LIMITS.freeUser,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  async createUserSubscription(userId: string, data: Partial<UserSubscription>): Promise<UserSubscription> {
    const now = new Date();
    const subscription: UserSubscription = {
      userId,
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      subscriptionStatus: data.subscriptionStatus || 'expired',
      subscriptionTier: data.subscriptionTier || 'free',
      subscriptionExpiry: data.subscriptionExpiry || null,
      freeAttemptsUsed: data.freeAttemptsUsed || 0,
      maxFreeAttempts: data.maxFreeAttempts || USAGE_LIMITS.freeUser,
      email: data.email,
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      const docData: any = {
        ...subscription,
        subscriptionExpiry: subscription.subscriptionExpiry
          ? Timestamp.fromDate(subscription.subscriptionExpiry)
          : null,
        createdAt: Timestamp.fromDate(subscription.createdAt),
        updatedAt: Timestamp.fromDate(subscription.updatedAt),
      };
      // Remove undefined email to avoid Firestore error
      if (docData.email === undefined) {
        delete docData.email;
      }
      await this.db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId).set(docData);
    } else {
      console.log('[Firebase Admin] Database not available - subscription not persisted');
    }

    return subscription;
  }

  async updateUserSubscription(userId: string, updates: Partial<UserSubscription>): Promise<UserSubscription | null> {
    if (!this.db) {
      console.log('[Firebase Admin] Database not available - cannot update subscription');
      return null;
    }
    const docRef = this.db.collection(SUBSCRIPTIONS_COLLECTION).doc(userId);

    const updateData: any = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Convert Date to Timestamp if present
    if (updates.subscriptionExpiry) {
      updateData.subscriptionExpiry = Timestamp.fromDate(updates.subscriptionExpiry);
    }

    await docRef.update(updateData);

    return this.getUserSubscription(userId);
  }

  async getOrCreateSubscription(userId: string): Promise<UserSubscription> {
    let subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      subscription = await this.createUserSubscription(userId, {
        subscriptionStatus: 'expired',
        subscriptionTier: 'free',
      });
    }

    return subscription;
  }

  async incrementUsage(userId: string): Promise<{ success: boolean; attemptsUsed: number; maxAttempts: number }> {
    const subscription = await this.getOrCreateSubscription(userId);

    // Check if user has active subscription
    if (subscription.subscriptionStatus === 'active' && subscription.subscriptionExpiry) {
      if (subscription.subscriptionExpiry > new Date()) {
        return { success: true, attemptsUsed: subscription.freeAttemptsUsed, maxAttempts: Infinity };
      }
    }

    // Check free tier limits
    if (subscription.freeAttemptsUsed >= subscription.maxFreeAttempts) {
      return {
        success: false,
        attemptsUsed: subscription.freeAttemptsUsed,
        maxAttempts: subscription.maxFreeAttempts
      };
    }

    // Increment usage
    const newAttemptsUsed = subscription.freeAttemptsUsed + 1;
    await this.updateUserSubscription(userId, { freeAttemptsUsed: newAttemptsUsed });

    return {
      success: true,
      attemptsUsed: newAttemptsUsed,
      maxAttempts: subscription.maxFreeAttempts,
    };
  }


  async activateSubscription(
    userId: string,
    stripeSubscriptionId: string,
    tier: string,
    expiryDate: Date
  ): Promise<void> {
    await this.updateUserSubscription(userId, {
      stripeSubscriptionId,
      subscriptionStatus: 'active',
      subscriptionTier: tier,
      subscriptionExpiry: expiryDate,
    });
  }

  async cancelSubscription(userId: string): Promise<void> {
    await this.updateUserSubscription(userId, {
      subscriptionStatus: 'cancelled',
    });
  }

  async getSubscriptionByCustomerId(customerId: string): Promise<UserSubscription | null> {
    if (!this.db) {
      console.log('[Firebase Admin] Database not available - cannot get subscription by customer ID');
      return null;
    }
    try {
      const snapshot = await this.db
        .collection(SUBSCRIPTIONS_COLLECTION)
        .where('stripeCustomerId', '==', customerId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        userId: doc.id,
        stripeCustomerId: data.stripeCustomerId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        subscriptionStatus: data.subscriptionStatus || 'expired',
        subscriptionTier: data.subscriptionTier || 'free',
        subscriptionExpiry: data.subscriptionExpiry?.toDate() || null,
        freeAttemptsUsed: data.freeAttemptsUsed || 0,
        maxFreeAttempts: data.maxFreeAttempts || USAGE_LIMITS.freeUser,
        email: data.email,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error getting subscription by customer ID:', error);
      return null;
    }
  }

  async findByEmail(email: string): Promise<UserSubscription | null> {
    if (!this.db) {
      console.log('[Firebase Admin] Database not available - cannot find by email');
      return null;
    }
    try {
      const snapshot = await this.db
        .collection(SUBSCRIPTIONS_COLLECTION)
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        userId: doc.id,
        stripeCustomerId: data.stripeCustomerId || null,
        stripeSubscriptionId: data.stripeSubscriptionId || null,
        subscriptionStatus: data.subscriptionStatus || 'expired',
        subscriptionTier: data.subscriptionTier || 'free',
        subscriptionExpiry: data.subscriptionExpiry?.toDate() || null,
        freeAttemptsUsed: data.freeAttemptsUsed || 0,
        maxFreeAttempts: data.maxFreeAttempts || USAGE_LIMITS.freeUser,
        email: data.email,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error finding subscription by email:', error);
      return null;
    }
  }
}

export const firebaseSubscriptionStorage = new FirebaseSubscriptionStorage();
