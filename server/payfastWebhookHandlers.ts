import { validateITN, PAYFAST_STATUS, getPayFastConfig } from './payfastClient';
import { firebaseSubscriptionStorage } from './firebaseSubscriptionStorage';
import { payfastService } from './payfastService';
import { log } from './app';
import { PRICING_TIERS } from '@shared/schema';

export interface PayFastITNData {
  // Transaction details
  m_payment_id: string;
  pf_payment_id: string;
  payment_status: string;
  item_name: string;
  item_description?: string;
  amount_gross: string;
  amount_fee: string;
  amount_net: string;

  // Customer details
  name_first?: string;
  name_last?: string;
  email_address?: string;

  // Merchant details
  merchant_id: string;

  // Custom fields (we use these to store user info)
  custom_str1?: string; // userId
  custom_str2?: string; // tier
  custom_str3?: string;
  custom_str4?: string;
  custom_str5?: string;
  custom_int1?: string; // duration in days
  custom_int2?: string;
  custom_int3?: string;
  custom_int4?: string;
  custom_int5?: string;

  // Subscription details
  token?: string; // Subscription token for recurring payments
  billing_date?: string;

  // Signature
  signature: string;
}

export class PayFastWebhookHandlers {
  /**
   * Process PayFast ITN (Instant Transaction Notification)
   */
  static async processITN(data: PayFastITNData): Promise<{ success: boolean; message: string }> {
    log(`Processing PayFast ITN: ${data.pf_payment_id}`, 'payfast');

    try {
      // Validate the ITN
      const config = getPayFastConfig();

      // Verify merchant ID
      if (data.merchant_id !== config.merchantId) {
        log(`Invalid merchant ID: ${data.merchant_id}`, 'payfast');
        return { success: false, message: 'Invalid merchant ID' };
      }

      // Validate signature and ITN with PayFast server
      const isValid = await validateITN(data as unknown as Record<string, any>);
      if (!isValid) {
        log('ITN validation failed', 'payfast');
        // In sandbox mode, we might still process the payment for testing
        if (!config.sandbox) {
          return { success: false, message: 'Invalid ITN signature' };
        }
        log('Continuing despite invalid signature (sandbox mode)', 'payfast');
      }

      // Handle based on payment status
      switch (data.payment_status) {
        case PAYFAST_STATUS.COMPLETE:
          await this.handlePaymentComplete(data);
          break;

        case PAYFAST_STATUS.FAILED:
          await this.handlePaymentFailed(data);
          break;

        case PAYFAST_STATUS.CANCELLED:
          await this.handlePaymentCancelled(data);
          break;

        case PAYFAST_STATUS.PENDING:
          log(`Payment pending: ${data.pf_payment_id}`, 'payfast');
          break;

        default:
          log(`Unknown payment status: ${data.payment_status}`, 'payfast');
      }

      return { success: true, message: 'ITN processed' };
    } catch (error: any) {
      log(`ITN processing error: ${error.message}`, 'payfast');
      return { success: false, message: error.message };
    }
  }

  /**
   * Handle successful payment
   */
  private static async handlePaymentComplete(data: PayFastITNData): Promise<void> {
    const userId = data.custom_str1;
    const tier = data.custom_str2 as keyof typeof PRICING_TIERS | undefined;

    if (!userId) {
      log('No userId in ITN custom_str1', 'payfast');
      return;
    }

    log(`Payment complete for user ${userId}, tier: ${tier}`, 'payfast');

    // Calculate expiry date
    const expiryDate = tier
      ? payfastService.calculateExpiryDate(tier)
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
        stripeSubscriptionId: data.token || data.pf_payment_id, // Store PayFast token/ID
      });
    }

    log(`Activated subscription for user ${userId}: ${tier} until ${expiryDate.toISOString()}`, 'payfast');
  }

  /**
   * Handle failed payment
   */
  private static async handlePaymentFailed(data: PayFastITNData): Promise<void> {
    const userId = data.custom_str1;

    if (!userId) {
      log('No userId in failed payment ITN', 'payfast');
      return;
    }

    log(`Payment failed for user ${userId}`, 'payfast');

    // Mark subscription as past_due if it exists
    const subscription = await firebaseSubscriptionStorage.getUserSubscription(userId);
    if (subscription && subscription.subscriptionStatus === 'active') {
      await firebaseSubscriptionStorage.updateUserSubscription(userId, {
        subscriptionStatus: 'past_due',
      });
      log(`Marked subscription as past_due for user ${userId}`, 'payfast');
    }
  }

  /**
   * Handle cancelled payment/subscription
   */
  private static async handlePaymentCancelled(data: PayFastITNData): Promise<void> {
    const userId = data.custom_str1;

    if (!userId) {
      log('No userId in cancelled payment ITN', 'payfast');
      return;
    }

    log(`Payment cancelled for user ${userId}`, 'payfast');

    await firebaseSubscriptionStorage.cancelSubscription(userId);
    log(`Cancelled subscription for user ${userId}`, 'payfast');
  }
}
