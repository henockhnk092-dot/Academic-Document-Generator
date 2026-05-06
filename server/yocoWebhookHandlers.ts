import { YocoWebhookPayload, YOCO_EVENTS, verifyYocoWebhook } from './yocoClient';
import { firebaseSubscriptionStorage } from './firebaseSubscriptionStorage';
import { yocoService } from './yocoService';
import { log } from './app';
import { PRICING_TIERS } from '@shared/schema';

export class YocoWebhookHandlers {
  /**
   * Process Yoco webhook events
   */
  static async processWebhook(
    payload: YocoWebhookPayload,
    signature: string | undefined,
    rawBody: string
  ): Promise<{ success: boolean; message: string }> {
    log(`Processing Yoco webhook: ${payload.type}`, 'yoco');

    // Verify signature if webhook secret is configured
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      const isValid = verifyYocoWebhook(rawBody, signature, webhookSecret);
      if (!isValid) {
        log('Invalid webhook signature', 'yoco');
        return { success: false, message: 'Invalid signature' };
      }
    }

    try {
      switch (payload.type) {
        case YOCO_EVENTS.PAYMENT_SUCCEEDED:
          await this.handlePaymentSucceeded(payload);
          break;

        case YOCO_EVENTS.PAYMENT_FAILED:
          await this.handlePaymentFailed(payload);
          break;

        case YOCO_EVENTS.CHECKOUT_EXPIRED:
          log(`Checkout expired: ${payload.payload.id}`, 'yoco');
          break;

        case YOCO_EVENTS.REFUND_SUCCEEDED:
          await this.handleRefundSucceeded(payload);
          break;

        default:
          log(`Unhandled event type: ${payload.type}`, 'yoco');
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error: any) {
      log(`Webhook processing error: ${error.message}`, 'yoco');
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentSucceeded(payload: YocoWebhookPayload): Promise<void> {
    const { metadata, externalId } = payload.payload;
    const userId = metadata?.userId;
    const tier = metadata?.tier as keyof typeof PRICING_TIERS | undefined;

    if (!userId) {
      log('No userId in payment metadata', 'yoco');
      return;
    }

    log(`Payment succeeded for user ${userId}, tier: ${tier}`, 'yoco');

    // Calculate expiry date
    const expiryDate = tier
      ? yocoService.calculateExpiryDate(tier)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 30);
          return d;
        })();

    // Get or create subscription record
    let subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);

    if (!subscription) {
      subscription = await firebaseSubscriptionStorage.createUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: tier || 'subscription',
        subscriptionExpiry: expiryDate,
      });
    } else {
      // Update existing subscription
      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'active',
        subscriptionTier: tier || 'subscription',
        subscriptionExpiry: expiryDate,
        stripeSubscriptionId: payload.payload.id, // Store Yoco payment ID
      });
    }

    log(`Activated subscription for user ${userId}: ${tier} until ${expiryDate.toISOString()}`, 'yoco');
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailed(payload: YocoWebhookPayload): Promise<void> {
    const { metadata } = payload.payload;
    const userId = metadata?.userId;

    if (!userId) {
      log('No userId in failed payment metadata', 'yoco');
      return;
    }

    log(`Payment failed for user ${userId}`, 'yoco');

    // Mark subscription as past_due if it exists
    const subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);
    if (subscription && subscription.subscriptionStatus === 'active') {
      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'past_due',
      });
      log(`Marked subscription as past_due for user ${userId}`, 'yoco');
    }
  }

  /**
   * Handle successful refund
   */
  private static async handleRefundSucceeded(payload: YocoWebhookPayload): Promise<void> {
    const { metadata } = payload.payload;
    const userId = metadata?.userId;

    if (!userId) {
      log('No userId in refund metadata', 'yoco');
      return;
    }

    log(`Refund succeeded for user ${userId}`, 'yoco');

    // Cancel the subscription
    await firebaseSubscriptionStorage.cancelSubscription(userId);
    log(`Cancelled subscription for user ${userId} due to refund`, 'yoco');
  }
}
