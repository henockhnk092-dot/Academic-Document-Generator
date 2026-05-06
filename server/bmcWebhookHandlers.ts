/**
 * Buy Me a Coffee Webhook Handlers
 *
 * Processes BMC webhook events to activate/deactivate subscriptions.
 * BMC sends webhooks for membership and donation events.
 */

import {
  BMCWebhookPayload,
  BMC_EVENTS,
  verifyBMCWebhook,
  parseBMCTier,
  calculateBMCExpiry,
} from './bmcClient';
import { firebaseSubscriptionStorage } from './firebaseSubscriptionStorage';
import { log } from './app';
import { PRICING_TIERS } from '@shared/schema';

export class BMCWebhookHandlers {
  /**
   * Process BMC webhook events
   */
  static async processWebhook(
    payload: BMCWebhookPayload,
    signature: string | undefined,
    rawBody: string
  ): Promise<{ success: boolean; message: string }> {
    log(`Processing BMC webhook: ${payload.event}`, 'bmc');

    // Verify signature if webhook secret is configured
    const webhookSecret = process.env.BMC_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyBMCWebhook(rawBody, signature, webhookSecret);
      if (!isValid) {
        log('Invalid webhook signature', 'bmc');
        return { success: false, message: 'Invalid signature' };
      }
    }

    try {
      switch (payload.event) {
        case BMC_EVENTS.MEMBERSHIP_STARTED:
          await this.handleMembershipStarted(payload);
          break;

        case BMC_EVENTS.MEMBERSHIP_CANCELLED:
          await this.handleMembershipCancelled(payload);
          break;

        case BMC_EVENTS.MEMBERSHIP_EXPIRED:
          await this.handleMembershipExpired(payload);
          break;

        case BMC_EVENTS.DONATION_RECEIVED:
          // One-time donations - could grant temporary access
          await this.handleDonation(payload);
          break;

        case BMC_EVENTS.EXTRA_PURCHASED:
          // Extra purchases (e.g., one-time products like Day Pass)
          await this.handleExtraPurchase(payload);
          break;

        default:
          log(`Unhandled BMC event type: ${payload.event}`, 'bmc');
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error: any) {
      log(`BMC webhook processing error: ${error.message}`, 'bmc');
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle new membership subscription
   */
  private static async handleMembershipStarted(payload: BMCWebhookPayload): Promise<void> {
    const { supporter_email, supporter_name, membership_level_name, duration } = payload.data;

    if (!supporter_email) {
      log('No supporter email in membership webhook', 'bmc');
      return;
    }

    // Parse tier from membership level name
    const tier = parseBMCTier(membership_level_name);
    if (!tier) {
      log(`Unknown membership level: ${membership_level_name}`, 'bmc');
      // Default to monthly if we can't parse
    }

    const finalTier = tier || 'monthly';
    log(`Membership started for ${supporter_email}, tier: ${finalTier}`, 'bmc');

    // Calculate expiry based on tier
    const expiryDate = calculateBMCExpiry(finalTier);

    // Find user by email or create a pending subscription
    // Note: The user will need to link their account by email
    const userId = await this.findOrCreateUserByEmail(supporter_email, supporter_name);

    if (!userId) {
      log(`Could not find/create user for ${supporter_email}`, 'bmc');
      return;
    }

    // Get or create subscription
    let subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);

    if (!subscription) {
      subscription = await firebaseSubscriptionStorage.createUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: finalTier,
        subscriptionExpiry: expiryDate,
      });
    } else {
      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: finalTier,
        subscriptionExpiry: expiryDate,
      });
    }

    log(`Activated BMC subscription for ${supporter_email}: ${finalTier} until ${expiryDate.toISOString()}`, 'bmc');
  }

  /**
   * Handle membership cancellation
   */
  private static async handleMembershipCancelled(payload: BMCWebhookPayload): Promise<void> {
    const { supporter_email } = payload.data;

    if (!supporter_email) {
      log('No supporter email in cancellation webhook', 'bmc');
      return;
    }

    log(`Membership cancelled for ${supporter_email}`, 'bmc');

    const userId = await this.findUserByEmail(supporter_email);
    if (!userId) {
      log(`User not found for ${supporter_email}`, 'bmc');
      return;
    }

    // Mark as cancelled but don't remove immediately (let them use until expiry)
    const subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);
    if (subscription) {
      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'cancelled',
      });
      log(`Marked subscription as cancelled for ${supporter_email}`, 'bmc');
    }
  }

  /**
   * Handle membership expiration
   */
  private static async handleMembershipExpired(payload: BMCWebhookPayload): Promise<void> {
    const { supporter_email } = payload.data;

    if (!supporter_email) {
      log('No supporter email in expiration webhook', 'bmc');
      return;
    }

    log(`Membership expired for ${supporter_email}`, 'bmc');

    const userId = await this.findUserByEmail(supporter_email);
    if (!userId) {
      log(`User not found for ${supporter_email}`, 'bmc');
      return;
    }

    await firebaseSubscriptionStorage.cancelSubscription(userId);
    log(`Cancelled subscription for ${supporter_email} due to expiry`, 'bmc');
  }

  /**
   * Handle one-time donation
   * Could grant temporary access (e.g., 1 day per $X donated)
   */
  private static async handleDonation(payload: BMCWebhookPayload): Promise<void> {
    const { supporter_email, amount, currency } = payload.data;

    log(`Donation received: ${amount} ${currency} from ${supporter_email}`, 'bmc');

    // Optional: Grant temporary access based on donation amount
    // For now, just log it
    // You could implement: $1 = 1 day access, etc.
  }

  /**
   * Handle extra (one-time product) purchase
   * Use this for Day Pass or other one-time purchases
   */
  private static async handleExtraPurchase(payload: BMCWebhookPayload): Promise<void> {
    const { supporter_email, extra_name, amount } = payload.data;

    if (!supporter_email) {
      log('No supporter email in extra purchase webhook', 'bmc');
      return;
    }

    log(`Extra purchased: ${extra_name} for ${amount} by ${supporter_email}`, 'bmc');

    // Parse tier from extra name (for one-time purchases like Day Pass)
    const tier = parseBMCTier(extra_name);
    if (!tier) {
      log(`Unknown extra: ${extra_name}`, 'bmc');
      return;
    }

    const userId = await this.findOrCreateUserByEmail(supporter_email);
    if (!userId) {
      log(`Could not find/create user for ${supporter_email}`, 'bmc');
      return;
    }

    const expiryDate = calculateBMCExpiry(tier);

    let subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);

    if (!subscription) {
      subscription = await firebaseSubscriptionStorage.createUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: tier,
        subscriptionExpiry: expiryDate,
      });
    } else {
      // Extend existing subscription if it's still active
      const currentExpiry = subscription.subscriptionExpiry;
      const newExpiry = currentExpiry && currentExpiry > new Date()
        ? new Date(currentExpiry.getTime() + (expiryDate.getTime() - Date.now()))
        : expiryDate;

      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: tier,
        subscriptionExpiry: newExpiry,
      });
    }

    log(`Activated extra purchase for ${supporter_email}: ${tier} until ${expiryDate.toISOString()}`, 'bmc');
  }

  /**
   * Find user by email
   * Searches Firebase for a user with matching email
   */
  private static async findUserByEmail(email: string): Promise<string | null> {
    try {
      // Search for subscription by email
      const subscription = await firebaseSubscriptionStorage.findByEmail(email);
      return subscription?.userId || null;
    } catch {
      return null;
    }
  }

  /**
   * Find or create a placeholder user by email
   * Creates a subscription record that will be linked when user signs in with same email
   */
  private static async findOrCreateUserByEmail(email: string, name?: string): Promise<string | null> {
    try {
      // First try to find existing user
      let subscription = await firebaseSubscriptionStorage.findByEmail(email);

      if (subscription) {
        return subscription.userId;
      }

      // Create a placeholder using email as userId
      // When the user signs in with Firebase Auth using this email,
      // they should update their subscription record
      const userId = `bmc_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

      await firebaseSubscriptionStorage.createUserSubscription(userId, {
        subscriptionStatus: 'pending',
        subscriptionTier: 'free',
        email,
      });

      log(`Created placeholder subscription for ${email} with userId ${userId}`, 'bmc');
      return userId;
    } catch (error: any) {
      log(`Error finding/creating user by email: ${error.message}`, 'bmc');
      return null;
    }
  }
}
